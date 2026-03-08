import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';
import { HiOutlineClock } from 'react-icons/hi';

interface OrderItem {
    index: number;
    name: string;
    quantity: number;
    prepared: boolean;
}

interface Order {
    _id: string;
    tableNumber: string;
    items: OrderItem[];
    status: string;
    createdAt: string;
}

const KitchenDashboard: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
        const socket = getSocket();

        socket.on('new-order', (order: Order) => {
            setOrders((prev) => [order, ...prev]);
            toast.success(`New order — Table #${order.tableNumber}`, { icon: '🔥' });
        });

        socket.on('item-prepared', ({ orderId, itemIndex }: { orderId: string; itemIndex: number }) => {
            setOrders((prev) =>
                prev
                    .map((o) =>
                        o._id === orderId
                            ? { ...o, items: o.items.map((i) => (i.index === itemIndex ? { ...i, prepared: true } : i)) }
                            : o
                    )
                    .filter((o) => o.items.some((i) => !i.prepared))
            );
        });

        socket.on('order-updated', (update: { _id: string; status: string }) => {
            setOrders((prev) =>
                prev.map((o) => (o._id === update._id ? { ...o, status: update.status } : o))
                    .filter((o) => o.status === 'confirmed')
            );
        });

        return () => {
            socket.off('new-order');
            socket.off('item-prepared');
            socket.off('order-updated');
        };
    }, []);

    const fetchOrders = async () => {
        try {
            const { data } = await api.get('/kitchen/orders');
            setOrders(data);
        } catch {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    const markItemDone = async (orderId: string, itemIndex: number) => {
        try {
            await api.patch(`/kitchen/orders/${orderId}/items/${itemIndex}`);
            setOrders((prev) =>
                prev
                    .map((o) =>
                        o._id === orderId
                            ? { ...o, items: o.items.map((i) => (i.index === itemIndex ? { ...i, prepared: true } : i)) }
                            : o
                    )
                    .filter((o) => o.items.some((i) => !i.prepared))
            );
        } catch {
            toast.error('Failed to mark item');
        }
    };

    const getTimeSince = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
    };

    return (
        <Layout title="Kitchen Display">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h2 className="text-2xl font-bold text-surface-100">Kitchen Orders</h2>
                        <p className="text-surface-400 text-sm">{orders.length} order(s) pending</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse-soft" />
                        <span className="text-xs text-surface-400">Live</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="card text-center py-20">
                        <p className="text-surface-400 text-lg">No active orders</p>
                        <p className="text-surface-500 text-sm mt-1">New orders will appear here automatically</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {orders.map((order) => (
                            <div
                                key={order._id}
                                className="card border-l-4 border-l-brand-500 animate-slide-up hover:shadow-2xl transition-shadow"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center">
                                            <span className="text-xl font-bold text-brand-400">
                                                {order.tableNumber}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-surface-100">Table #{order.tableNumber}</h3>
                                            <div className="flex items-center gap-1 text-xs text-surface-400">
                                                <HiOutlineClock className="w-3 h-3" />
                                                {getTimeSince(order.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-surface-400">
                                        {order.items.filter((i) => i.prepared).length}/{order.items.length} done
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {order.items.map((item, i) => (
                                        <button
                                            key={`${order._id}-${item.index ?? i}`}
                                            onClick={() => !item.prepared && markItemDone(order._id, item.index)}
                                            disabled={item.prepared}
                                            className={`w-full flex items-center justify-between py-2.5 px-3 rounded-lg transition-all text-left ${item.prepared
                                                ? 'bg-emerald-500/10 opacity-50 cursor-default'
                                                : 'bg-surface-700/30 hover:bg-brand-500/15 cursor-pointer hover:ring-1 hover:ring-brand-500/30'
                                                }`}
                                        >
                                            <span
                                                className={`text-sm font-medium ${item.prepared
                                                    ? 'text-emerald-400 line-through'
                                                    : 'text-surface-200'
                                                    }`}
                                            >
                                                {item.prepared ? '✓ ' : ''}{item.name}
                                            </span>
                                            <span
                                                className={`text-sm font-bold px-2 py-0.5 rounded-md ${item.prepared
                                                    ? 'text-emerald-400 bg-emerald-500/10'
                                                    : 'text-brand-400 bg-brand-500/10'
                                                    }`}
                                            >
                                                ×{item.quantity}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default KitchenDashboard;
