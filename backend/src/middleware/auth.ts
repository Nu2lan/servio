import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User';

export interface AuthRequest extends Request {
    user?: IUser;
}

interface JwtPayload {
    id: string;
    username: string;
    role: UserRole;
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ message: 'Access denied. No token provided.' });
            return;
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'fallback-secret'
        ) as JwtPayload;

        const user = await User.findById(decoded.id).select('-password');
        if (!user || !user.isActive) {
            res.status(401).json({ message: 'Invalid token or inactive user.' });
            return;
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token.' });
    }
};

export const authorize = (...roles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: 'Not authenticated.' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
            return;
        }
        next();
    };
};
