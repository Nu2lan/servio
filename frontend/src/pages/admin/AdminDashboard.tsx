import React from 'react';
import Layout from '../../components/Layout';
import { Link } from 'react-router-dom';
import { HiOutlineClipboardList, HiOutlineCube, HiOutlineUsers, HiOutlineChartBar, HiOutlineCog } from 'react-icons/hi';

const sections = [
    { label: 'Menyu İdarəetməsi', desc: 'Menyu elementləri əlavə edin, redaktə edin və ya silin', path: '/admin/menu', icon: HiOutlineClipboardList, color: 'from-brand-500/20 to-brand-600/10 border-brand-500/20' },
    { label: 'Anbar', desc: 'Bütün elementlər üçün ehtiyat səviyyələrini idarə edin', path: '/admin/inventory', icon: HiOutlineCube, color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20' },
    { label: 'İstifadəçilər', desc: 'İşçi hesabları yaradın və idarə edin', path: '/admin/users', icon: HiOutlineUsers, color: 'from-blue-500/20 to-blue-600/10 border-blue-500/20' },
    { label: 'Hesabatlar', desc: 'Sifariş tarixçəsi və anbar jurnalları', path: '/admin/reports', icon: HiOutlineChartBar, color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20' },
    { label: 'Tənzimləmələr', desc: 'Masa sayı və kateqoriya idarəetməsi', path: '/admin/settings', icon: HiOutlineCog, color: 'from-gray-500/20 to-gray-600/10 border-gray-500/20' },
];

const AdminDashboard: React.FC = () => {
    return (
        <Layout
            title="Admin Paneli"
            navItems={[
                { label: 'Əsas səhifə', path: '/admin' },
                { label: 'Menyu', path: '/admin/menu' },
                { label: 'Anbar', path: '/admin/inventory' },
                { label: 'İstifadəçilər', path: '/admin/users' },
                { label: 'Hesabatlar', path: '/admin/reports' },
                { label: 'Tənzimləmələr', path: '/admin/settings' },
            ]}
        >
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-surface-100">Admin İdarə Paneli</h2>
                    <p className="text-surface-400">Restoranınızı buradan idarə edin</p>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                    {sections.map((s) => (
                        <Link
                            key={s.path}
                            to={s.path}
                            className={`card bg-gradient-to-br ${s.color} hover:scale-[1.02] transition-all group overflow-hidden
                                flex flex-col items-center justify-center text-center p-4 aspect-square
                                sm:flex-row sm:items-start sm:justify-start sm:text-left sm:p-6 sm:aspect-auto sm:gap-4`}
                        >
                            <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-2xl sm:rounded-xl bg-surface-800/50 flex items-center justify-center mb-3 sm:mb-0 flex-shrink-0">
                                <s.icon className="w-7 h-7 sm:w-6 sm:h-6 text-surface-200 group-hover:text-brand-400 transition-colors" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-surface-100 mb-0.5">{s.label}</h3>
                                <p className="text-xs sm:text-sm text-surface-400">{s.desc}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </Layout>
    );
};

export default AdminDashboard;
