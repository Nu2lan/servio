import { Router, Response } from 'express';
import Order from '../models/Order';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { getIO } from '../socket';

const router = Router();

// All cashier routes require cashier role
router.use(authenticate, authorize('cashier'));

// GET /api/cashier/orders — confirmed orders with prices
router.get('/orders', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orders = await Order.find()
            .select('tableNumber items.name items.quantity items.price totalPrice status createdAt paidAt createdBy checkPrinted')
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// PATCH /api/cashier/orders/:id/pay — mark order as paid
router.patch('/orders/:id/pay', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            res.status(404).json({ message: 'Order not found.' });
            return;
        }

        if (order.status === 'paid') {
            // Toggle back to confirmed (unpaid)
            order.status = 'confirmed';
            order.paidAt = undefined;
        } else {
            order.status = 'paid';
            order.paidAt = new Date();
        }

        await order.save();

        const io = getIO();
        io.to('kitchen').emit('order-updated', {
            _id: order._id,
            status: order.status,
        });

        // If order was just paid, check if all orders for this table are paid
        if (order.status === 'paid') {
            const remainingConfirmed = await Order.countDocuments({
                tableNumber: order.tableNumber,
                status: 'confirmed',
            });
            if (remainingConfirmed === 0) {
                io.to('waiter').emit('table-freed', { tableNumber: order.tableNumber });
            }
        }

        res.json({
            _id: order._id,
            tableNumber: order.tableNumber,
            items: order.items,
            totalPrice: order.totalPrice,
            status: order.status,
            paidAt: order.paidAt,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// PATCH /api/cashier/orders/print-check — mark orders as check printed
router.patch('/orders/print-check', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { orderIds } = req.body;
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            res.status(400).json({ message: 'orderIds array is required.' });
            return;
        }
        await Order.updateMany(
            { _id: { $in: orderIds } },
            { $set: { checkPrinted: true } }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

export default router;
