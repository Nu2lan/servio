import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';
import { HiOutlineCash, HiOutlineCheck, HiOutlineViewGrid, HiOutlineViewList, HiOutlinePrinter } from 'react-icons/hi';

interface OrderItem {
    name: string;
    quantity: number;
    price: number;
}

interface Order {
    _id: string;
    tableNumber: string;
    items: OrderItem[];
    totalPrice: number;
    status: string;
    createdAt: string;
    paidAt?: string;
    createdBy?: { _id: string; username: string };
    checkPrinted?: boolean;
}

interface Hall {
    name: string;
    tables: number[];
    type?: string;
}

interface GroupedOrder {
    tableNumber: string;
    items: OrderItem[];
    totalPrice: number;
    status: string;
    latestTime: string;
    orderCount: number;
    orderIds: string[];
    waiterNames: string[];
    checkPrinted: boolean;
}

const CashierDashboard: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'confirmed' | 'paid'>('confirmed');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [halls, setHalls] = useState<Hall[]>([]);
    const [activeTab, setActiveTab] = useState<string>('all');


    useEffect(() => {
        fetchOrders();
        fetchSettings();
        const socket = getSocket();

        socket.on('new-order', (order: Order) => {
            setOrders((prev) => [order, ...prev]);
            toast.success(`New order — Table #${order.tableNumber}`, { icon: '🔔' });
        });

        return () => {
            socket.off('new-order');
        };
    }, []);

    const fetchOrders = async () => {
        try {
            const { data } = await api.get('/cashier/orders');
            setOrders(data);
        } catch {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/settings');
            setHalls(data.halls || []);
        } catch {
            // ignore
        }
    };

    const getOrderHall = (order: Order): string | null => {
        const cabinet = halls.find(h => h.type === 'cabinet' && h.name === order.tableNumber);
        if (cabinet) return cabinet.name;
        const tableNum = parseInt(order.tableNumber);
        if (!isNaN(tableNum)) {
            const hall = halls.find(h => h.type !== 'cabinet' && h.tables.includes(tableNum));
            if (hall) return hall.name;
        }
        return null;
    };

    const isCabinetOrder = (order: Order): boolean => {
        return halls.some(h => h.type === 'cabinet' && h.name === order.tableNumber);
    };
    const handlePrintCheck = async (groupKey: string, group: GroupedOrder) => {
        const isCabinet = halls.some(h => h.type === 'cabinet' && h.name === group.tableNumber);
        const tableNum = parseInt(group.tableNumber);
        const hall = !isCabinet && !isNaN(tableNum) ? halls.find(h => h.type !== 'cabinet' && h.tables.includes(tableNum)) : null;
        const tableLabel = isCabinet ? group.tableNumber : hall ? `${hall.name} - Table #${group.tableNumber}` : `Table #${group.tableNumber}`;
        const itemsHtml = group.items.map(item =>
            `<tr><td>${item.name}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${(item.price * item.quantity).toFixed(2)}</td></tr>`
        ).join('');
        const waiterLabel = group.waiterNames.length > 0 ? group.waiterNames.join(', ') : '';
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
            waiterLabel ? `<span>Ofisiant: ${waiterLabel}</span>` : '<span></span>',
            `<span>${new Date(group.latestTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>`,
            '</div>',
            `<table>${itemsHtml}</table>`,
            `<div class="t">Total: ${group.totalPrice.toFixed(2)} AZN</div>`,
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
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 500);
            }, 250);
        }

        try {
            await api.patch('/cashier/orders/print-check', { orderIds: group.orderIds });
            setOrders(prev => prev.map(o => group.orderIds.includes(o._id) ? { ...o, checkPrinted: true } : o));
            toast.success('Check printed');
        } catch {
            toast.error('Failed to save print status');
        }
    };

    const togglePay = async (orderId: string) => {
        try {
            const { data } = await api.patch(`/cashier/orders/${orderId}/pay`);
            setOrders((prev) =>
                prev.map((o) => (o._id === orderId ? data : o))
            );
            toast.success(data.status === 'paid' ? 'Order marked as paid' : 'Order marked as unpaid');
        } catch {
            toast.error('Failed to update order');
        }
    };

    const togglePayGroup = async (orderIds: string[]) => {
        try {
            for (const id of orderIds) {
                const { data } = await api.patch(`/cashier/orders/${id}/pay`);
                setOrders((prev) =>
                    prev.map((o) => (o._id === id ? data : o))
                );
            }
            toast.success(`${orderIds.length} order(s) marked as paid`);
        } catch {
            toast.error('Failed to update orders');
        }
    };

    // Only hall tabs (cabinets grouped under one tab)
    const hallTabs = halls.filter(h => h.type !== 'cabinet');
    const hasCabinets = halls.some(h => h.type === 'cabinet');

    // Filter by tab then by status
    const tabFilteredOrders = activeTab === 'all'
        ? orders
        : activeTab === 'cabinets'
            ? orders.filter(o => isCabinetOrder(o))
            : orders.filter(o => getOrderHall(o) === activeTab);
    const filteredOrders = filter === 'all' ? tabFilteredOrders : tabFilteredOrders.filter((o) => o.status === filter);

    const getTabOrderCount = (hallName: string): number => {
        return orders.filter(o => getOrderHall(o) === hallName).length;
    };

    const cabinetOrderCount = orders.filter(o => isCabinetOrder(o)).length;

    // Group confirmed orders by table, keep paid orders separate
    const groupedOrders: GroupedOrder[] = (() => {
        const confirmedMap = new Map<string, GroupedOrder>();
        const result: GroupedOrder[] = [];

        for (const order of filteredOrders) {
            if (order.status === 'confirmed') {
                const existing = confirmedMap.get(order.tableNumber);
                if (existing) {
                    for (const item of order.items) {
                        const existingItem = existing.items.find(i => i.name === item.name);
                        if (existingItem) {
                            existingItem.quantity += item.quantity;
                        } else {
                            existing.items.push({ ...item });
                        }
                    }
                    existing.totalPrice += order.totalPrice;
                    existing.orderCount++;
                    existing.orderIds.push(order._id);
                    if (order.createdBy?.username && !existing.waiterNames.includes(order.createdBy.username)) {
                        existing.waiterNames.push(order.createdBy.username);
                    }
                    if (order.createdAt > existing.latestTime) {
                        existing.latestTime = order.createdAt;
                    }
                } else {
                    confirmedMap.set(order.tableNumber, {
                        tableNumber: order.tableNumber,
                        items: order.items.map(i => ({ ...i })),
                        totalPrice: order.totalPrice,
                        status: 'confirmed',
                        latestTime: order.createdAt,
                        orderCount: 1,
                        orderIds: [order._id],
                        waiterNames: order.createdBy?.username ? [order.createdBy.username] : [],
                        checkPrinted: !!order.checkPrinted,
                    });
                }
            } else {
                result.push({
                    tableNumber: order.tableNumber,
                    items: order.items.map(i => ({ ...i })),
                    totalPrice: order.totalPrice,
                    status: order.status,
                    latestTime: order.createdAt,
                    orderCount: 1,
                    orderIds: [order._id],
                    waiterNames: order.createdBy?.username ? [order.createdBy.username] : [],
                    checkPrinted: !!order.checkPrinted,
                });
            }
        }
        return [...confirmedMap.values(), ...result];
    })();

    const totalRevenue = orders
        .filter((o) => o.status === 'paid')
        .reduce((sum, o) => sum + o.totalPrice, 0);

    const pendingTotal = orders
        .filter((o) => o.status === 'confirmed')
        .reduce((sum, o) => sum + o.totalPrice, 0);

    return (
        <Layout title="Cashier Panel">
            <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="card bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 overflow-hidden p-3 sm:p-4">
                        <p className="text-[10px] sm:text-xs text-emerald-400 font-medium truncate">Total Paid</p>
                        <p className="text-lg sm:text-2xl font-bold text-emerald-400 truncate">{totalRevenue.toFixed(2)} AZN</p>
                    </div>
                    <div className="card bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20 overflow-hidden p-3 sm:p-4">
                        <p className="text-[10px] sm:text-xs text-amber-400 font-medium truncate">Pending</p>
                        <p className="text-lg sm:text-2xl font-bold text-amber-400 truncate">{pendingTotal.toFixed(2)} AZN</p>
                    </div>
                    <div className="card overflow-hidden p-3 sm:p-4">
                        <p className="text-[10px] sm:text-xs text-surface-400 font-medium truncate">Total Orders</p>
                        <p className="text-lg sm:text-2xl font-bold text-surface-100">{orders.length}</p>
                    </div>
                </div>
                {/* Hall tabs + Filter dropdown + View toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {halls.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide sm:flex-1 sm:min-w-0">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'all'
                                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                                    : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                                    }`}
                            >
                                All
                                <span className="ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] bg-white/20">{orders.length}</span>
                            </button>
                            {hallTabs.map((hall) => {
                                const count = getTabOrderCount(hall.name);
                                return (
                                    <button
                                        key={hall.name}
                                        onClick={() => setActiveTab(hall.name)}
                                        className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === hall.name
                                            ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                                            : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                                            }`}
                                    >
                                        {hall.name}
                                        {count > 0 && (
                                            <span className="ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] bg-white/20">{count}</span>
                                        )}
                                    </button>
                                );
                            })}
                            {hasCabinets && (
                                <button
                                    onClick={() => setActiveTab('cabinets')}
                                    className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'cabinets'
                                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                                        : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                                        }`}
                                >
                                    🚪 Cabinets
                                    {cabinetOrderCount > 0 && (
                                        <span className="ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] bg-white/20">{cabinetOrderCount}</span>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as 'all' | 'confirmed' | 'paid')}
                            className="px-3 py-2 rounded-xl text-sm font-medium bg-surface-800 text-surface-200 border border-surface-700 focus:outline-none focus:border-brand-500 cursor-pointer"
                        >
                            <option value="all">All</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="paid">Paid</option>
                        </select>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                                className="p-2 rounded-xl bg-surface-800 text-surface-400 hover:text-surface-200 transition-all"
                            >
                                {viewMode === 'list' ? <HiOutlineViewGrid className="w-5 h-5" /> : <HiOutlineViewList className="w-5 h-5" />}
                            </button>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
                                <span className="text-xs text-surface-400">Live</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Orders */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="card text-center py-12">
                        <p className="text-surface-400">No orders found</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {groupedOrders.map((group) => (
                            <div
                                key={group.orderIds.join('-')}
                                className={`card animate-fade-in transition-all p-3 flex flex-col ${group.status === 'paid' ? 'opacity-70' : ''}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isCabinetOrder({ tableNumber: group.tableNumber } as Order) ? 'bg-purple-500/20' : 'bg-brand-500/20'}`}>
                                            <span className={`text-sm font-bold ${isCabinetOrder({ tableNumber: group.tableNumber } as Order) ? 'text-purple-400' : 'text-brand-400'}`}>{isCabinetOrder({ tableNumber: group.tableNumber } as Order) ? '🚪' : group.tableNumber}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-surface-300 font-medium">{isCabinetOrder({ tableNumber: group.tableNumber } as Order) ? group.tableNumber : `Table ${group.tableNumber}`}</span>
                                            {group.orderCount > 1 && (
                                                <p className="text-[10px] text-surface-500">{group.orderCount} orders</p>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${group.status === 'paid'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-brand-500/20 text-brand-400'
                                        }`}>
                                        {group.status}
                                    </span>
                                </div>

                                <div className="space-y-0.5 mb-2 flex-1">
                                    {group.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-xs">
                                            <span className="text-surface-300 truncate flex-1 mr-2">{item.name}</span>
                                            <span className="text-surface-400">×{item.quantity}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-surface-700/30 mb-2">
                                    <span className="text-xs text-surface-500">
                                        {new Date(group.latestTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                    <span className="text-sm font-bold text-brand-400">{group.totalPrice.toFixed(2)} AZN</span>
                                </div>

                                <div className="flex gap-1.5">
                                    {group.status !== 'paid' && (
                                        <button
                                            onClick={() => handlePrintCheck(group.orderIds.join('-'), group)}
                                            className={`w-1/2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${group.checkPrinted
                                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                : 'bg-blue-500 text-white hover:bg-blue-600'
                                                }`}
                                        >
                                            <HiOutlinePrinter className="w-3.5 h-3.5" />
                                            {group.checkPrinted ? 'Printed' : 'Print'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => group.orderIds.length === 1 ? togglePay(group.orderIds[0]) : togglePayGroup(group.orderIds)}
                                        disabled={group.status !== 'paid' && !group.checkPrinted}
                                        className={`${group.status === 'paid' ? 'w-full' : 'w-1/2'} py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${group.status === 'paid'
                                            ? 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                                            : !group.checkPrinted
                                                ? 'bg-emerald-500/30 text-emerald-300/50 cursor-not-allowed'
                                                : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                            }`}
                                    >
                                        {group.status === 'paid' ? (
                                            <><HiOutlineCash className="w-3.5 h-3.5" /> Unpaid</>
                                        ) : (
                                            <><HiOutlineCheck className="w-3.5 h-3.5" /> Paid</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {groupedOrders.map((group) => (
                            <div
                                key={group.orderIds.join('-')}
                                className={`card animate-fade-in transition-all ${group.status === 'paid' ? 'opacity-70' : ''}`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCabinetOrder({ tableNumber: group.tableNumber } as Order) ? 'bg-purple-500/20' : 'bg-brand-500/20'}`}>
                                            <span className={`text-xl font-bold ${isCabinetOrder({ tableNumber: group.tableNumber } as Order) ? 'text-purple-400' : 'text-brand-400'}`}>{isCabinetOrder({ tableNumber: group.tableNumber } as Order) ? '🚪' : group.tableNumber}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-surface-100">
                                                {isCabinetOrder({ tableNumber: group.tableNumber } as Order) ? group.tableNumber : `Table #${group.tableNumber}`}
                                                {group.orderCount > 1 && (
                                                    <span className="ml-2 text-xs text-surface-500 font-normal bg-surface-800 px-2 py-0.5 rounded-md">{group.orderCount} orders</span>
                                                )}
                                            </h3>
                                            <p className="text-xs text-surface-400">
                                                {new Date(group.latestTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={group.status === 'paid' ? 'badge-paid' : 'badge-confirmed'}>
                                            {group.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Items table */}
                                <div className="overflow-x-auto mb-4">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-surface-400 border-b border-surface-700/50">
                                                <th className="text-left py-2 font-medium">Item</th>
                                                <th className="text-center py-2 font-medium">Qty</th>
                                                <th className="text-right py-2 font-medium">Price</th>
                                                <th className="text-right py-2 font-medium">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.items.map((item, idx) => (
                                                <tr key={idx} className="border-b border-surface-700/30">
                                                    <td className="py-2 text-surface-200">{item.name}</td>
                                                    <td className="py-2 text-center text-surface-300">{item.quantity}</td>
                                                    <td className="py-2 text-right text-surface-300">{item.price.toFixed(2)} AZN</td>
                                                    <td className="py-2 text-right text-surface-100 font-medium">
                                                        {(item.price * item.quantity).toFixed(2)} AZN
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-surface-600">
                                                <td colSpan={3} className="py-3 text-right font-bold text-surface-200">
                                                    Total
                                                </td>
                                                <td className="py-3 text-right text-lg font-bold text-brand-400">
                                                    {group.totalPrice.toFixed(2)} AZN
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="flex gap-2">
                                    {group.status !== 'paid' && (
                                        <button
                                            onClick={() => handlePrintCheck(group.orderIds.join('-'), group)}
                                            className={`w-1/2 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${group.checkPrinted
                                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25'
                                                }`}
                                        >
                                            <HiOutlinePrinter className="w-4 h-4" />
                                            {group.checkPrinted ? 'Printed ✓' : 'Print Check'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => group.orderIds.length === 1 ? togglePay(group.orderIds[0]) : togglePayGroup(group.orderIds)}
                                        disabled={group.status !== 'paid' && !group.checkPrinted}
                                        className={`${group.status === 'paid' ? 'w-full' : 'w-1/2'} py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${group.status === 'paid'
                                            ? 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                                            : !group.checkPrinted
                                                ? 'bg-emerald-500/30 text-emerald-300/50 cursor-not-allowed'
                                                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/25'
                                            }`}
                                    >
                                        {group.status === 'paid' ? (
                                            <>
                                                <HiOutlineCash className="w-4 h-4" />
                                                Mark Unpaid
                                            </>
                                        ) : (
                                            <>
                                                <HiOutlineCheck className="w-4 h-4" />
                                                Mark as Paid
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default CashierDashboard;
