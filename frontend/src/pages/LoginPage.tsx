import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlineLockClosed, HiOutlineUser } from 'react-icons/hi';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const roleRedirects: Record<string, string> = {
        admin: '/admin',
        waiter: '/waiter',
        kitchen: '/kitchen',
        bar: '/bar',
        cashier: '/cashier',
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            toast.error('Please enter username and password');
            return;
        }

        setLoading(true);
        try {
            const user = await login(username.trim(), password);
            toast.success(`Welcome, ${user.username}!`);
            navigate(roleRedirects[user.role] || '/login');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md animate-slide-up">
                {/* Logo area */}
                <div className="text-center mb-8">
                    <img
                        src="/servio.png"
                        alt="Servio"
                        className="h-16 mx-auto mb-6 object-contain drop-shadow-lg select-none"
                        draggable={false}
                    />
                    <p className="text-surface-400 mt-2">Sign in to your account</p>
                </div>

                {/* Login card */}
                <div className="card">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="username" className="label">Username</label>
                            <div className="relative">
                                <HiOutlineUser className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="input pl-10"
                                    placeholder="Enter your username"
                                    autoComplete="username"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="label">Password</label>
                            <div className="relative">
                                <HiOutlineLockClosed className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input pl-10"
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>
                </div>

                <button
                    onClick={() => navigate('/login')}
                    className="flex items-center justify-center gap-2 w-full mt-4 py-2 text-sm text-surface-500 hover:text-brand-400 transition-colors"
                >
                    ← Back to PIN Login
                </button>

                <p className="text-center text-surface-500 text-xs mt-4">
                    Servio — Ordering Management System
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
