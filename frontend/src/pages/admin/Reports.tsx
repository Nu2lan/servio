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
    { label: 'Dashboard', path: '/admin' },
    { label: 'Menu', path: '/admin/menu' },
    { label: 'Inventory', path: '/admin/inventory' },
    { label: 'Users', path: '/admin/users' },
    { label: 'Reports', path: '/admin/reports' },
    { label: 'Settings', path: '/admin/settings' },
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
            toast.error('Failed to load orders');
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
            toast.error('Failed to load inventory logs');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="Admin Panel" navItems={adminNav}>
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-surface-100">Reports</h2>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setTab('orders')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'orders' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                            }`}
                    >
                        Order History
                    </button>
                    <button
                        onClick={() => setTab('inventory')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'inventory' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                            }`}
                    >
                        Inventory Usage
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : tab === 'orders' ? (
                    orders.length === 0 ? (
                        <div className="card text-center py-12">
                            <p className="text-surface-400">No orders yet</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile card view */}
                            <div className="md:hidden space-y-3">
                                {orders.map((order) => (
                                    <div key={order._id} className="card space-y-2 animate-slide-up">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm">{order.tableNumber}</span>
                                                <div>
                                                    <p className="text-xs text-surface-400">{new Date(order.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                                                    <p className="text-xs text-surface-500">{order.createdBy?.username || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-bold text-surface-100">{order.totalPrice.toFixed(2)} AZN</span>
                                                <div><span className={order.status === 'paid' ? 'badge-paid' : 'badge-confirmed'}>{order.status}</span></div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-surface-300 border-t border-surface-700/30 pt-2">
                                            {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop table view */}
                            <div className="card overflow-x-auto p-0 hidden md:block">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-surface-700/50 text-surface-400">
                                            <th className="text-left p-4 font-medium">Date</th>
                                            <th className="text-center p-4 font-medium">Table</th>
                                            <th className="text-left p-4 font-medium">Items</th>
                                            <th className="text-right p-4 font-medium">Total</th>
                                            <th className="text-center p-4 font-medium">Status</th>
                                            <th className="text-left p-4 font-medium">Waiter</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map((order) => (
                                            <tr key={order._id} className="border-b border-surface-700/30 hover:bg-surface-800/30 transition">
                                                <td className="p-4 text-surface-300 whitespace-nowrap">
                                                    {new Date(order.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </td>
                                                <td className="p-4 text-center font-bold text-brand-400">{order.tableNumber}</td>
                                                <td className="p-4 text-surface-200">
                                                    {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                                                </td>
                                                <td className="p-4 text-right font-medium text-surface-100">{order.totalPrice.toFixed(2)} AZN</td>
                                                <td className="p-4 text-center">
                                                    <span className={order.status === 'paid' ? 'badge-paid' : 'badge-confirmed'}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-surface-400">{order.createdBy?.username || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )
                ) : logs.length === 0 ? (
                    <div className="card text-center py-12">
                        <p className="text-surface-400">No inventory usage logs yet</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile card view */}
                        <div className="md:hidden space-y-3">
                            {logs.map((log) => (
                                <div key={log._id} className="card space-y-2 animate-slide-up">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-surface-100">{log.inventoryItemName}</h3>
                                            <p className="text-xs text-surface-400">{new Date(log.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                                        </div>
                                        <span className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm">{log.tableNumber}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm border-t border-surface-700/30 pt-2">
                                        <span className="text-red-400 font-medium">-{log.quantityUsed}</span>
                                        <span className="text-surface-400">{log.stockBefore} → {log.stockAfter}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop table view */}
                        <div className="card overflow-x-auto p-0 hidden md:block">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-700/50 text-surface-400">
                                        <th className="text-left p-4 font-medium">Date</th>
                                        <th className="text-left p-4 font-medium">Item</th>
                                        <th className="text-center p-4 font-medium">Table</th>
                                        <th className="text-right p-4 font-medium">Used</th>
                                        <th className="text-right p-4 font-medium">Before</th>
                                        <th className="text-right p-4 font-medium">After</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log._id} className="border-b border-surface-700/30 hover:bg-surface-800/30 transition">
                                            <td className="p-4 text-surface-300 whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </td>
                                            <td className="p-4 font-medium text-surface-100">{log.inventoryItemName}</td>
                                            <td className="p-4 text-center text-brand-400">{log.tableNumber}</td>
                                            <td className="p-4 text-right text-red-400">-{log.quantityUsed}</td>
                                            <td className="p-4 text-right text-surface-300">{log.stockBefore}</td>
                                            <td className="p-4 text-right text-surface-200">{log.stockAfter}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};

export default Reports;
