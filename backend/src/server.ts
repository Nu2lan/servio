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
import { runMigrations } from './migrations';
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
        await runMigrations();
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
    });

export default app;
