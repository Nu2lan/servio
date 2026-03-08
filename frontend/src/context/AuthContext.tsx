import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { disconnectSocket } from '../lib/socket';

interface User {
    id: string;
    username: string;
    role: 'admin' | 'waiter' | 'kitchen' | 'cashier' | 'bar';
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, password: string) => Promise<User>;
    pinLogin: (pin: string) => Promise<User>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadUser = async () => {
            if (token) {
                try {
                    const { data } = await api.get('/auth/me');
                    setUser(data);
                } catch {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setToken(null);
                    setUser(null);
                }
            }
            setIsLoading(false);
        };
        loadUser();
    }, [token]);

    const login = useCallback(async (username: string, password: string): Promise<User> => {
        const { data } = await api.post('/auth/login', { username, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const pinLogin = useCallback(async (pin: string): Promise<User> => {
        const { data } = await api.post('/auth/pin-login', { pin });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        disconnectSocket();
        setToken(null);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, login, pinLogin, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
