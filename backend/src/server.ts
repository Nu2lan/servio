import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import mongoose from 'mongoose';

import { initSocket } from './socket';
import { seedDefaultUsers } from './seed';
import Settings from './models/Settings';

import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import waiterRoutes from './routes/waiter';
import kitchenRoutes from './routes/kitchen';
import cashierRoutes from './routes/cashier';

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === 'production';

// Initialize Socket.IO
initSocket(httpServer);

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts from Vite build
}));

// CORS: in production (same-origin), allow all; in dev, use env var
app.use(cors({
    origin: isProduction
        ? true
        : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
    credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/waiter', waiterRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/bar', kitchenRoutes);  // Bar reuses kitchen route with role-based filtering
app.use('/api/cashier', cashierRoutes);

// Public settings endpoint (read-only, any authenticated user)
app.get('/api/settings', async (_req, res) => {
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

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files in production
if (isProduction) {
    const frontendPath = path.join(__dirname, '..', 'public');
    app.use(express.static(frontendPath));

    // SPA catch-all: serve index.html for any non-API route
    app.get('*', (_req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

// Start HTTP server immediately so health check passes
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// Then connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant';

mongoose
    .connect(MONGODB_URI)
    .then(async () => {
        console.log('📦 Connected to MongoDB');
        await seedDefaultUsers();

        // Migrate old string categories to { name, role } format
        const settingsCollection = mongoose.connection.db!.collection('settings');
        const rawSettings = await settingsCollection.findOne({});
        if (rawSettings && rawSettings.categories && rawSettings.categories.length > 0) {
            const first = rawSettings.categories[0];
            if (typeof first === 'string') {
                console.log('📋 Migrating categories to new format...');
                const barKeywords = ['drink', 'cocktail', 'beer', 'alcohol', 'siqaret', 'wine', 'whiskey', 'liquor', 'tequilla', 'shot'];
                const migrated = rawSettings.categories.map((c: string) => ({
                    name: c,
                    role: barKeywords.some((k) => c.toLowerCase().includes(k)) ? 'bar' : 'kitchen',
                }));
                await settingsCollection.updateOne({ _id: rawSettings._id }, { $set: { categories: migrated } });
                console.log('✅ Categories migrated');
            }
        }

        // Migrate tableNumber from number to string in orders
        const ordersCollection = mongoose.connection.db!.collection('orders');
        const numericOrders = await ordersCollection.countDocuments({ tableNumber: { $type: 'number' } });
        if (numericOrders > 0) {
            console.log(`📋 Migrating ${numericOrders} orders: tableNumber number → string...`);
            const cursor = ordersCollection.find({ tableNumber: { $type: 'number' } });
            for await (const doc of cursor) {
                await ordersCollection.updateOne(
                    { _id: doc._id },
                    { $set: { tableNumber: String(doc.tableNumber) } }
                );
            }
            console.log('✅ Orders tableNumber migrated');
        }

        // Migrate tableNumber from number to string in inventorylogs
        const logsCollection = mongoose.connection.db!.collection('inventorylogs');
        const numericLogs = await logsCollection.countDocuments({ tableNumber: { $type: 'number' } });
        if (numericLogs > 0) {
            console.log(`📋 Migrating ${numericLogs} inventory logs: tableNumber number → string...`);
            const logCursor = logsCollection.find({ tableNumber: { $type: 'number' } });
            for await (const doc of logCursor) {
                await logsCollection.updateOne(
                    { _id: doc._id },
                    { $set: { tableNumber: String(doc.tableNumber) } }
                );
            }
            console.log('✅ InventoryLogs tableNumber migrated');
        }

        // Migrate halls: add type:'hall' where missing
        if (rawSettings && rawSettings.halls && rawSettings.halls.length > 0) {
            const needsMigration = rawSettings.halls.some((h: any) => !h.type);
            if (needsMigration) {
                console.log('📋 Migrating halls: adding type field...');
                const migratedHalls = rawSettings.halls.map((h: any) => ({
                    ...h,
                    type: h.type || 'hall',
                }));
                await settingsCollection.updateOne(
                    { _id: rawSettings._id },
                    { $set: { halls: migratedHalls } }
                );
                console.log('✅ Halls type field migrated');
            }
        }
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
    });

export default app;
