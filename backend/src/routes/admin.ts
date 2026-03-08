import { Router, Response } from 'express';
import User from '../models/User';
import MenuItem from '../models/MenuItem';
import Inventory from '../models/Inventory';
import Order from '../models/Order';
import InventoryLog from '../models/InventoryLog';
import Settings from '../models/Settings';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// All admin routes require admin role
router.use(authenticate, authorize('admin'));

// ─── USER MANAGEMENT ─────────────────────────────────────────

// GET /api/admin/users
router.get('/users', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/admin/users
router.post('/users', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { username, password, role, pin } = req.body;

        if (!username || !role) {
            res.status(400).json({ message: 'Username and role are required.' });
            return;
        }

        if (role === 'admin' && !password) {
            res.status(400).json({ message: 'Password is required for admin users.' });
            return;
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            res.status(409).json({ message: 'Username already exists.' });
            return;
        }

        // Validate PIN if provided
        if (pin) {
            if (!/^\d{4}$/.test(pin)) {
                res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
                return;
            }
            const existingPin = await User.findOne({ pin });
            if (existingPin) {
                res.status(409).json({ message: `PIN is already assigned to ${existingPin.username}.` });
                return;
            }
        }

        const userPassword = password || Math.random().toString(36).slice(-10) + 'A1!';
        const user = new User({ username, password: userPassword, role, ...(pin ? { pin } : {}) });
        await user.save();

        res.status(201).json({
            id: user._id,
            _id: user._id,
            username: user.username,
            role: user.role,
            isActive: user.isActive,
            pin: user.pin || '',
            createdAt: user.createdAt,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT /api/admin/users/:id
router.put('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { username, password, role, isActive, pin } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }

        if (typeof isActive === 'boolean' && !isActive && req.params.id === req.user?.id) {
            res.status(400).json({ message: 'You cannot deactivate your own account.' });
            return;
        }

        // Handle PIN
        if (pin !== undefined) {
            if (pin === '' || pin === null) {
                // Clear PIN
                user.pin = undefined;
            } else {
                if (!/^\d{4}$/.test(pin)) {
                    res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
                    return;
                }
                // Check uniqueness
                const existingPin = await User.findOne({ pin, _id: { $ne: req.params.id } });
                if (existingPin) {
                    res.status(409).json({ message: `PIN is already assigned to ${existingPin.username}.` });
                    return;
                }
                user.pin = pin;
            }
        }

        if (username) user.username = username;
        if (password) user.password = password;
        if (role) user.role = role;
        if (typeof isActive === 'boolean') user.isActive = isActive;

        await user.save();
        res.json({
            id: user._id,
            _id: user._id,
            username: user.username,
            role: user.role,
            isActive: user.isActive,
            pin: user.pin || '',
            createdAt: user.createdAt,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }

        // Prevent deleting the last admin
        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                res.status(400).json({ message: 'Cannot delete the last admin user.' });
                return;
            }
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// ─── MENU MANAGEMENT ─────────────────────────────────────────

// GET /api/admin/menu
router.get('/menu', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const items = await MenuItem.find()
            .populate('ingredients.inventoryItem', 'name stock unit')
            .sort({ category: 1, name: 1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/admin/menu
router.post('/menu', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, price, category, ingredients } = req.body;

        if (!name || price === undefined) {
            res.status(400).json({ message: 'Name and price are required.' });
            return;
        }

        const item = new MenuItem({ name, price, category, ingredients: ingredients || [] });
        await item.save();

        const populated = await MenuItem.findById(item._id)
            .populate('ingredients.inventoryItem', 'name stock unit');

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT /api/admin/menu/:id
router.put('/menu/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, price, category, isActive, ingredients } = req.body;
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (price !== undefined) updateData.price = price;
        if (category !== undefined) updateData.category = category;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (ingredients !== undefined) updateData.ingredients = ingredients;

        const item = await MenuItem.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('ingredients.inventoryItem', 'name stock unit');

        if (!item) {
            res.status(404).json({ message: 'Menu item not found.' });
            return;
        }

        res.json(item);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// DELETE /api/admin/menu/:id
router.delete('/menu/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const item = await MenuItem.findByIdAndDelete(req.params.id);
        if (!item) {
            res.status(404).json({ message: 'Menu item not found.' });
            return;
        }

        res.json({ message: 'Menu item deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// ─── INVENTORY MANAGEMENT ────────────────────────────────────

// GET /api/admin/inventory
router.get('/inventory', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const inventory = await Inventory.find().sort({ name: 1 });
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/admin/inventory
router.post('/inventory', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, stock, unit } = req.body;

        if (!name || !name.trim()) {
            res.status(400).json({ message: 'Inventory item name is required.' });
            return;
        }

        const item = new Inventory({
            name: name.trim(),
            stock: stock || 0,
            unit: unit || 'portions',
        });
        await item.save();
        res.status(201).json(item);
    } catch (error) {
        console.error('POST /inventory error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT /api/admin/inventory/:id
router.put('/inventory/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, stock, unit } = req.body;
        const updateData: any = { lastUpdated: new Date() };
        if (name !== undefined) updateData.name = name;
        if (stock !== undefined) updateData.stock = stock;
        if (unit !== undefined) updateData.unit = unit;

        const inventory = await Inventory.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!inventory) {
            res.status(404).json({ message: 'Inventory item not found.' });
            return;
        }

        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// DELETE /api/admin/inventory/:id
router.delete('/inventory/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const item = await Inventory.findByIdAndDelete(req.params.id);
        if (!item) {
            res.status(404).json({ message: 'Inventory item not found.' });
            return;
        }

        // Remove references from menu items
        await MenuItem.updateMany(
            {},
            { $pull: { ingredients: { inventoryItem: req.params.id } } }
        );

        res.json({ message: 'Inventory item deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// ─── REPORTS ─────────────────────────────────────────────────

// GET /api/admin/reports/orders
router.get('/reports/orders', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { status, from, to } = req.query;
        const filter: any = {};

        if (status) filter.status = status;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from as string);
            if (to) filter.createdAt.$lte = new Date(to as string);
        }

        const orders = await Order.find(filter)
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET /api/admin/reports/inventory
router.get('/reports/inventory', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { from, to } = req.query;
        const filter: any = {};

        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from as string);
            if (to) filter.createdAt.$lte = new Date(to as string);
        }

        const logs = await InventoryLog.find(filter)
            .populate('inventoryItem', 'name')
            .sort({ createdAt: -1 });

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// ─── SETTINGS ────────────────────────────────────────────────

// GET /api/admin/settings
router.get('/settings', async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await new Settings({}).save();
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT /api/admin/settings
router.put('/settings', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { tableCount, halls } = req.body;
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({});
        }
        if (tableCount !== undefined) settings.tableCount = tableCount;
        if (halls !== undefined) {
            settings.halls = halls;
            settings.markModified('halls');
        }
        await settings.save();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/admin/settings/categories — add a category
router.post('/settings/categories', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, role } = req.body;
        if (!name || !name.trim()) {
            res.status(400).json({ message: 'Category name is required.' });
            return;
        }
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings({});
        if (settings.categories.some((c: any) => c.name === name.trim())) {
            res.status(409).json({ message: 'Category already exists.' });
            return;
        }
        settings.categories.push({ name: name.trim(), role: role || 'kitchen' });
        await settings.save();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT /api/admin/settings/categories — edit a category
router.put('/settings/categories', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { oldName, newName, role } = req.body;
        if (!oldName || !newName || !newName.trim()) {
            res.status(400).json({ message: 'Old name and new name are required.' });
            return;
        }
        let settings = await Settings.findOne();
        if (!settings) {
            res.status(404).json({ message: 'Settings not found.' });
            return;
        }
        const idx = settings.categories.findIndex((c: any) => c.name === oldName);
        if (idx === -1) {
            res.status(404).json({ message: 'Category not found.' });
            return;
        }
        settings.categories[idx] = { name: newName.trim(), role: role || settings.categories[idx].role };
        settings.markModified('categories');
        await settings.save();

        // Update all menu items with the old category name
        if (oldName !== newName.trim()) {
            await MenuItem.updateMany(
                { category: oldName },
                { $set: { category: newName.trim() } }
            );
        }

        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// DELETE /api/admin/settings/categories — delete a category
router.delete('/settings/categories', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ message: 'Category name is required.' });
            return;
        }
        let settings = await Settings.findOne();
        if (!settings) {
            res.status(404).json({ message: 'Settings not found.' });
            return;
        }
        settings.categories = settings.categories.filter((c: any) => c.name !== name);
        await settings.save();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/admin/settings/halls — add a hall
router.post('/settings/halls', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, tables, type } = req.body;
        if (!name || !name.trim()) {
            res.status(400).json({ message: 'Hall name is required.' });
            return;
        }
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings({});
        if (settings.halls.some((h: any) => h.name === name.trim())) {
            res.status(409).json({ message: 'Hall already exists.' });
            return;
        }
        settings.halls.push({ name: name.trim(), tables: tables || [], type: type || 'hall' });
        settings.markModified('halls');
        await settings.save();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT /api/admin/settings/halls — edit a hall
router.put('/settings/halls', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { oldName, newName, tables, type } = req.body;
        if (!oldName) {
            res.status(400).json({ message: 'Old name is required.' });
            return;
        }
        let settings = await Settings.findOne();
        if (!settings) {
            res.status(404).json({ message: 'Settings not found.' });
            return;
        }
        const idx = settings.halls.findIndex((h: any) => h.name === oldName);
        if (idx === -1) {
            res.status(404).json({ message: 'Hall not found.' });
            return;
        }
        if (newName && newName.trim()) settings.halls[idx].name = newName.trim();
        if (tables !== undefined) settings.halls[idx].tables = tables;
        if (type !== undefined) settings.halls[idx].type = type;
        settings.markModified('halls');
        await settings.save();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// DELETE /api/admin/settings/halls — delete a hall
router.delete('/settings/halls', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ message: 'Hall name is required.' });
            return;
        }
        let settings = await Settings.findOne();
        if (!settings) {
            res.status(404).json({ message: 'Settings not found.' });
            return;
        }
        settings.halls = settings.halls.filter((h: any) => h.name !== name);
        settings.markModified('halls');
        await settings.save();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

export default router;
