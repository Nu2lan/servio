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
        res.status(500).json({ message: 'Server xətası.' });
    }
});

// PATCH /api/cashier/orders/:id/pay — mark order as paid
router.patch('/orders/:id/pay', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            res.status(404).json({ message: 'Sifariş tapılmadı.' });
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
        res.status(500).json({ message: 'Server xətası.' });
    }
});

// PATCH /api/cashier/orders/pay-batch — mark multiple orders as paid at once
router.patch('/orders/pay-batch', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { orderIds, paymentMethod } = req.body;
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            res.status(400).json({ message: 'orderIds massivi tələb olunur.' });
            return;
        }

        const now = new Date();
        await Order.updateMany(
            { _id: { $in: orderIds }, status: 'confirmed' },
            { $set: { status: 'paid', paidAt: now, paymentMethod: paymentMethod || 'cash' } }
        );

        const updatedOrders = await Order.find({ _id: { $in: orderIds } })
            .select('tableNumber items.name items.quantity items.price totalPrice status paidAt createdBy checkPrinted paymentMethod')
            .populate('createdBy', 'username');

        const io = getIO();
        // Notify kitchen
        for (const order of updatedOrders) {
            io.to('kitchen').emit('order-updated', { _id: order._id, status: order.status });
        }

        // Check if tables are fully paid and should be freed
        const tableNumbers = [...new Set(updatedOrders.map(o => o.tableNumber))];
        for (const tn of tableNumbers) {
            const remaining = await Order.countDocuments({ tableNumber: tn, status: 'confirmed' });
            if (remaining === 0) {
                io.to('waiter').emit('table-freed', { tableNumber: tn });
            }
        }

        res.json(updatedOrders);
    } catch (error) {
        res.status(500).json({ message: 'Server xətası.' });
    }
});

// PATCH /api/cashier/orders/print-check — mark orders as check printed
router.patch('/orders/print-check', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { orderIds } = req.body;
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            res.status(400).json({ message: 'orderIds massivi tələb olunur.' });
            return;
        }
        await Order.updateMany(
            { _id: { $in: orderIds } },
            { $set: { checkPrinted: true } }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Server xətası.' });
    }
});

// DELETE /api/cashier/orders/end-of-day — delete all paid orders
router.delete('/orders/end-of-day', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        await Order.deleteMany({ status: 'paid' });
        res.json({ success: true, message: 'Gün sonu resetləndi.' });
    } catch (error) {
        res.status(500).json({ message: 'Server xətası.' });
    }
});

export default router;
