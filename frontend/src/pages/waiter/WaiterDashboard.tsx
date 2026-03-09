import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineMinus, HiOutlineShoppingCart, HiOutlineCheck, HiOutlineArrowLeft, HiOutlineX, HiOutlineViewGrid, HiOutlineViewList, HiOutlineClipboardList, HiOutlineRefresh, HiOutlineSwitchHorizontal } from 'react-icons/hi';

interface MenuItem {
    _id: string;
    name: string;
    category: string;
    price: number;
}

interface CartItem {
    menuItemId: string;
    name: string;
    quantity: number;
}

interface TableOrder {
    _id: string;
    items: { name: string; quantity: number; price: number }[];
    createdAt: string;
}

interface Hall {
    name: string;
    tables: number[];
    type: 'hall' | 'cabinet';
}

const IDLE_TIMEOUT_MS = 5000; // 5 seconds

const WaiterDashboard: React.FC = () => {
    const { logout, user } = useAuth();
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [tableNumber, setTableNumber] = useState<string | null>(null);
    const [halls, setHalls] = useState<Hall[]>([]);
    const [activeHall, setActiveHall] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [cartOpen, setCartOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [busyTables, setBusyTables] = useState<Map<string, { latestOrderAt: string; checkPrinted: boolean }>>(new Map());
    const [tableOrders, setTableOrders] = useState<TableOrder[]>([]);
    const [showLastOrders, setShowLastOrders] = useState(false);
    const [changingTable, setChangingTable] = useState<string | null>(null);
    const [deletedItemsToPrint, setDeletedItemsToPrint] = useState<{ name: string, price: number }[]>([]);
    const [showOrderPopup, setShowOrderPopup] = useState(false);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [adminPin, setAdminPin] = useState('');
    const [pinInput, setPinInput] = useState('');
    const [deletingItem, setDeletingItem] = useState<string | null>(null);
    const [, setTick] = useState(0);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-logout after 5 seconds of inactivity on the table selection screen
    const resetIdleTimer = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            logout();
        }, IDLE_TIMEOUT_MS);
    }, [logout]);

    useEffect(() => {
        // Only activate auto-logout on the table selection screen
        if (tableNumber !== null) {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            return;
        }

        // Start timer immediately
        resetIdleTimer();

        // Reset on any user interaction
        const events = ['mousedown', 'mousemove', 'touchstart', 'keydown', 'scroll'];
        events.forEach((e) => window.addEventListener(e, resetIdleTimer));

        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
        };
    }, [tableNumber, resetIdleTimer]);

    // Fetch existing orders whenever a table is selected
    const fetchTableOrders = async (table: string) => {
        try {
            const { data } = await api.get(`/waiter/table-orders/${encodeURIComponent(table)}`);
            setTableOrders(data);
        } catch {
            setTableOrders([]);
        }
    };

    useEffect(() => {
        if (tableNumber) {
            fetchTableOrders(tableNumber);
        } else {
            setTableOrders([]);
            setShowLastOrders(false);
        }
    }, [tableNumber]);

    // Tick every second to update elapsed timers
    useEffect(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        fetchMenu();
        fetchSettings();
        fetchBusyTables();

        const socket = getSocket();
        socket.on('table-freed', (data: { tableNumber: string }) => {
            setBusyTables((prev) => {
                const next = new Map(prev);
                next.delete(String(data.tableNumber));
                return next;
            });
        });
        socket.on('table-busy', (data: { tableNumber: string; latestOrderAt: string }) => {
            setBusyTables((prev) => {
                const next = new Map(prev);
                next.set(String(data.tableNumber), {
                    latestOrderAt: data.latestOrderAt,
                    checkPrinted: false // new order resets check printed status
                });
                return next;
            });
        });
        socket.on('table-printed', (data: { tableNumber: string }) => {
            setBusyTables((prev) => {
                const map = new Map(prev);
                const ex = map.get(String(data.tableNumber));
                if (ex) map.set(String(data.tableNumber), { ...ex, checkPrinted: true });
                return map;
            });
        });
        return () => {
            socket.off('table-freed');
            socket.off('table-busy');
            socket.off('table-printed');
        };
    }, []);

    const fetchBusyTables = async () => {
        try {
            const { data } = await api.get('/waiter/busy-tables');
            const map = new Map<string, { latestOrderAt: string; checkPrinted: boolean }>();
            for (const entry of data) {
                map.set(String(entry.tableNumber), {
                    latestOrderAt: entry.latestOrderAt,
                    checkPrinted: entry.checkPrinted || false
                });
            }
            setBusyTables(map);
        } catch {
            // ignore
        }
    };

    const handleVerifyPin = async (pin: string) => {
        try {
            const { data } = await api.post('/auth/verify-pin', { pin });
            if (data.success) {
                setAdminPin(pin);
                setShowPinModal(false);
                setPinInput('');
                setIsEditingOrder(true);
            }
        } catch (error: any) {
            toast.error('Yanlış PİN');
            setPinInput('');
        }
    };

    const handleDeleteOrderItem = async (itemName: string) => {
        try {
            setDeletingItem(itemName);
            await api.post(`/waiter/table-orders/${tableNumber}/delete-item`, { itemName, pin: adminPin });
            toast.success(`${itemName} silindi`);

            // Find the item details from the current tableOrders before updating them
            let deletedPrice = 0;
            for (const order of tableOrders) {
                const item = order.items.find((i: any) => i.name === itemName);
                if (item) {
                    deletedPrice = item.price;
                    break;
                }
            }

            // Queue deleted item for printing later
            setDeletedItemsToPrint(prev => [...prev, { name: itemName, price: deletedPrice }]);

            const { data } = await api.get(`/waiter/table-orders/${tableNumber}`);
            setTableOrders(data);
            if (data.length === 0) {
                setShowOrderPopup(false);
                setIsEditingOrder(false);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Məhsulu silmək mümkün olmadı');
        } finally {
            setDeletingItem(null);
        }
    };

    const formatElapsed = (isoDate: string): string => {
        const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/settings');
            const h = data.halls || [];
            setHalls(h);
            if (h.length > 0) setActiveHall(h[0].name);
        } catch {
            // Use default
        }
    };

    const fetchMenu = async () => {
        try {
            const { data } = await api.get('/waiter/menu');
            setMenuItems(data);
        } catch {
            toast.error('Menyunu yükləmək mümkün olmadı');
        } finally {
            setLoading(false);
        }
    };

    const categories = ['Hamısı', ...Array.from(new Set(menuItems.map((i) => i.category))).sort((a, b) => a.localeCompare(b))];

    const filteredItems = activeCategory === 'Hamısı'
        ? menuItems
        : menuItems.filter((i) => i.category === activeCategory);

    const addToCart = (item: MenuItem) => {
        setCart((prev) => {
            const existing = prev.find((c) => c.menuItemId === item._id);
            if (existing) {
                return prev.map((c) =>
                    c.menuItemId === item._id ? { ...c, quantity: c.quantity + 1 } : c
                );
            }
            return [...prev, { menuItemId: item._id, name: item.name, quantity: 1 }];
        });
    };

    const removeFromCart = (menuItemId: string) => {
        setCart((prev) => {
            const existing = prev.find((c) => c.menuItemId === menuItemId);
            if (existing && existing.quantity > 1) {
                return prev.map((c) =>
                    c.menuItemId === menuItemId ? { ...c, quantity: c.quantity - 1 } : c
                );
            }
            return prev.filter((c) => c.menuItemId !== menuItemId);
        });
    };

    const getCartQty = (menuItemId: string): number => {
        return cart.find((c) => c.menuItemId === menuItemId)?.quantity || 0;
    };

    const handleSubmitOrder = async () => {
        if (cart.length === 0) {
            toast.error('Zəhmət olmasa sifarişə məhsul əlavə edin');
            return;
        }
        if (!tableNumber) {
            toast.error('Zəhmət olmasa masa seçin');
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/waiter/orders', {
                tableNumber,
                items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
            });
            toast.success(`Masa ${tableNumber.includes('-') ? tableNumber.split('-').pop() : tableNumber} üçün sifariş təsdiqləndi!`);
            setCart([]);
            setTableNumber(null);
            setCartOpen(false);
            fetchBusyTables();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Sifarişi təsdiqləmək mümkün olmadı');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBackToTables = () => {
        setTableNumber(null);
        setCart([]);
        setActiveCategory('Hamısı');
        setCartOpen(false);
        setShowLastOrders(false);
        setChangingTable(null);
    };

    const handleChangeTable = () => {
        if (!tableNumber) return;
        setChangingTable(tableNumber);
        setTableNumber(null);
        setCart([]);
        setCartOpen(false);
        setShowLastOrders(false);
    };

    const handleChangeTableSelect = async (newTable: string) => {
        if (!changingTable) return;
        try {
            await api.patch('/waiter/change-table', { fromTable: changingTable, toTable: newTable });
            const displayOld = changingTable.includes('-') ? changingTable.split('-').pop() : changingTable;
            const displayNew = newTable.includes('-') ? newTable.split('-').pop() : newTable;
            toast.success(`Masa ${displayOld} → Masa ${displayNew}`);
            setChangingTable(null);
            setTableNumber(null); // Keep user on table selection screen
            setShowLastOrders(false);
            // Refresh busy tables
            fetchBusyTables();
        } catch {
            toast.error('Masanı dəyişmək mümkün olmadı');
        }
    };

    const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

    const currentHall = halls.find((h) => h.name === activeHall);
    const currentTables = currentHall ? currentHall.tables : [];

    // ─── Cart content (shared between desktop sidebar and mobile drawer) ───
    const cartContent = (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-surface-100 flex items-center gap-2 whitespace-nowrap truncate min-w-0">
                    <HiOutlineShoppingCart className="w-5 h-5 flex-shrink-0 text-brand-400" />
                    <span className="truncate">Sifariş</span>
                </h2>
                {totalItems > 0 && (
                    <span className="badge bg-brand-500/20 text-brand-400 border border-brand-500/30">
                        {totalItems} məhsul
                    </span>
                )}
            </div>

            {cart.length === 0 ? (
                <p className="text-surface-500 text-sm text-center py-8">
                    Hələ heç bir məhsul əlavə edilməyib
                </p>
            ) : (
                <div className="space-y-2">
                    {cart.map((item) => (
                        <div
                            key={item.menuItemId}
                            className="flex items-center justify-between py-2 border-b border-surface-700/50"
                        >
                            <span className="text-sm text-surface-200 flex-1 mr-2">{item.name}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => removeFromCart(item.menuItemId)}
                                    className="w-8 h-8 lg:w-6 lg:h-6 rounded bg-surface-700 text-surface-400 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all text-xs"
                                >
                                    <HiOutlineMinus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center text-sm font-semibold text-brand-400">
                                    {item.quantity}
                                </span>
                                <button
                                    onClick={() => addToCart({ _id: item.menuItemId, name: item.name, category: '', price: 0 })}
                                    className="w-8 h-8 lg:w-6 lg:h-6 rounded bg-brand-500 text-white hover:bg-brand-600 flex items-center justify-center transition-all text-xs"
                                >
                                    <HiOutlinePlus className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => setCart((prev) => prev.filter((c) => c.menuItemId !== item.menuItemId))}
                                    className="w-8 h-8 lg:w-6 lg:h-6 rounded bg-surface-700 text-surface-400 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all text-xs ml-1"
                                >
                                    <HiOutlineX className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <button
                onClick={handleSubmitOrder}
                disabled={cart.length === 0 || submitting}
                className="btn-primary w-full py-3"
            >
                {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <>
                        <HiOutlineCheck className="w-5 h-5" />
                        Sifarişi Təsdiqlə
                    </>
                )}
            </button>

            {/* ─── Order History for this table ─── */}
            {tableOrders.length > 0 && (
                <div className="mt-4 pt-4 border-t border-surface-700/50 space-y-2">
                    <h3 className="text-sm font-semibold text-surface-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <HiOutlineClipboardList className="w-4 h-4" />
                        Əvvəlki Sifarişlər
                    </h3>
                    <div className="max-h-80 overflow-y-auto pr-1">
                        <div
                            onClick={() => setShowOrderPopup(true)}
                            className="bg-surface-800/60 rounded-xl p-3 space-y-1.5 cursor-pointer hover:bg-surface-700/60 transition-all active:scale-[0.98]"
                        >
                            {(() => {
                                const merged = new Map<string, number>();
                                for (const order of tableOrders) {
                                    for (const item of order.items) {
                                        merged.set(item.name, (merged.get(item.name) || 0) + item.quantity);
                                    }
                                }
                                return Array.from(merged.entries()).map(([name, qty]) => (
                                    <div key={name} className="flex items-center justify-between">
                                        <span className="text-sm text-surface-300">{name}</span>
                                        <span className="text-xs font-semibold text-surface-400">×{qty}</span>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Previous Orders Popup (portal to body for full-screen overlay) ─── */}
            {showOrderPopup && tableOrders.length > 0 && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6" onClick={() => !showPinModal && setShowOrderPopup(false)}>
                    {showPinModal ? (
                        <div className="bg-surface-800 p-6 rounded-3xl w-full max-w-sm space-y-8 shadow-2xl border border-surface-700 relative z-50" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-surface-100">Kassir / Admin PİN</h3>
                                <button onClick={() => { setShowPinModal(false); setPinInput(''); }} className="text-surface-400 p-2 hover:bg-surface-700 rounded-full transition-colors">
                                    <HiOutlineX className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-8">
                                <div className="flex justify-center gap-6">
                                    {[0, 1, 2, 3].map((i) => (
                                        <div key={i} className={`w-5 h-5 rounded-full transition-colors duration-200 ${pinInput.length > i ? 'bg-brand-400 shadow-[0_0_12px_rgba(250,204,21,0.6)]' : 'bg-surface-700'}`} />
                                    ))}
                                </div>
                                <div className="grid grid-cols-3 gap-4 max-w-[320px] mx-auto">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(digit => (
                                        <button
                                            key={digit}
                                            className={`h-20 rounded-2xl bg-surface-700 text-3xl font-bold text-surface-100 hover:bg-surface-600 active:bg-surface-500 transition-colors shadow-lg ${digit === 0 ? 'col-start-2' : ''}`}
                                            onClick={() => {
                                                const newPin = pinInput + digit;
                                                if (newPin.length <= 4) {
                                                    setPinInput(newPin);
                                                    if (newPin.length === 4) handleVerifyPin(newPin);
                                                }
                                            }}
                                        >
                                            {digit}
                                        </button>
                                    ))}
                                    <button
                                        className="col-start-3 h-20 flex items-center justify-center rounded-2xl bg-surface-700/50 text-surface-400 hover:bg-surface-600 hover:text-surface-200 active:bg-surface-500 transition-colors shadow-lg"
                                        onClick={() => setPinInput(prev => prev.slice(0, -1))}
                                    >
                                        <HiOutlineArrowLeft className="w-8 h-8" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-surface-900 border border-surface-700/50 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-5 sm:p-6 bg-surface-800/50 border-b border-surface-700/50">
                                <h3 className="text-xl sm:text-2xl font-black text-surface-100 flex items-center gap-3">
                                    <HiOutlineClipboardList className="w-7 h-7 text-brand-400" />
                                    Masa {tableNumber?.includes('-') ? tableNumber.split('-').pop() : tableNumber}
                                    {isEditingOrder && <span className="text-xs sm:text-sm bg-red-500/20 text-red-400 px-3 py-1 rounded-full border border-red-500/20 ml-2">Redaktə Rejimi</span>}
                                </h3>
                                <button onClick={() => setShowOrderPopup(false)} className="text-surface-400 hover:text-white bg-surface-800 p-2.5 rounded-full hover:bg-red-500 transition-all">
                                    <HiOutlineX className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-2">
                                {(() => {
                                    const merged = new Map<string, { qty: number; price: number }>();
                                    for (const order of tableOrders) {
                                        for (const item of order.items) {
                                            const existing = merged.get(item.name);
                                            if (existing) {
                                                existing.qty += item.quantity;
                                            } else {
                                                merged.set(item.name, { qty: item.quantity, price: item.price });
                                            }
                                        }
                                    }
                                    const entries = Array.from(merged.entries());
                                    const total = entries.reduce((sum, [, v]) => sum + v.price * v.qty, 0);
                                    return (
                                        <>
                                            {entries.map(([name, { qty, price }]) => (
                                                <div key={name} className="flex items-center justify-between py-3 border-b border-surface-800 last:border-0 group">
                                                    <div className="flex flex-col">
                                                        <span className="text-base sm:text-lg font-medium text-surface-200">{name}</span>
                                                        <span className="text-sm text-surface-500">{price.toFixed(2)} AZN</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <div className="text-lg font-bold text-surface-100">×{qty}</div>
                                                            <div className="text-sm font-semibold text-brand-400">{(price * qty).toFixed(2)} AZN</div>
                                                        </div>
                                                        {isEditingOrder && (
                                                            <button
                                                                onClick={() => handleDeleteOrderItem(name)}
                                                                disabled={deletingItem === name}
                                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20 shrink-0"
                                                            >
                                                                {deletingItem === name ? (
                                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                ) : (
                                                                    <HiOutlineMinus className="w-5 h-5" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between pt-5 mt-4 border-t border-surface-700">
                                                <span className="text-xl font-bold text-surface-100">Cəmi</span>
                                                <span className="text-2xl font-black text-brand-400">{total.toFixed(2)} AZN</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="p-5 sm:p-6 bg-surface-800/50 border-t border-surface-700/50">
                                {isEditingOrder ? (
                                    <button
                                        onClick={() => {
                                            if (deletedItemsToPrint.length > 0) {
                                                const isCabinet = halls.some(h => h.type === 'cabinet' && h.name === tableNumber);
                                                const displayNum = tableNumber?.includes('-') ? tableNumber?.split('-').pop() : tableNumber;
                                                const hallName = tableNumber?.includes('-') ? tableNumber.substring(0, tableNumber.lastIndexOf('-')) : activeHall;
                                                const tableLabel = isCabinet ? (tableNumber || '') : hallName ? `${hallName} - Masa #${displayNum}` : `Masa #${displayNum}`;

                                                const itemsHtml = '<thead><tr><td style="width: 50%; border-bottom:1px dashed #000;padding-bottom:3px">Məhsul adı</td><td style="width: 20%; text-align:center;border-bottom:1px dashed #000;padding-bottom:3px">Say</td><td style="width: 30%; text-align:right;border-bottom:1px dashed #000;padding-bottom:3px">Qiymət</td></tr></thead><tbody>' +
                                                    deletedItemsToPrint.map(item => `<tr><td style="color:red; text-decoration:line-through; font-style:italic">Ləğv: ${item.name}</td><td style="text-align:center">-1</td><td style="text-align:right">-${item.price.toFixed(2)}</td></tr>`).join('') + '</tbody>';

                                                const totalDeletedPrice = deletedItemsToPrint.reduce((sum, item) => sum + item.price, 0);

                                                const receiptHtml = [
                                                    '<!DOCTYPE html><html><head><title>Check</title>',
                                                    '<style>',
                                                    '@page { size: 80mm auto; margin: 0 }',
                                                    '* { margin: 0; padding: 0; box-sizing: border-box }',
                                                    "body { font-family: 'Courier New', monospace; width: 72mm; min-height: 80mm; margin: 0 auto; padding: 5mm 4mm; font-size: 16px; line-height: 1.5 }",
                                                    '.pub { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 3mm; letter-spacing: 1px }',
                                                    'h3 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 2mm }',
                                                    '.info { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; padding-bottom: 2mm; margin-bottom: 3mm; border-bottom: 1px dashed #000 }',
                                                    'table { width: 100%; border-collapse: collapse; margin: 3mm 0 }',
                                                    'td { font-size: 16px; font-weight: bold; padding: 4px 0 }',
                                                    '.t { border-top: 2px dashed #000; font-weight: bold; font-size: 18px; padding-top: 3mm; margin-top: 3mm; text-align: right; color: red }',
                                                    '.f { text-align: center; margin-top: 4mm; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; border-top: 1px dashed #000; padding-top: 3mm }',
                                                    '</style></head>',
                                                    '<body>',
                                                    '<div class="pub">Artıbir</div>',
                                                    `<h3>${tableLabel}</h3>`,
                                                    '<div class="info">',
                                                    `<span>Ofisiant: ${user?.username || ''}</span>`,
                                                    `<span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>`,
                                                    '</div>',
                                                    `<table>${itemsHtml}</table>`,
                                                    `<div class="t">LƏĞV EDİLDİ (QAYTARILACAQ): ${totalDeletedPrice.toFixed(2)} AZN</div>`,
                                                    '<div class="f">LƏĞV ÇEKİ</div>',
                                                    '</body></html>',
                                                ].join('');

                                                const iframe = document.createElement('iframe');
                                                iframe.style.position = 'fixed';
                                                iframe.style.top = '-10000px';
                                                iframe.style.left = '-10000px';
                                                iframe.style.width = '80mm';
                                                iframe.style.height = '0';
                                                document.body.appendChild(iframe);
                                                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                                                if (doc) {
                                                    doc.open();
                                                    doc.write(receiptHtml);
                                                    doc.close();
                                                    setTimeout(() => {
                                                        iframe.contentWindow?.print();
                                                        setTimeout(() => document.body.removeChild(iframe), 500);
                                                    }, 250);
                                                }
                                                setDeletedItemsToPrint([]);
                                            }
                                            setIsEditingOrder(false);
                                            setAdminPin('');
                                            setShowOrderPopup(false);
                                        }}
                                        className="w-full py-4 rounded-2xl text-lg font-bold bg-surface-700 text-white hover:bg-surface-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <HiOutlineCheck className="w-6 h-6" />
                                        Bitdi
                                    </button>
                                ) : (
                                    <div className="flex gap-4">
                                        <button
                                            onClick={async () => {
                                                const merged2 = new Map<string, { qty: number; price: number }>();
                                                for (const order of tableOrders) {
                                                    for (const item of order.items) {
                                                        const ex = merged2.get(item.name);
                                                        if (ex) { ex.qty += item.quantity; }
                                                        else { merged2.set(item.name, { qty: item.quantity, price: item.price }); }
                                                    }
                                                }
                                                const isCabinet = halls.some(h => h.type === 'cabinet' && h.name === tableNumber);
                                                const displayNum = tableNumber?.includes('-') ? tableNumber.split('-').pop() : tableNumber;
                                                const hallName = tableNumber?.includes('-') ? tableNumber.substring(0, tableNumber.lastIndexOf('-')) : activeHall;
                                                const tableLabel = isCabinet ? (tableNumber || '') : hallName ? `${hallName} - Masa #${displayNum}` : `Masa #${displayNum}`;
                                                const entries2 = Array.from(merged2.entries());
                                                const receiptTotal = entries2.reduce((sum, [, v]) => sum + v.price * v.qty, 0);
                                                const itemsHtml = '<thead><tr><td style="width: 50%; border-bottom:1px dashed #000;padding-bottom:3px">Məhsul adı</td><td style="width: 20%; text-align:center;border-bottom:1px dashed #000;padding-bottom:3px">Say</td><td style="width: 30%; text-align:right;border-bottom:1px dashed #000;padding-bottom:3px">Qiymət</td></tr></thead><tbody>' + entries2.map(([name, { qty, price }]) =>
                                                    `<tr><td>${name}</td><td style="text-align:center">${qty}</td><td style="text-align:right">${(price * qty).toFixed(2)}</td></tr>`
                                                ).join('') + '</tbody>';
                                                const receiptHtml = [
                                                    '<!DOCTYPE html><html><head><title>Check</title>',
                                                    '<style>',
                                                    '@page { size: 80mm auto; margin: 0 }',
                                                    '* { margin: 0; padding: 0; box-sizing: border-box }',
                                                    "body { font-family: 'Courier New', monospace; width: 72mm; min-height: 80mm; margin: 0 auto; padding: 5mm 4mm; font-size: 16px; line-height: 1.5 }",
                                                    '.pub { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 3mm; letter-spacing: 1px }',
                                                    'h3 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 2mm }',
                                                    '.info { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; padding-bottom: 2mm; margin-bottom: 3mm; border-bottom: 1px dashed #000 }',
                                                    'table { width: 100%; border-collapse: collapse; margin: 3mm 0 }',
                                                    'td { font-size: 16px; font-weight: bold; padding: 4px 0 }',
                                                    '.t { border-top: 2px dashed #000; font-weight: bold; font-size: 18px; padding-top: 3mm; margin-top: 3mm; text-align: right }',
                                                    '.f { text-align: center; margin-top: 4mm; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; border-top: 1px dashed #000; padding-top: 3mm }',
                                                    '</style></head>',
                                                    '<body>',
                                                    '<div class="pub">Artıbir</div>',
                                                    `<h3>${tableLabel}</h3>`,
                                                    '<div class="info">',
                                                    `<span>Ofisiant: ${user?.username || ''}</span>`,
                                                    `<span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>`,
                                                    '</div>',
                                                    `<table>${itemsHtml}</table>`,
                                                    `<div class="t">Cəmi: ${receiptTotal.toFixed(2)} AZN</div>`,
                                                    '<div class="f">Təşəkkürlər</div>',
                                                    '</body></html>',
                                                ].join('');

                                                const iframe = document.createElement('iframe');
                                                iframe.style.position = 'fixed';
                                                iframe.style.top = '-10000px';
                                                iframe.style.left = '-10000px';
                                                iframe.style.width = '80mm';
                                                iframe.style.height = '0';
                                                document.body.appendChild(iframe);
                                                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                                                if (doc) {
                                                    doc.open();
                                                    doc.write(receiptHtml);
                                                    doc.close();
                                                    setTimeout(() => {
                                                        iframe.contentWindow?.print();
                                                        setTimeout(() => document.body.removeChild(iframe), 500);
                                                    }, 250);
                                                }

                                                try {
                                                    await api.post(`/waiter/table-orders/${tableNumber}/print-check`);
                                                    toast.success('Çek çap edilir');
                                                    setShowOrderPopup(false);
                                                    handleBackToTables();
                                                } catch (error) {
                                                    toast.error('Çek çap edilərkən xəta baş verdi');
                                                }
                                            }}
                                            className="flex-1 py-4 rounded-2xl text-lg font-bold bg-blue-500 text-white hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/25"
                                        >
                                            Çek Çap Et
                                        </button>
                                        <button
                                            onClick={() => setShowPinModal(true)}
                                            className="flex-1 py-4 rounded-2xl text-lg font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/20"
                                        >
                                            Sifarişi Sil
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );


    // ─── STEP 1: Table Selection ───
    if (tableNumber === null) {
        return (
            <Layout
                title="Ofisiant Paneli"
                navItems={[
                    { label: 'Yeni Sifariş', path: '/waiter' },
                    { label: 'Sifarişlərim', path: '/waiter/orders' },
                ]}
            >
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-surface-100">Masa Seçin</h2>
                        <p className="text-surface-400 text-sm">Yeni sifarişə başlamaq üçün masa nömrəsini seçin</p>
                    </div>

                    {/* Hall tabs & Cabinet buttons */}
                    {halls.length > 0 && (
                        <div className="flex items-center gap-2 justify-center flex-wrap">
                            {halls.filter((h) => h.type !== 'cabinet').length > 1 && halls.filter((h) => h.type !== 'cabinet').map((hall) => (
                                <button
                                    key={hall.name}
                                    onClick={() => setActiveHall(hall.name)}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeHall === hall.name
                                        ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                                        : 'bg-surface-800 border border-surface-700/50 text-surface-400 hover:bg-surface-700 hover:text-surface-200'
                                        }`}
                                >
                                    {hall.name}
                                </button>
                            ))}
                            {halls.filter((h) => h.type !== 'cabinet').length === 1 && (
                                <span className="text-surface-400 text-sm font-medium">{halls.find((h) => h.type !== 'cabinet')?.name}</span>
                            )}
                        </div>
                    )}

                    {/* Change table banner */}
                    {changingTable && (
                        <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-stretch justify-between overflow-hidden">
                            <div className="flex items-center gap-2 p-4">
                                <HiOutlineSwitchHorizontal className="w-5 h-5 text-amber-400" />
                                <span className="text-sm font-semibold text-amber-300">
                                    Masa {changingTable.includes('-') ? changingTable.split('-').pop() : changingTable} köçürülür → Yeni masa seçin
                                </span>
                            </div>
                            <button
                                onClick={() => setChangingTable(null)}
                                className="text-sm px-6 rounded-none bg-surface-700 text-surface-200 hover:bg-surface-600 font-semibold transition-all flex items-center justify-center"
                            >
                                Ləğv et
                            </button>
                        </div>
                    )}

                    {/* Table grid for active hall */}
                    {currentHall && currentHall.type !== 'cabinet' && (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                            {currentTables.map((t) => {
                                const hallKey = `${activeHall}-${t}`;
                                const busyAt = busyTables.get(hallKey);
                                const isBusy = !!busyAt;
                                const isPrinted = busyAt?.checkPrinted;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            if (changingTable) {
                                                handleChangeTableSelect(hallKey);
                                            } else {
                                                setTableNumber(hallKey);
                                                if (!isBusy) setActiveCategory('Hamısı');
                                                if (isBusy) setShowLastOrders(true);
                                            }
                                        }}
                                        className={`aspect-square rounded-2xl text-xl font-bold transition-all active:scale-95 relative flex flex-col items-center justify-center ${isBusy && !isPrinted
                                            ? 'bg-red-500/15 border-2 border-red-500/50 text-red-400 hover:bg-red-500/25 hover:border-red-500/70 shadow-lg shadow-red-500/10'
                                            : isBusy && isPrinted
                                                ? 'bg-amber-500/15 border-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/25 hover:border-amber-500/70 shadow-lg shadow-amber-500/10'
                                                : 'bg-surface-800 border border-surface-700/50 text-surface-300 hover:bg-brand-500 hover:text-white hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/20 hover:scale-105'
                                            }`}
                                    >
                                        {t}
                                        {isBusy && !isPrinted && busyAt && (
                                            <>
                                                <span className="text-xs font-semibold text-red-400 mt-1">{formatElapsed(busyAt.latestOrderAt)}</span>
                                                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                            </>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Cabinet buttons */}
                    {halls.some((h) => h.type === 'cabinet') && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-surface-400 text-center uppercase tracking-wider">Kabinetlər</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {halls.filter((h) => h.type === 'cabinet').map((cab) => {
                                    const busyAt = busyTables.get(cab.name);
                                    const isBusy = !!busyAt;
                                    const isPrinted = busyAt?.checkPrinted;
                                    return (
                                        <button
                                            key={cab.name}
                                            onClick={() => {
                                                if (changingTable) {
                                                    handleChangeTableSelect(cab.name);
                                                } else {
                                                    setTableNumber(cab.name);
                                                    if (!isBusy) setActiveCategory('Hamısı');
                                                    if (isBusy) setShowLastOrders(true);
                                                }
                                            }}
                                            className={`py-4 px-6 rounded-2xl text-base font-bold transition-all active:scale-95 relative ${isBusy && !isPrinted
                                                ? 'bg-red-500/15 border-2 border-red-500/50 text-red-400 hover:bg-red-500/25 hover:border-red-500/70 shadow-lg shadow-red-500/10'
                                                : isBusy && isPrinted
                                                    ? 'bg-amber-500/15 border-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/25 hover:border-amber-500/70 shadow-lg shadow-amber-500/10'
                                                    : 'bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500 hover:text-white hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-105'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                🚪 {cab.name}
                                                {isBusy && !isPrinted && busyAt && (
                                                    <span className="text-xs font-medium text-red-400/80">{formatElapsed(busyAt.latestOrderAt)}</span>
                                                )}
                                            </span>
                                            {isBusy && !isPrinted && busyAt && (
                                                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {currentTables.length === 0 && currentHall?.type !== 'cabinet' && (
                        <p className="text-center text-surface-500 py-8">Bu zalda masa yoxdur. Masaları qurmaq üçün adminə müraciət edin.</p>
                    )}
                </div>
            </Layout>
        );
    }

    // ─── STEP 2: Menu Selection & Order ───
    return (
        <Layout
            title="Ofisiant Paneli"
            navItems={[
                { label: 'Yeni Sifariş', path: '/waiter' },
                { label: 'Sifarişlərim', path: '/waiter/orders' },
            ]}
        >
            {/* ─── Mobile: horizontal category pills ─── */}
            <div className="lg:hidden sticky top-16 z-40 bg-surface-950 pb-3 pt-3 -mx-4 px-4 sm:-mx-6 sm:px-6 space-y-3">
                <div className="relative flex items-center justify-between rounded-xl bg-surface-800 border border-surface-700/50 px-2 py-1.5">
                    <button
                        onClick={handleBackToTables}
                        className="px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all
                            text-surface-300 hover:bg-surface-700 hover:text-surface-100 flex items-center gap-1"
                    >
                        <HiOutlineArrowLeft className="w-4 h-4" />
                        Geri
                    </button>
                    {tableNumber && busyTables.has(tableNumber) && (
                        <button
                            onClick={handleChangeTable}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                                text-amber-400 hover:bg-amber-500/15 flex items-center gap-1"
                        >
                            <HiOutlineSwitchHorizontal className="w-3.5 h-3.5" />
                            Dəyiş
                        </button>
                    )}
                    {halls.some(h => h.type === 'cabinet' && h.name === tableNumber) ? (
                        <span className="font-semibold text-surface-100 text-sm absolute left-1/2 -translate-x-1/2">{tableNumber}</span>
                    ) : (
                        <>
                            <span className="font-semibold text-surface-100 text-sm absolute left-1/2 -translate-x-1/2">{activeHall}</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-surface-400 text-xs font-medium">Masa</span>
                                <span className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-brand-500/30">
                                    {tableNumber?.includes('-') ? tableNumber.split('-').pop() : tableNumber}
                                </span>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                    {tableNumber && busyTables.has(tableNumber) && (
                        <button
                            onClick={() => { setShowLastOrders(!showLastOrders); setActiveCategory('Hamısı'); }}
                            className={`flex-shrink-0 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${showLastOrders
                                ? 'bg-amber-500 text-white'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                }`}
                        >
                            <HiOutlineRefresh className="w-4 h-4" />
                            Son Sifarişlər
                        </button>
                    )}
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => { setShowLastOrders(false); setActiveCategory(cat); }}
                            className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${!showLastOrders && activeCategory === cat
                                ? 'bg-brand-500 text-white'
                                : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                                }`}
                        >
                            {cat.toUpperCase()}
                        </button>
                    ))}
                </div>
                <div className="flex items-center justify-between">
                    <span className="font-bold text-surface-100" style={{ fontSize: '1.2rem' }}>Menyu</span>
                    <button
                        onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                        className="p-2 rounded-xl bg-surface-800 text-surface-400 hover:text-surface-200 transition-all"
                    >
                        {viewMode === 'grid' ? <HiOutlineViewList className="w-5 h-5" /> : <HiOutlineViewGrid className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="flex gap-4 h-full">
                {/* Left sidebar — Desktop only */}
                <div className="w-48 flex-shrink-0 hidden lg:block">
                    <div className="sticky top-24 space-y-3">
                        <button
                            onClick={handleBackToTables}
                            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all
                                bg-surface-800 border border-surface-700/50 text-surface-300
                                hover:bg-surface-700 hover:text-surface-100 flex items-center gap-2"
                        >
                            <HiOutlineArrowLeft className="w-4 h-4" />
                            Masalara Qayıt
                        </button>

                        {tableNumber && busyTables.has(tableNumber) && (
                            <button
                                onClick={handleChangeTable}
                                className="w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2
                                    bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
                            >
                                <HiOutlineSwitchHorizontal className="w-4 h-4" />
                                Masanı Dəyiş
                            </button>
                        )}

                        {tableNumber && busyTables.has(tableNumber) && (
                            <button
                                onClick={() => { setShowLastOrders(!showLastOrders); setActiveCategory('Hamısı'); }}
                                className={`w-full px-4 py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${showLastOrders
                                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                                    }`}
                            >
                                <HiOutlineRefresh className="w-4 h-4" />
                                Son Sifarişlər
                            </button>
                        )}

                        {(
                            <div className="card p-3 space-y-1">
                                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider px-3 mb-2">Kateqoriyalar</h3>
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => { setShowLastOrders(false); setActiveCategory(cat); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${!showLastOrders && activeCategory === cat
                                            ? 'bg-brand-500 text-white'
                                            : 'text-surface-400 hover:bg-surface-700 hover:text-surface-200'
                                            }`}
                                    >
                                        {cat.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center — Menu items */}
                <div className="flex-1 min-w-0 space-y-4">


                    {/* Menu grid or Last Orders */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : showLastOrders ? (
                        <div className={`gap-3 pb-24 lg:pb-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2`}>
                            {(() => {
                                const merged = new Map<string, number>();
                                for (const order of tableOrders) {
                                    for (const item of order.items) {
                                        merged.set(item.name, (merged.get(item.name) || 0) + item.quantity);
                                    }
                                }
                                return Array.from(merged.entries()).map(([name, prevQty]) => {
                                    const menuItem = menuItems.find(m => m.name === name);
                                    if (!menuItem) return null;
                                    const qty = getCartQty(menuItem._id);
                                    return (
                                        <div
                                            key={name}
                                            onClick={() => addToCart(menuItem)}
                                            className={`card flex flex-col items-center justify-center text-center p-4 transition-all cursor-pointer
                                                hover:border-amber-500/30 hover:bg-amber-500/5 active:scale-[0.98] relative
                                                ${qty > 0 ? 'border-amber-500/50 bg-amber-500/5' : 'border-amber-500/20'}`}
                                        >
                                            <h3 className="font-semibold text-surface-100 text-sm">{name}</h3>
                                            <p className="text-xs text-amber-400/70 mt-0.5">{menuItem.price.toFixed(2)} AZN · əvvəlki ×{prevQty}</p>
                                            {qty > 0 && (
                                                <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-md bg-brand-500 text-white flex items-center justify-center font-bold text-xs shadow-lg shadow-brand-500/30">
                                                    {qty}
                                                </span>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ) : (
                        <div className={`gap-3 pb-24 lg:pb-0 ${viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2' : 'grid grid-cols-1 sm:grid-cols-2'}`}>
                            {filteredItems.map((item) => {
                                const qty = getCartQty(item._id);
                                return viewMode === 'grid' ? (
                                    <div
                                        key={item._id}
                                        onClick={() => addToCart(item)}
                                        className={`card flex flex-col items-center justify-center text-center p-4 transition-all cursor-pointer
                                            hover:border-brand-500/30 hover:bg-brand-500/5 active:scale-[0.98] relative
                                            ${qty > 0 ? 'border-brand-500/50 bg-brand-500/5' : ''}`}
                                    >
                                        <h3 className="font-semibold text-surface-100 text-sm">{item.name}</h3>
                                        <p className="text-xs text-surface-500 mt-0.5">{item.price.toFixed(2)} AZN</p>
                                        {qty > 0 && (
                                            <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-md bg-brand-500 text-white flex items-center justify-center font-bold text-xs shadow-lg shadow-brand-500/30">
                                                {qty}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        key={item._id}
                                        onClick={() => addToCart(item)}
                                        className={`card flex items-center justify-between transition-all cursor-pointer
                                            hover:border-brand-500/30 hover:bg-brand-500/5 active:scale-[0.98]
                                            ${qty > 0 ? 'border-brand-500/50 bg-brand-500/5' : ''}`}
                                    >
                                        <div>
                                            <h3 className="font-semibold text-surface-100">{item.name}</h3>
                                            <p className="text-xs text-surface-400">{item.price.toFixed(2)} AZN</p>
                                        </div>
                                        {qty > 0 && (
                                            <span className="min-w-7 h-7 px-2 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-brand-500/30">
                                                {qty}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right sidebar — Desktop only */}
                <div className="w-72 flex-shrink-0 hidden lg:block">
                    <div className="card sticky top-24">
                        {cartContent}
                    </div>
                </div>
            </div>

            {/* ─── Mobile: Floating cart button ─── */}
            <button
                onClick={() => setCartOpen(true)}
                className="lg:hidden fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-brand-500 text-white
                    shadow-xl shadow-brand-500/40 flex items-center justify-center
                    hover:bg-brand-600 active:scale-95 transition-all"
            >
                <HiOutlineShoppingCart className="w-7 h-7" />
                {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                        {totalItems}
                    </span>
                )}
            </button>

            {/* ─── Mobile: Cart drawer overlay ─── */}
            {
                cartOpen && (
                    <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setCartOpen(false)}
                        />
                        {/* Drawer */}
                        <div className="relative mt-auto bg-surface-900 border-t border-surface-700/50 rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto animate-slide-up">
                            <div className="flex items-center justify-between mb-4">
                                <span className="w-10 h-1 rounded-full bg-surface-600 absolute top-3 left-1/2 -translate-x-1/2" />
                                <div />
                                <button
                                    onClick={() => setCartOpen(false)}
                                    className="btn-ghost btn-sm"
                                >
                                    <HiOutlineX className="w-5 h-5" />
                                </button>
                            </div>
                            {cartContent}
                        </div>
                    </div>
                )
            }
        </Layout >
    );
};

export default WaiterDashboard;
