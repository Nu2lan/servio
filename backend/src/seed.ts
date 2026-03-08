import User from './models/User';

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
        }
    } catch (error) {
        console.error('Error seeding default users:', error);
    }
};
