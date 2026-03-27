import { useState, useEffect } from 'react';
import { orderService } from '../services/orderService';
import { getSocket } from '../lib/socket';
import toast from 'react-hot-toast';
import { getDisplayTableNumber } from '../utils/formatters';

export interface OrderItem {
    index: number;
    name: string;
    quantity: number;
    prepared: boolean;
}

export interface Order {
    _id: string;
    tableNumber: string;
    items: OrderItem[];
    status: string;
    createdAt: string;
}

export const useDashboardOrders = (type: 'kitchen' | 'bar') => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = async () => {
        try {
            const { data } = type === 'kitchen' 
                ? await orderService.getKitchenOrders() 
                : await orderService.getBarOrders();
            setOrders(data);
        } catch {
            toast.error('Sifarişləri yükləmək mümkün olmadı');
        } finally {
            setLoading(false);
        }
    };

    const markItemDone = async (orderId: string, itemIndex: number) => {
        try {
            if (type === 'kitchen') {
                await orderService.markKitchenItemDone(orderId, itemIndex);
            } else {
                await orderService.markBarItemDone(orderId, itemIndex);
            }
            
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
            toast.error('Məhsulu işarələmək mümkün olmadı');
        }
    };

    useEffect(() => {
        fetchOrders();
        const socket = getSocket();

        const handleNewOrder = (order: Order) => {
            setOrders((prev) => [order, ...prev]);
            toast.success(`Yeni sifariş — ${getDisplayTableNumber(order.tableNumber)}`, { 
                icon: type === 'kitchen' ? '🔥' : '🍸' 
            });
        };

        const handleItemPrepared = ({ orderId, itemIndex }: { orderId: string; itemIndex: number }) => {
            setOrders((prev) =>
                prev
                    .map((o) =>
                        o._id === orderId
                            ? { ...o, items: o.items.map((i) => (i.index === itemIndex ? { ...i, prepared: true } : i)) }
                            : o
                    )
                    .filter((o) => o.items.some((i) => !i.prepared))
            );
        };

        const handleOrderUpdated = (update: { _id: string; status: string }) => {
            setOrders((prev) =>
                prev.map((o) => (o._id === update._id ? { ...o, status: update.status } : o))
                    .filter((o) => o.status === 'confirmed')
            );
        };

        socket.on('new-order', handleNewOrder);
        socket.on('item-prepared', handleItemPrepared);
        socket.on('order-updated', handleOrderUpdated);

        return () => {
            socket.off('new-order', handleNewOrder);
            socket.off('item-prepared', handleItemPrepared);
            socket.off('order-updated', handleOrderUpdated);
        };
    }, [type]);

    return { orders, loading, markItemDone };
};
