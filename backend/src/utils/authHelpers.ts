import jwt from 'jsonwebtoken';
import { IUser } from '../models/User';

interface AuthResponse {
    token: string;
    user: {
        id: unknown;
        username: string;
        role: string;
    };
}

/**
 * Creates a signed JWT and returns the standard auth response payload.
 */
export function generateAuthResponse(user: IUser): AuthResponse {
    const token = jwt.sign(
        { id: user._id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '12h' },
    );

    return {
        token,
        user: {
            id: user._id,
            username: user.username,
            role: user.role,
        },
    };
}
