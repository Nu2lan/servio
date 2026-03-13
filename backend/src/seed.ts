import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from './models/User';
import Settings from './models/Settings';

export const seedDefaultUsers = async (): Promise<void> => {
    try {
        // Seed Admin
        const adminExists = await User.findOne({ username: 'Admin' });
        if (!adminExists) {
            await new User({
                username: 'Admin',
                password: 'Admin123!',
                role: 'admin',
            }).save();
            console.log('✅ Default Admin user created (Admin / Admin123!)');
        } else {
            console.log('ℹ️  Admin user already exists, skipping.');
        }

        // Seed default Settings (categories, halls, tableCount)
        const settingsExists = await Settings.findOne();
        if (!settingsExists) {
            await new Settings({}).save();
            console.log('✅ Default Settings created (categories, halls, tableCount)');
        } else {
            console.log('ℹ️  Settings already exist, skipping.');
        }
    } catch (error) {
        console.error('Error seeding default data:', error);
    }
};

// ─── Standalone runner ───
// When executed directly via `npm run seed`, connect to MongoDB, seed, and exit.
const isRunDirectly = require.main === module;

if (isRunDirectly) {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant';

    console.log('🔌 Connecting to MongoDB...');
    mongoose
        .connect(MONGODB_URI)
        .then(async () => {
            console.log('📦 Connected to MongoDB');
            await seedDefaultUsers();
            console.log('🏁 Seeding complete. Disconnecting...');
            await mongoose.disconnect();
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ MongoDB connection error:', err);
            process.exit(1);
        });
}
