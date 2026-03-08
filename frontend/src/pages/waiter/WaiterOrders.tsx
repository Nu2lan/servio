import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface OrderItem {
    name: string;
    quantity: number;
}

interface Order {
    _id: string;
    tableNumber: string;
    items: OrderItem[];
    status: string;
    createdAt: string;
}

interface GroupedOrder {
    tableNumber: string;
    items: OrderItem[];
    status: string;
    latestTime: string;
    orderCount: number;
    orderIds: string[];
}

interface Hall {
    name: string;
    tables: number[];
    type: 'hall' | 'cabinet';
}

const WaiterOrders: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [halls, setHalls] = useState<Hall[]>([]);
    const [activeTab, setActiveTab] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [ordersRes, settingsRes] = await Promise.all([
                api.get('/waiter/orders'),
                api.get('/settings'),
            ]);
            const ordersData: Order[] = ordersRes.data;
            const hallsData: Hall[] = settingsRes.data.halls || [];

            setOrders(ordersData);
            setHalls(hallsData);

            // Set first tab that has orders
            if (hallsData.length > 0 && !activeTab) {
                setActiveTab(hallsData[0].name);
            }
        } catch {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    // Determine which hall/cabinet an order belongs to
    const getOrderHall = (order: Order): string | null => {
        // Check if it's a cabinet order
        const cabinet = halls.find(h => h.type === 'cabinet' && h.name === order.tableNumber);
        if (cabinet) return cabinet.name;

        // Check which hall the table number belongs to
        const tableNum = parseInt(order.tableNumber);
        if (!isNaN(tableNum)) {
            const hall = halls.find(h => h.type !== 'cabinet' && h.tables.includes(tableNum));
            if (hall) return hall.name;
        }

        return null;
    };

    // Get orders for active tab
    const filteredOrders = orders.filter(order => getOrderHall(order) === activeTab);

    // Group confirmed orders by table, keep paid orders separate
    const groupedOrders: GroupedOrder[] = (() => {
        const confirmedMap = new Map<string, GroupedOrder>();
        const result: GroupedOrder[] = [];

        for (const order of filteredOrders) {
            if (order.status === 'confirmed') {
                const existing = confirmedMap.get(order.tableNumber);
                if (existing) {
                    // Merge items
                    for (const item of order.items) {
                        const existingItem = existing.items.find(i => i.name === item.name);
                        if (existingItem) {
                            existingItem.quantity += item.quantity;
                        } else {
                            existing.items.push({ ...item });
                        }
                    }
                    existing.orderCount++;
                    existing.orderIds.push(order._id);
                    if (order.createdAt > existing.latestTime) {
                        existing.latestTime = order.createdAt;
                    }
                } else {
                    const grouped: GroupedOrder = {
                        tableNumber: order.tableNumber,
                        items: order.items.map(i => ({ ...i })),
                        status: 'confirmed',
                        latestTime: order.createdAt,
                        orderCount: 1,
                        orderIds: [order._id],
                    };
                    confirmedMap.set(order.tableNumber, grouped);
                }
            } else {
                result.push({
                    tableNumber: order.tableNumber,
                    items: order.items.map(i => ({ ...i })),
                    status: order.status,
                    latestTime: order.createdAt,
                    orderCount: 1,
                    orderIds: [order._id],
                });
            }
        }

        // Add confirmed groups first, then paid
        return [...confirmedMap.values(), ...result];
    })();

    // Check which tab is a cabinet
    const isActiveCabinet = halls.find(h => h.name === activeTab)?.type === 'cabinet';

    // Sort halls first, then cabinets
    const sortedHalls = [...halls].sort((a, b) => {
        if (a.type === 'cabinet' && b.type !== 'cabinet') return 1;
        if (a.type !== 'cabinet' && b.type === 'cabinet') return -1;
        return 0;
    });

    // Count unique tables with orders per hall/cabinet
    const getOrderCount = (hallName: string): number => {
        const hallOrders = orders.filter(order => getOrderHall(order) === hallName);
        const tables = new Set(hallOrders.map(o => o.tableNumber));
        return tables.size;
    };

    return (
        <Layout
            title="Waiter Panel"
            navItems={[
                { label: 'New Order', path: '/waiter' },
                { label: 'My Orders', path: '/waiter/orders' },
            ]}
        >
            <div className="space-y-4">
                {/* Sticky header */}
                <div className="sticky top-16 z-30 bg-surface-950 pb-3 pt-1 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-surface-100">My Orders</h2>
                        <button onClick={fetchData} className="btn-secondary btn-sm">
                            Refresh
                        </button>
                    </div>

                    {!loading && halls.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                            {sortedHalls.map((hall) => {
                                const count = getOrderCount(hall.name);
                                return (
                                    <button
                                        key={hall.name}
                                        onClick={() => setActiveTab(hall.name)}
                                        className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === hall.name
                                            ? hall.type === 'cabinet'
                                                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                                : 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                                            : 'bg-surface-800 border border-surface-700/50 text-surface-400 hover:bg-surface-700 hover:text-surface-200'
                                            }`}
                                    >
                                        {hall.type === 'cabinet' ? '🚪 ' : ''}{hall.name}
                                        {count > 0 && (
                                            <span className={`min-w-5 h-5 px-1.5 rounded-md text-xs font-bold flex items-center justify-center ${activeTab === hall.name
                                                ? 'bg-white/20 text-white'
                                                : 'bg-brand-500/20 text-brand-400'
                                                }`}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : groupedOrders.length === 0 ? (
                    <div className="card text-center py-12">
                        <p className="text-surface-400">No orders for {activeTab}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {groupedOrders.map((group) => (
                            <div key={group.orderIds.join('-')} className="card animate-slide-up space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {isActiveCabinet ? (
                                            <span className="text-lg font-bold text-purple-400">
                                                🚪 {group.tableNumber}
                                            </span>
                                        ) : (
                                            <>
                                                <span className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-brand-500/30">
                                                    {group.tableNumber}
                                                </span>
                                                <span className="text-xs text-surface-500">Table</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {group.orderCount > 1 && (
                                            <span className="text-xs text-surface-500 bg-surface-800 px-2 py-0.5 rounded-md">
                                                {group.orderCount} orders
                                            </span>
                                        )}
                                        <span className={group.status === 'paid' ? 'badge-paid' : 'badge-confirmed'}>
                                            {group.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    {group.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span className="text-surface-300">{item.name}</span>
                                            <span className="text-surface-400">×{item.quantity}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="text-xs text-surface-500">
                                    {new Date(group.latestTime).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default WaiterOrders;
