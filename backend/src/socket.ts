import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: Server;

interface SocketUser {
    id: string;
    username: string;
    role: string;
}

export const initSocket = (httpServer: HttpServer): Server => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    // JWT authentication middleware for socket connections
    io.use((socket: Socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET || 'fallback-secret'
            ) as SocketUser;
            (socket as any).user = decoded;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const user = (socket as any).user as SocketUser;
        console.log(`Socket connected: ${user.username} (${user.role})`);

        // Auto-join role-based rooms
        if (user.role === 'kitchen') {
            socket.join('kitchen');
        } else if (user.role === 'bar') {
            socket.join('bar');
        } else if (user.role === 'cashier') {
            socket.join('cashier');
        } else if (user.role === 'waiter') {
            socket.join('waiter');
        } else if (user.role === 'admin') {
            socket.join('admin');
        }

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${user.username}`);
        });
    });

    return io;
};

export const getIO = (): Server => {
    if (!io) {
        throw new Error('Socket.IO not initialized');
    }
    return io;
};
