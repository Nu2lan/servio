import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ message: 'Username and password are required.' });
            return;
        }

        const user = await User.findOne({ username, isActive: true });
        if (!user) {
            res.status(401).json({ message: 'Invalid credentials.' });
            return;
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials.' });
            return;
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '12h' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/auth/pin-login
router.post('/pin-login', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { pin } = req.body;

        if (!pin || !/^\d{4}$/.test(pin)) {
            res.status(400).json({ message: 'A valid 4-digit PIN is required.' });
            return;
        }

        const user = await User.findOne({ pin, isActive: true });
        if (!user) {
            res.status(401).json({ message: 'Invalid PIN.' });
            return;
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '12h' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authenticated.' });
            return;
        }
        res.json({
            id: req.user._id,
            username: req.user.username,
            role: req.user.role,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

export default router;
