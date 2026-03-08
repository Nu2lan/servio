import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { HiOutlineLogout, HiOutlineMenu } from 'react-icons/hi';

interface LayoutProps {
    children: React.ReactNode;
    title: string;
    navItems?: { label: string; path: string }[];
}

const Layout: React.FC<LayoutProps> = ({ children, title, navItems }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const roleLabelColors: Record<string, string> = {
        admin: 'badge-admin',
        waiter: 'badge-waiter',
        kitchen: 'badge-kitchen',
        cashier: 'badge-cashier',
    };

    return (
        <div className="min-h-screen bg-surface-950">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-surface-900/80 backdrop-blur-xl border-b border-surface-700/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            {navItems && navItems.length > 0 && (
                                <button
                                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                    className="btn-ghost btn-sm md:hidden"
                                >
                                    <HiOutlineMenu className="w-5 h-5" />
                                </button>
                            )}
                            <h1 className="text-lg font-bold text-brand-400">{title}</h1>
                            {user && (
                                <span className={roleLabelColors[user.role] || 'badge'}>
                                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                </span>
                            )}
                        </div>

                        {/* Desktop nav */}
                        {navItems && navItems.length > 0 && (
                            <nav className="hidden md:flex items-center gap-1">
                                {navItems.map((item) => (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${location.pathname === item.path
                                            ? 'bg-brand-500/20 text-brand-400'
                                            : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                        )}

                        <div className="flex items-center gap-3">
                            {user && (
                                <span className="hidden sm:block text-sm text-surface-400">
                                    {user.username}
                                </span>
                            )}
                            <button onClick={handleLogout} className="btn-ghost btn-sm" title="Logout">
                                <HiOutlineLogout className="w-4 h-4" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>

                        </div>
                    </div>
                </div>

                {/* Mobile nav */}
                {mobileMenuOpen && navItems && (
                    <div className="md:hidden border-t border-surface-700/50 bg-surface-900/95 backdrop-blur-xl animate-slide-up">
                        <div className="px-4 py-2 space-y-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all ${location.pathname === item.path
                                        ? 'bg-brand-500/20 text-brand-400'
                                        : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800'
                                        }`}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </header>

            {/* Main content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
                {children}
            </main>
        </div>
    );
};

export default Layout;
