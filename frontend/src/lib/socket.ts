import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        const token = localStorage.getItem('token');
        const serverUrl = import.meta.env.VITE_API_URL || undefined;
        socket = io(serverUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
        });
    }
    return socket;
};

export const disconnectSocket = (): void => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
