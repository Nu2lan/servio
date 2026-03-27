import { Router, Response } from 'express';
import Order from '../models/Order';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { getIO } from '../socket';
import { buildCategoryRoleMap, getItemRole } from '../utils/categoryRole';

const router = Router();

// Kitchen and bar both use this route — filtered by role
router.use(authenticate, authorize('kitchen', 'bar'));

// GET /api/kitchen/orders — confirmed orders filtered by role, no prices
router.get('/orders', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userRole = req.user!.role; // 'kitchen' or 'bar'

        const categoryRoles = await buildCategoryRoleMap();

        const orders = await Order.find({ status: 'confirmed' })
            .select('tableNumber items.name items.quantity items.category items.prepared status createdAt')
            .sort({ createdAt: -1 });

        // Filter items by role
        const filtered = orders
            .map((order) => {
                const roleItems = order.items.filter((i) => {
                    return getItemRole(i.category, categoryRoles) === userRole;
                });
                return {
                    _id: order._id,
                    tableNumber: order.tableNumber,
                    items: roleItems.map((i) => ({
                        index: order.items.indexOf(i),
                        name: i.name,
                        quantity: i.quantity,
                        prepared: i.prepared || false,
                    })),
                    status: order.status,
                    createdAt: (order as any).createdAt,
                };
            })
            .filter((o) => o.items.some((i) => !i.prepared));

        res.json(filtered);
    } catch (error) {
        res.status(500).json({ message: 'Server xətası.' });
    }
});

// PATCH /api/kitchen/orders/:orderId/items/:itemIndex — mark an item as prepared
router.patch('/orders/:orderId/items/:itemIndex', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orderId = req.params.orderId as string;
        const idx = parseInt(req.params.itemIndex as string, 10);

        const order = await Order.findById(orderId);
        if (!order) {
            res.status(404).json({ message: 'Sifariş tapılmadı.' });
            return;
        }

        if (idx < 0 || idx >= order.items.length) {
            res.status(404).json({ message: 'Məhsul tapılmadı.' });
            return;
        }

        order.items[idx].prepared = true;
        order.markModified('items');
        await order.save();

        // Emit update to kitchen/bar/cashier
        const io = getIO();
        io.to('kitchen').to('bar').to('cashier').emit('item-prepared', {
            orderId: order._id,
            itemIndex: idx,
        });

        res.json({ message: 'Məhsul hazır kimi işarələndi.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

export default router;
