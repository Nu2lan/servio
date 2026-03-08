import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineMinus, HiOutlineShoppingCart, HiOutlineCheck, HiOutlineArrowLeft, HiOutlineX, HiOutlineViewGrid, HiOutlineViewList, HiOutlineClipboardList } from 'react-icons/hi';

interface MenuItem {
    _id: string;
    name: string;
    category: string;
}

interface CartItem {
    menuItemId: string;
    name: string;
    quantity: number;
}

interface TableOrder {
    _id: string;
    items: { name: string; quantity: number }[];
    createdAt: string;
}

interface Hall {
    name: string;
    tables: number[];
    type: 'hall' | 'cabinet';
}

const IDLE_TIMEOUT_MS = 5000; // 5 seconds

const WaiterDashboard: React.FC = () => {
    const { logout } = useAuth();
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
    const [busyTables, setBusyTables] = useState<Map<string, string>>(new Map());
    const [tableOrders, setTableOrders] = useState<TableOrder[]>([]);
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
            setBusyTables((prev) => new Map(prev).set(String(data.tableNumber), data.latestOrderAt));
        });
        return () => {
            socket.off('table-freed');
            socket.off('table-busy');
        };
    }, []);

    const fetchBusyTables = async () => {
        try {
            const { data } = await api.get('/waiter/busy-tables');
            const map = new Map<string, string>();
            for (const entry of data) {
                map.set(String(entry.tableNumber), entry.latestOrderAt);
            }
            setBusyTables(map);
        } catch {
            // ignore
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
            toast.error('Failed to load menu');
        } finally {
            setLoading(false);
        }
    };

    const categories = ['All', ...Array.from(new Set(menuItems.map((i) => i.category))).sort((a, b) => a.localeCompare(b))];

    const filteredItems = activeCategory === 'All'
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
            toast.error('Please add items to the order');
            return;
        }
        if (!tableNumber) {
            toast.error('Please select a table');
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/waiter/orders', {
                tableNumber,
                items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
            });
            toast.success(`Order for Table ${tableNumber} confirmed!`);
            setCart([]);
            setTableNumber(null);
            setCartOpen(false);
            fetchBusyTables();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to submit order');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBackToTables = () => {
        setTableNumber(null);
        setCart([]);
        setActiveCategory('All');
        setCartOpen(false);
    };

    const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);

    const currentHall = halls.find((h) => h.name === activeHall);
    const currentTables = currentHall ? currentHall.tables : [];

    // ─── Cart content (shared between desktop sidebar and mobile drawer) ───
    const cartContent = (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-surface-100 flex items-center gap-2">
                    <HiOutlineShoppingCart className="w-5 h-5 text-brand-400" />
                    Order — Table {tableNumber}
                </h2>
                {totalItems > 0 && (
                    <span className="badge bg-brand-500/20 text-brand-400 border border-brand-500/30">
                        {totalItems} items
                    </span>
                )}
            </div>

            {cart.length === 0 ? (
                <p className="text-surface-500 text-sm text-center py-8">
                    No items added yet
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
                                    onClick={() => addToCart({ _id: item.menuItemId, name: item.name, category: '' })}
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
                        Confirm Order
                    </>
                )}
            </button>

            {/* ─── Order History for this table ─── */}
            {tableOrders.length > 0 && (
                <div className="mt-4 pt-4 border-t border-surface-700/50 space-y-2">
                    <h3 className="text-sm font-semibold text-surface-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <HiOutlineClipboardList className="w-4 h-4" />
                        Previous Orders
                    </h3>
                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                        {tableOrders.map((order) => (
                            <div key={order._id} className="bg-surface-800/60 rounded-xl p-3 space-y-1.5">
                                <span className="text-xs text-surface-500">
                                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </span>
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <span className="text-sm text-surface-300">{item.name}</span>
                                        <span className="text-xs font-semibold text-surface-400">×{item.quantity}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    // ─── STEP 1: Table Selection ───
    if (tableNumber === null) {
        return (
            <Layout
                title="Waiter Panel"
                navItems={[
                    { label: 'New Order', path: '/waiter' },
                    { label: 'My Orders', path: '/waiter/orders' },
                ]}
            >
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-surface-100">Select a Table</h2>
                        <p className="text-surface-400 text-sm">Choose the table number to start a new order</p>
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

                    {/* Table grid for active hall */}
                    {currentHall && currentHall.type !== 'cabinet' && (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                            {currentTables.map((t) => {
                                const busyAt = busyTables.get(String(t));
                                const isBusy = !!busyAt;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => setTableNumber(String(t))}
                                        className={`aspect-square rounded-2xl text-xl font-bold transition-all active:scale-95 relative flex flex-col items-center justify-center ${isBusy
                                            ? 'bg-red-500/15 border-2 border-red-500/50 text-red-400 hover:bg-red-500/25 hover:border-red-500/70 shadow-lg shadow-red-500/10'
                                            : 'bg-surface-800 border border-surface-700/50 text-surface-300 hover:bg-brand-500 hover:text-white hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/20 hover:scale-105'
                                            }`}
                                    >
                                        {t}
                                        {isBusy && (
                                            <>
                                                <span className="text-xs font-semibold text-red-400 mt-1">{formatElapsed(busyAt)}</span>
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
                            <h3 className="text-sm font-semibold text-surface-400 text-center uppercase tracking-wider">Cabinets</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {halls.filter((h) => h.type === 'cabinet').map((cab) => {
                                    const busyAt = busyTables.get(cab.name);
                                    const isBusy = !!busyAt;
                                    return (
                                        <button
                                            key={cab.name}
                                            onClick={() => setTableNumber(cab.name)}
                                            className={`py-4 px-6 rounded-2xl text-base font-bold transition-all active:scale-95 relative ${isBusy
                                                ? 'bg-red-500/15 border-2 border-red-500/50 text-red-400 hover:bg-red-500/25 hover:border-red-500/70 shadow-lg shadow-red-500/10'
                                                : 'bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500 hover:text-white hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-105'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                🚪 {cab.name}
                                                {isBusy && (
                                                    <span className="text-xs font-medium text-red-400/80">{formatElapsed(busyAt)}</span>
                                                )}
                                            </span>
                                            {isBusy && (
                                                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {currentTables.length === 0 && currentHall?.type !== 'cabinet' && (
                        <p className="text-center text-surface-500 py-8">No tables in this hall. Ask admin to set up tables.</p>
                    )}
                </div>
            </Layout>
        );
    }

    // ─── STEP 2: Menu Selection & Order ───
    return (
        <Layout
            title="Waiter Panel"
            navItems={[
                { label: 'New Order', path: '/waiter' },
                { label: 'My Orders', path: '/waiter/orders' },
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
                        Back
                    </button>
                    {halls.some(h => h.type === 'cabinet' && h.name === tableNumber) ? (
                        <span className="font-semibold text-surface-100 text-sm absolute left-1/2 -translate-x-1/2">{tableNumber}</span>
                    ) : (
                        <>
                            <span className="font-semibold text-surface-100 text-sm absolute left-1/2 -translate-x-1/2">{activeHall}</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-surface-400 text-xs font-medium">Table</span>
                                <span className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-brand-500/30">
                                    {tableNumber}
                                </span>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat
                                ? 'bg-brand-500 text-white'
                                : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                                }`}
                        >
                            {cat.toUpperCase()}
                        </button>
                    ))}
                </div>
                <div className="flex items-center justify-between">
                    <span className="font-bold text-surface-100" style={{ fontSize: '1.2rem' }}>Menu</span>
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
                            Back to Tables
                        </button>

                        <div className="card p-3 space-y-1">
                            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider px-3 mb-2">Categories</h3>
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeCategory === cat
                                        ? 'bg-brand-500 text-white'
                                        : 'text-surface-400 hover:bg-surface-700 hover:text-surface-200'
                                        }`}
                                >
                                    {cat.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center — Menu items */}
                <div className="flex-1 min-w-0 space-y-4">


                    {/* Menu grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
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
                                        <p className="text-xs text-surface-500 mt-0.5">{item.category.toUpperCase()}</p>
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
                                            <p className="text-xs text-surface-400">{item.category.toUpperCase()}</p>
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
