import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Order {
    _id: string;
    tableNumber: string;
    items: { name: string; quantity: number; price: number }[];
    totalPrice: number;
    status: string;
    createdBy: { username: string } | null;
    createdAt: string;
}

interface InventoryLog {
    _id: string;
    inventoryItemName: string;
    quantityUsed: number;
    stockBefore: number;
    stockAfter: number;
    tableNumber: string;
    createdAt: string;
}

const adminNav = [
    { label: 'Əsas səhifə', path: '/admin' },
    { label: 'Menyu', path: '/admin/menu' },
    { label: 'Anbar', path: '/admin/inventory' },
    { label: 'İstifadəçilər', path: '/admin/users' },
    { label: 'Hesabatlar', path: '/admin/reports' },
    { label: 'Tənzimləmələr', path: '/admin/settings' },
];

const Reports: React.FC = () => {
    const [tab, setTab] = useState<'orders' | 'inventory'>('orders');
    const [orders, setOrders] = useState<Order[]>([]);
    const [logs, setLogs] = useState<InventoryLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (tab === 'orders') fetchOrders();
        else fetchLogs();
    }, [tab]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/reports/orders');
            setOrders(data);
        } catch {
            toast.error('Sifarişləri yükləmək mümkün olmadı');
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/reports/inventory');
            setLogs(data);
        } catch {
            toast.error('Anbar tarixçəsini yükləmək mümkün olmadı');
        } finally {
            setLoading(false);
        }
    };

    const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

    const toggleDate = (dateStr: string) => {
        setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
    };

    // Group orders by date
    const groupedOrders = orders.reduce((acc, order) => {
        const dateStr = new Date(order.createdAt).toLocaleDateString('en-GB');
        if (!acc[dateStr]) {
            acc[dateStr] = {
                orders: [],
                totalRevenue: 0,
            };
        }
        acc[dateStr].orders.push(order);
        if (order.status === 'paid' || order.status === 'archived') {
            acc[dateStr].totalRevenue += order.totalPrice;
        }
        return acc;
    }, {} as Record<string, { orders: Order[], totalRevenue: number }>);

    const sortedDates = Object.keys(groupedOrders).sort((a, b) => {
        // Simple sort DD/MM/YYYY by converting back to date, or just simple string sort won't work perfectly.
        const [d1, m1, y1] = a.split('/');
        const [d2, m2, y2] = b.split('/');
        return new Date(`${y2}-${m2}-${d2}`).getTime() - new Date(`${y1}-${m1}-${d1}`).getTime();
    });

    const [expandedLogDates, setExpandedLogDates] = useState<Record<string, boolean>>({});

    const toggleLogDate = (dateStr: string) => {
        setExpandedLogDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
    };

    // Group logs by date
    const groupedLogs = logs.reduce((acc, log) => {
        const dateObj = new Date(log.createdAt);
        const dateStr = dateObj.toLocaleDateString('en-GB');
        
        if (!acc[dateStr]) {
            acc[dateStr] = {
                logs: [],
                totalQuantityUsed: 0
            };
        }

        // Merge by inventoryItemName for the entire day
        const existingLog: any = acc[dateStr].logs.find(
            (l) => l.inventoryItemName === log.inventoryItemName
        );

        if (existingLog) {
            existingLog.quantityUsed += log.quantityUsed;
            existingLog.orderCount = (existingLog.orderCount || 1) + 1;

            const existingTime = new Date(existingLog.createdAt).getTime();
            const logTime = new Date(log.createdAt).getTime();

            if (!existingLog._timestamps) {
                existingLog._timestamps = {
                    earliest: existingTime,
                    latest: existingTime
                };
            }

            if (logTime < existingLog._timestamps.earliest) {
                existingLog._timestamps.earliest = logTime;
                existingLog.stockBefore = log.stockBefore;
            }
            if (logTime > existingLog._timestamps.latest) {
                existingLog._timestamps.latest = logTime;
                existingLog.stockAfter = log.stockAfter;
            }
        } else {
            acc[dateStr].logs.push({ 
                ...log, 
                orderCount: 1,
                _timestamps: { earliest: new Date(log.createdAt).getTime(), latest: new Date(log.createdAt).getTime() } 
            } as any);
        }

        acc[dateStr].totalQuantityUsed += log.quantityUsed;
        return acc;
    }, {} as Record<string, { logs: (InventoryLog & { orderCount?: number })[], totalQuantityUsed: number }>);

    const sortedLogDates = Object.keys(groupedLogs).sort((a, b) => {
        const [d1, m1, y1] = a.split('/');
        const [d2, m2, y2] = b.split('/');
        return new Date(`${y2}-${m2}-${d2}`).getTime() - new Date(`${y1}-${m1}-${d1}`).getTime();
    });

    return (
        <Layout title="Admin Paneli" navItems={adminNav}>
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-surface-100">Hesabatlar</h2>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setTab('orders')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'orders' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                            }`}
                    >
                        Sifariş Tarixçəsi
                    </button>
                    <button
                        onClick={() => setTab('inventory')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'inventory' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                            }`}
                    >
                        Anbar İstifadəsi
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : tab === 'orders' ? (
                    orders.length === 0 ? (
                        <div className="card text-center py-12">
                            <p className="text-surface-400">Hələlik sifariş yoxdur</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sortedDates.map((dateStr) => {
                                const group = groupedOrders[dateStr];
                                const isExpanded = expandedDates[dateStr];

                                return (
                                    <div key={dateStr} className="card p-0 overflow-hidden">
                                        <div 
                                            className="p-4 flex items-center justify-between cursor-pointer bg-surface-800 hover:bg-surface-700/50 transition-colors"
                                            onClick={() => toggleDate(dateStr)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-brand-500/20 text-brand-400' : 'bg-surface-700 text-surface-400'}`}>
                                                    ▼
                                                </div>
                                                <span className="font-bold text-lg text-surface-100">{dateStr}</span>
                                                <span className="text-xs text-surface-400 bg-surface-900 px-2 py-1 rounded-md">{group.orders.length} sifariş</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-surface-400">Günlük Gəlir</p>
                                                <p className="font-bold text-brand-400">{group.totalRevenue.toFixed(2)} AZN</p>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t border-surface-700 p-4 bg-surface-900/50">
                                                {/* Mobile card view */}
                                                <div className="md:hidden space-y-3">
                                                    {group.orders.map((order) => (
                                                        <div key={order._id} className="card space-y-2 animate-slide-up bg-surface-800">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm">{order.tableNumber}</span>
                                                                    <div>
                                                                        <p className="text-xs text-surface-400">{new Date(order.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                                                                        <p className="text-xs text-surface-500">{order.createdBy?.username || '-'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-lg font-bold text-surface-100">{order.totalPrice.toFixed(2)} AZN</span>
                                                                    <div><span className={order.status === 'paid' || order.status === 'archived' ? 'badge-paid' : 'badge-confirmed'}>{order.status}</span></div>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-surface-300 border-t border-surface-700/30 pt-2">
                                                                {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Desktop table view */}
                                                <div className="hidden md:block overflow-x-auto rounded-xl border border-surface-700">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-surface-700/50 text-surface-400 bg-surface-800">
                                                                <th className="text-left p-3 font-medium">Saat</th>
                                                                <th className="text-center p-3 font-medium">Masa</th>
                                                                <th className="text-left p-3 font-medium">Məhsullar</th>
                                                                <th className="text-right p-3 font-medium">Məbləğ</th>
                                                                <th className="text-center p-3 font-medium">Status</th>
                                                                <th className="text-left p-3 font-medium">Ofisiant</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {group.orders.map((order) => (
                                                                <tr key={order._id} className="border-b border-surface-700/30 hover:bg-surface-800 transition">
                                                                    <td className="p-3 text-surface-300 whitespace-nowrap">
                                                                        {new Date(order.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                    </td>
                                                                    <td className="p-3 text-center font-bold text-brand-400">{order.tableNumber}</td>
                                                                    <td className="p-3 text-surface-200">
                                                                        {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                                                                    </td>
                                                                    <td className="p-3 text-right font-medium text-surface-100">{order.totalPrice.toFixed(2)} AZN</td>
                                                                    <td className="p-3 text-center">
                                                                        <span className={order.status === 'paid' || order.status === 'archived' ? 'badge-paid' : 'badge-confirmed'}>
                                                                            {order.status === 'archived' ? 'Ödənilib' : order.status === 'paid' ? 'Ödənilib' : order.status === 'confirmed' ? 'Gözləyir' : order.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-3 text-surface-400">{order.createdBy?.username || '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : logs.length === 0 ? (
                    <div className="card text-center py-12">
                        <p className="text-surface-400">Hələlik anbar istifadəsi tarixçəsi yoxdur</p>
                    </div>
                ) : (
                        <div className="space-y-4">
                            {sortedLogDates.map((dateStr) => {
                                const group = groupedLogs[dateStr];
                                const isExpanded = expandedLogDates[dateStr];

                                return (
                                    <div key={dateStr} className="card p-0 overflow-hidden">
                                        <div 
                                            className="p-4 flex items-center justify-between cursor-pointer bg-surface-800 hover:bg-surface-700/50 transition-colors"
                                            onClick={() => toggleLogDate(dateStr)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-brand-500/20 text-brand-400' : 'bg-surface-700 text-surface-400'}`}>
                                                    ▼
                                                </div>
                                                <span className="font-bold text-lg text-surface-100">{dateStr}</span>
                                                <span className="text-xs text-surface-400 bg-surface-900 px-2 py-1 rounded-md">{group.logs.length} əməliyyat</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-surface-400">Ümumi İstifadə</p>
                                                <p className="font-bold text-red-400">-{parseFloat(group.totalQuantityUsed.toFixed(2))}</p>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="border-t border-surface-700 p-4 bg-surface-900/50">
                                                {/* Mobile card view */}
                                                <div className="md:hidden space-y-3">
                                                    {group.logs.map((log) => {
                                                        const diff = parseFloat((log.stockAfter - (log.stockBefore - log.quantityUsed)).toFixed(2));
                                                        return (
                                                            <div key={log._id} className="card space-y-2 animate-slide-up bg-surface-800">
                                                                <div className="flex items-start justify-between">
                                                                    <div>
                                                                        <h3 className="font-semibold text-surface-100">{log.inventoryItemName}</h3>
                                                                        <p className="text-xs text-surface-400">{log.orderCount} sifarişdə</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-sm border-t border-surface-700/30 pt-2">
                                                                    <span className="text-red-400 font-medium">-{parseFloat(log.quantityUsed.toFixed(2))}</span>
                                                                    <span className="text-surface-400">
                                                                        {parseFloat(log.stockBefore.toFixed(2))}
                                                                        {diff > 0 && <span className="text-green-400 font-bold ml-1">+{diff}</span>}
                                                                        {diff < 0 && <span className="text-red-400 font-bold ml-1">{diff}</span>}
                                                                        {' '}→{' '}{parseFloat(log.stockAfter.toFixed(2))}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Desktop table view */}
                                                <div className="hidden md:block overflow-x-auto rounded-xl border border-surface-700">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-surface-700/50 text-surface-400 bg-surface-800">
                                                                <th className="text-left p-3 font-medium">Məhsul</th>
                                                                <th className="text-center p-3 font-medium">Sifariş Sayı</th>
                                                                <th className="text-right p-3 font-medium">İstifadə olunan</th>
                                                                <th className="text-right p-3 font-medium">Əvvəl</th>
                                                                <th className="text-right p-3 font-medium">Sonra</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {group.logs.map((log) => {
                                                                const diff = parseFloat((log.stockAfter - (log.stockBefore - log.quantityUsed)).toFixed(2));
                                                                return (
                                                                    <tr key={log._id} className="border-b border-surface-700/30 hover:bg-surface-800 transition">
                                                                        <td className="p-3 font-medium text-surface-100">{log.inventoryItemName}</td>
                                                                        <td className="p-3 text-center text-brand-400">{log.orderCount}</td>
                                                                        <td className="p-3 text-right text-red-400">-{parseFloat(log.quantityUsed.toFixed(2))}</td>
                                                                        <td className="p-3 text-right text-surface-300">
                                                                            {parseFloat(log.stockBefore.toFixed(2))}
                                                                            {diff > 0 && <span className="text-green-400 font-bold ml-1">+{diff}</span>}
                                                                            {diff < 0 && <span className="text-red-400 font-bold ml-1">{diff}</span>}
                                                                        </td>
                                                                        <td className="p-3 text-right text-surface-200">{parseFloat(log.stockAfter.toFixed(2))}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                )}
            </div>
        </Layout>
    );
};

export default Reports;
