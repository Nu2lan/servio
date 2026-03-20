import { Router, Response } from 'express';
import User from '../models/User';
import Settings from '../models/Settings';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateAuthResponse } from '../utils/authHelpers';

const router = Router();

/**
 * Check if the current time is within working hours.
 * Supports cross-midnight ranges (e.g. 10:00 → 02:00).
 * Uses the given IANA timezone to compute local time.
 */
function isWithinWorkingHours(startStr: string, endStr: string, timezone: string): boolean {
    // Get current time in the configured timezone
    const nowStr = new Date().toLocaleString('en-GB', { timeZone: timezone, hour12: false });
    // nowStr format: "DD/MM/YYYY, HH:MM:SS"
    const timePart = nowStr.split(', ')[1]; // "HH:MM:SS"
    const [h, m] = timePart.split(':').map(Number);
    const currentMinutes = h * 60 + m;

    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;

    if (start <= end) {
        // Same-day range (e.g. 08:00 → 22:00)
        return currentMinutes >= start && currentMinutes <= end;
    } else {
        // Cross-midnight range (e.g. 10:00 → 02:00)
        return currentMinutes >= start || currentMinutes <= end;
    }
}

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

        // Enforce working hours (admin exempt)
        if (user.role !== 'admin') {
            const settings = await Settings.findOne();
            if (settings) {
                const start = settings.workingHoursStart || '00:00';
                const end = settings.workingHoursEnd || '23:59';
                if (!isWithinWorkingHours(start, end, settings.timezone || 'Asia/Baku')) {
                    res.status(403).json({ message: `İş saatı xaricində giriş mümkün deyil (${start} – ${end})` });
                    return;
                }
            }
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

        // Enforce working hours (admin exempt)
        if (user.role !== 'admin') {
            const settings = await Settings.findOne();
            if (settings) {
                const start = settings.workingHoursStart || '00:00';
                const end = settings.workingHoursEnd || '23:59';
                if (!isWithinWorkingHours(start, end, settings.timezone || 'Asia/Baku')) {
                    res.status(403).json({ message: `İş saatı xaricində giriş mümkün deyil (${start} – ${end})` });
                    return;
                }
            }
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
