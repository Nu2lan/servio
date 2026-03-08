import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlineBackspace, HiOutlineShieldCheck } from 'react-icons/hi';

const PinLoginPage: React.FC = () => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { pinLogin } = useAuth();
    const navigate = useNavigate();

    const roleRedirects: Record<string, string> = {
        admin: '/admin',
        waiter: '/waiter',
        kitchen: '/kitchen',
        bar: '/bar',
        cashier: '/cashier',
    };

    const handleDigit = async (digit: string) => {
        if (loading) return;
        const newPin = pin + digit;
        if (newPin.length > 4) return;

        setPin(newPin);
        if (error) setError('');

        // Auto-submit on 4th digit
        if (newPin.length === 4) {
            setLoading(true);
            try {
                const user = await pinLogin(newPin);
                toast.success(`Welcome, ${user.username}!`);
                navigate(roleRedirects[user.role] || '/login');
            } catch (err: any) {
                const msg = err.response?.data?.message || 'Invalid PIN';
                setError(msg);
                setPin('');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleBackspace = () => {
        if (loading) return;
        setPin((prev) => prev.slice(0, -1));
    };

    const handleClear = () => {
        if (loading) return;
        setPin('');
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
                        className="h-20 mx-auto mb-6 object-contain drop-shadow-lg select-none"
                        draggable={false}
                    />
                    <p className="text-surface-400 text-lg mt-2">Enter your PIN to sign in</p>
                </div>

                {/* PIN card */}
                <div className="card p-8">
                    {/* PIN dots */}
                    <div className={`flex items-center justify-center gap-5 mb-4 ${error ? 'animate-shake' : ''}`}>
                        {[0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={`w-5 h-5 rounded-full transition-all duration-200 ${error
                                        ? 'bg-red-500 shadow-lg shadow-red-500/30'
                                        : i < pin.length
                                            ? 'bg-brand-500 scale-125 shadow-lg shadow-brand-500/30'
                                            : 'bg-surface-700 border-2 border-surface-600'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Error message */}
                    <div className="h-8 flex items-center justify-center mb-4">
                        {error && (
                            <p className="text-red-400 text-sm font-medium animate-slide-up">{error}</p>
                        )}
                    </div>

                    {/* Loading indicator */}
                    {loading && (
                        <div className="flex justify-center mb-4">
                            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}

                    {/* Number pad */}
                    <div className="grid grid-cols-3 gap-3">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                            <button
                                key={digit}
                                onClick={() => handleDigit(digit)}
                                disabled={loading}
                                className="h-20 rounded-xl text-3xl font-semibold text-surface-100 bg-surface-800/50 border border-surface-700/50 hover:bg-surface-700/70 hover:border-surface-600 active:scale-95 transition-all duration-150 disabled:opacity-50"
                            >
                                {digit}
                            </button>
                        ))}

                        {/* Bottom row: Clear, 0, Backspace */}
                        <button
                            onClick={handleClear}
                            disabled={loading}
                            className="h-20 rounded-xl text-base font-medium text-surface-400 bg-surface-800/30 border border-surface-700/30 hover:bg-surface-700/50 hover:text-surface-200 active:scale-95 transition-all duration-150 disabled:opacity-50"
                        >
                            Clear
                        </button>
                        <button
                            onClick={() => handleDigit('0')}
                            disabled={loading}
                            className="h-20 rounded-xl text-3xl font-semibold text-surface-100 bg-surface-800/50 border border-surface-700/50 hover:bg-surface-700/70 hover:border-surface-600 active:scale-95 transition-all duration-150 disabled:opacity-50"
                        >
                            0
                        </button>
                        <button
                            onClick={handleBackspace}
                            disabled={loading}
                            className="h-20 rounded-xl flex items-center justify-center text-surface-400 bg-surface-800/30 border border-surface-700/30 hover:bg-surface-700/50 hover:text-surface-200 active:scale-95 transition-all duration-150 disabled:opacity-50"
                        >
                            <HiOutlineBackspace className="w-7 h-7" />
                        </button>
                    </div>
                </div>

                {/* Admin login link */}
                <button
                    onClick={() => navigate('/login/admin')}
                    className="flex items-center justify-center gap-2 w-full mt-6 py-3 text-sm text-surface-500 hover:text-brand-400 transition-colors"
                >
                    <HiOutlineShieldCheck className="w-4 h-4" />
                    Login as Admin
                </button>

                <p className="text-center text-surface-500 text-xs mt-4">
                    Servio — Ordering Management System
                </p>
            </div>
        </div>
    );
};

export default PinLoginPage;
