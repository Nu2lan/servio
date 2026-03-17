import { Router, Response } from 'express';
import User from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateAuthResponse } from '../utils/authHelpers';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ message: 'İstifadəçi adı və şifrə tələb olunur.' });
            return;
        }

        const user = await User.findOne({ username, isActive: true });
        if (!user) {
            res.status(401).json({ message: 'Yanlış məlumatlar.' });
            return;
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ message: 'Yanlış məlumatlar.' });
            return;
        }

        res.json(generateAuthResponse(user));
    } catch (error) {
        res.status(500).json({ message: 'Server xətası.' });
    }
});

// POST /api/auth/pin-login
router.post('/pin-login', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { pin } = req.body;

        if (!pin || !/^\d{4}$/.test(pin)) {
            res.status(400).json({ message: 'Düzgün 4 rəqəmli PİN tələb olunur.' });
            return;
        }

        const user = await User.findOne({ pin, isActive: true });
        if (!user) {
            res.status(401).json({ message: 'Yanlış PİN.' });
            return;
        }

        res.json(generateAuthResponse(user));
    } catch (error) {
        res.status(500).json({ message: 'Server xətası.' });
    }
});

// POST /api/auth/verify-pin - verify pin for specific actions without logging in
router.post('/verify-pin', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { pin } = req.body;

        if (!pin || !/^\d{4}$/.test(pin)) {
            res.status(400).json({ message: 'Düzgün 4 rəqəmli PİN tələb olunur.' });
            return;
        }

        const user = await User.findOne({ pin, isActive: true });
        if (!user || (user.role !== 'admin' && user.role !== 'cashier')) {
            res.status(401).json({ message: 'Yanlış PİN və ya kifayət etməyən icazələr.' });
            return;
        }

        res.json({ success: true, role: user.role });
    } catch (error) {
        res.status(500).json({ message: 'Server xətası.' });
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Sistemə daxil olunmayıb.' });
            return;
        }
        res.json({
            id: req.user._id,
            username: req.user.username,
            role: req.user.role,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server xətası.' });
    }
});

export default router;
