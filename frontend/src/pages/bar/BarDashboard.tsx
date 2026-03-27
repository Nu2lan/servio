import React from 'react';
import Layout from '../../components/Layout';
import { HiOutlineClock } from 'react-icons/hi';
import { getDisplayTableNumber, getTimeSince } from '../../utils/formatters';
import { useDashboardOrders } from '../../hooks/useDashboardOrders';

const BarDashboard: React.FC = () => {
    const { orders, loading, markItemDone } = useDashboardOrders('bar');

    return (
        <Layout title="Bar Ekranı">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h2 className="text-2xl font-bold text-surface-100">Bar Sifarişləri</h2>
                        <p className="text-surface-400 text-sm">{orders.length} gözləyən sifariş</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse-soft" />
                        <span className="text-xs text-surface-400">Canlı</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="card text-center py-20">
                        <p className="text-surface-400 text-lg">Aktiv sifariş yoxdur</p>
                        <p className="text-surface-500 text-sm mt-1">Yeni içki sifarişləri avtomatik olaraq burada görünəcək</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {orders.map((order) => (
                            <div
                                key={order._id}
                                className="card border-l-4 border-l-purple-500 animate-slide-up hover:shadow-2xl transition-shadow"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 px-3 min-w-[3rem] w-auto rounded-xl bg-purple-500/20 flex items-center justify-center">
                                            <span className="text-xl font-bold text-purple-400 whitespace-nowrap">
                                                {order.tableNumber}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-surface-100">{getDisplayTableNumber(order.tableNumber)}</h3>
                                            <div className="flex items-center gap-1 text-xs text-surface-400">
                                                <HiOutlineClock className="w-3 h-3" />
                                                {getTimeSince(order.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-surface-400">
                                        {order.items.filter((i) => i.prepared).length}/{order.items.length} hazır
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
                                                : 'bg-surface-700/30 hover:bg-purple-500/15 cursor-pointer hover:ring-1 hover:ring-purple-500/30'
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
                                                    : 'text-purple-400 bg-purple-500/10'
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

export default BarDashboard;
