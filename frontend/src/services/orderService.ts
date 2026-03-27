import api from '../lib/api';

/**
 * Service to handle orders across all dashboards
 */
export const orderService = {
    // Waiter
    getWaiterOrders: () => api.get('/waiter/orders'),
    createOrder: (payload: any) => api.post('/orders', payload),
    
    // Kitchen
    getKitchenOrders: () => api.get('/kitchen/orders'),
    markKitchenItemDone: (orderId: string, itemIndex: number) => 
        api.patch(`/kitchen/orders/${orderId}/items/${itemIndex}`),
    
    // Bar
    getBarOrders: () => api.get('/bar/orders'),
    markBarItemDone: (orderId: string, itemIndex: number) => 
        api.patch(`/bar/orders/${orderId}/items/${itemIndex}`),
    
    // Cashier
    getCashierOrders: () => api.get('/cashier/orders'),
    payOrder: (orderId: string, payload: { paymentMethod: string; amount: number; isPartial?: boolean }) => 
        api.post(`/orders/${orderId}/pay`, payload),
        
    // General / Admin
    getAllOrders: () => api.get('/orders'),
    cancelOrder: (orderId: string, adminPin: string) => 
        api.post(`/orders/${orderId}/cancel`, { adminPin }),
};
