import { Router, Response } from 'express';
import MenuItem from '../models/MenuItem';
import Inventory from '../models/Inventory';
import InventoryLog from '../models/InventoryLog';
import Order from '../models/Order';
import Settings from '../models/Settings';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { getIO } from '../socket';

const router = Router();

// All waiter routes require waiter role
router.use(authenticate, authorize('waiter'));

// GET /api/waiter/menu — names only, no prices
router.get('/menu', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const items = await MenuItem.find({ isActive: true })
            .select('name category')
            .sort({ category: 1, name: 1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/waiter/orders — create & confirm order
router.post('/orders', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { tableNumber, items } = req.body;

        if (!tableNumber || !items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ message: 'Table number and items are required.' });
            return;
        }

        // Fetch menu items with their ingredients and build order items with prices
        const orderItems = [];
        let totalPrice = 0;

        // Aggregate all ingredient requirements across all order items
        const ingredientRequirements: Map<string, { inventoryId: string; totalNeeded: number }> = new Map();

        for (const item of items) {
            const menuItem = await MenuItem.findById(item.menuItemId)
                .populate('ingredients.inventoryItem');
            if (!menuItem || !menuItem.isActive) {
                res.status(400).json({ message: `Menu item not found: ${item.menuItemId}` });
                return;
            }

            // Accumulate ingredient requirements
            for (const ingredient of menuItem.ingredients) {
                const invItem = ingredient.inventoryItem as any;
                const invId = invItem._id.toString();
                const needed = ingredient.qty * item.quantity;

                if (ingredientRequirements.has(invId)) {
                    ingredientRequirements.get(invId)!.totalNeeded += needed;
                } else {
                    ingredientRequirements.set(invId, { inventoryId: invId, totalNeeded: needed });
                }
            }

            const itemTotal = menuItem.price * item.quantity;
            totalPrice += itemTotal;

            orderItems.push({
                menuItem: menuItem._id,
                name: menuItem.name,
                quantity: item.quantity,
                price: menuItem.price,
                category: menuItem.category || '',
            });
        }

        // Check stock availability for all ingredients
        for (const [invId, req_] of ingredientRequirements) {
            const inventory = await Inventory.findById(invId);
            if (!inventory || inventory.stock < req_.totalNeeded) {
                res.status(400).json({
                    message: `Insufficient stock for "${inventory?.name || 'Unknown'}". Required: ${req_.totalNeeded}, Available: ${inventory?.stock || 0}`,
                });
                return;
            }
        }

        // Create order
        const order = new Order({
            tableNumber,
            items: orderItems,
            totalPrice,
            status: 'confirmed',
            createdBy: req.user!._id,
        });
        await order.save();

        // Deduct inventory for each ingredient
        const updatedInventoryIds: string[] = [];
        for (const item of items) {
            const menuItem = await MenuItem.findById(item.menuItemId)
                .populate('ingredients.inventoryItem');
            if (!menuItem) continue;

            for (const ingredient of menuItem.ingredients) {
                const invItem = ingredient.inventoryItem as any;
                const inventory = await Inventory.findById(invItem._id);
                if (!inventory) continue;

                const deduction = Math.round(ingredient.qty * item.quantity * 10000) / 10000;
                const stockBefore = inventory.stock;
                inventory.stock = Math.round((inventory.stock - deduction) * 10000) / 10000;
                inventory.lastUpdated = new Date();
                await inventory.save();

                updatedInventoryIds.push(inventory._id.toString());

                // Log inventory change
                await new InventoryLog({
                    inventoryItem: inventory._id,
                    inventoryItemName: inventory.name,
                    quantityUsed: deduction,
                    stockBefore,
                    stockAfter: inventory.stock,
                    order: order._id,
                    tableNumber,
                }).save();
            }
        }

        // Emit inventory updates in real time
        if (updatedInventoryIds.length > 0) {
            const updatedItems = await Inventory.find({ _id: { $in: updatedInventoryIds } });
            const io = getIO();
            io.to('admin').emit('inventory-updated', updatedItems);
        }

        // Build category-role map from settings (case-insensitive)
        const settings = await Settings.findOne();
        const categoryRoles: Record<string, string> = {};
        if (settings) {
            for (const cat of settings.categories) {
                if (cat.name) {
                    categoryRoles[cat.name.trim().toLowerCase()] = cat.role || 'kitchen';
                }
            }
        }

        // Helper to determine role for an item
        const getItemRole = (category: string) => {
            const lower = (category || '').trim().toLowerCase();
            let role = categoryRoles[lower];
            if (!role) {
                if (['drink', 'beer', 'wine', 'alcohol', 'cocktail', 'juice', 'water', 'soda', 'tea', 'coffee'].some(k => lower.includes(k))) {
                    role = 'bar';
                } else {
                    role = 'kitchen';
                }
            }
            return role;
        };

        // Separate items by role
        const kitchenItems = order.items.filter((i) => getItemRole(i.category) === 'kitchen');
        const barItems = order.items.filter((i) => getItemRole(i.category) === 'bar');

        const io = getIO();

        // Emit to kitchen (only kitchen-category items, no prices)
        if (kitchenItems.length > 0) {
            io.to('kitchen').emit('new-order', {
                _id: order._id,
                tableNumber: order.tableNumber,
                items: kitchenItems.map((i) => ({
                    index: order.items.indexOf(i),
                    name: i.name,
                    quantity: i.quantity,
                    prepared: false,
                })),
                status: order.status,
                createdAt: (order as any).createdAt,
            });
        }

        // Emit to bar (only bar-category items, no prices)
        if (barItems.length > 0) {
            io.to('bar').emit('new-order', {
                _id: order._id,
                tableNumber: order.tableNumber,
                items: barItems.map((i) => ({
                    index: order.items.indexOf(i),
                    name: i.name,
                    quantity: i.quantity,
                    prepared: false,
                })),
                status: order.status,
                createdAt: (order as any).createdAt,
            });
        }

        // Emit to cashier (all items with prices)
        io.to('cashier').emit('new-order', {
            _id: order._id,
            tableNumber: order.tableNumber,
            items: order.items.map((i) => ({
                name: i.name,
                quantity: i.quantity,
                price: i.price,
            })),
            totalPrice: order.totalPrice,
            status: order.status,
            createdAt: (order as any).createdAt,
        });

        // Notify all waiters that this table is now busy
        io.to('waiter').emit('table-busy', {
            tableNumber: order.tableNumber,
            latestOrderAt: (order as any).createdAt?.toISOString() || new Date().toISOString(),
        });

        // Return to waiter (no prices)
        res.status(201).json({
            _id: order._id,
            tableNumber: order.tableNumber,
            items: order.items.map((i) => ({ name: i.name, quantity: i.quantity })),
            status: order.status,
        });
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET /api/waiter/busy-tables — all confirmed (unpaid) tables with latest order time
router.get('/busy-tables', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orders = await Order.find({ status: 'confirmed' })
            .select('tableNumber createdAt')
            .sort({ createdAt: -1 });
        const tableMap: Record<string, string> = {};
        for (const o of orders) {
            const t = o.tableNumber;
            if (!tableMap[t]) {
                tableMap[t] = (o as any).createdAt.toISOString();
            }
        }
        const result = Object.entries(tableMap).map(([tableNumber, latestOrderAt]) => ({
            tableNumber,
            latestOrderAt,
        }));
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET /api/waiter/table-orders/:tableNumber — confirmed orders for a specific table (no prices)
router.get('/table-orders/:tableNumber', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orders = await Order.find({
            tableNumber: req.params.tableNumber,
            status: 'confirmed',
        })
            .select('items.name items.quantity createdAt')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET /api/waiter/orders — own orders, no prices
router.get('/orders', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orders = await Order.find({ createdBy: req.user!._id })
            .select('tableNumber items.name items.quantity status createdAt')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

export default router;
