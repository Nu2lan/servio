import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';

interface User {
    _id: string;
    username: string;
    role: string;
    pin?: string;
    isActive: boolean;
    createdAt: string;
}

const adminNav = [
    { label: 'Əsas səhifə', path: '/admin' },
    { label: 'Menyu', path: '/admin/menu' },
    { label: 'Anbar', path: '/admin/inventory' },
    { label: 'İstifadəçilər', path: '/admin/users' },
    { label: 'Hesabatlar', path: '/admin/reports' },
    { label: 'Tənzimləmələr', path: '/admin/settings' },
];

const UserManagement: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ username: '', password: '', role: 'waiter', pin: '' });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/admin/users');
            setUsers(data);
        } catch {
            toast.error('İstifadəçiləri yükləmək mümkün olmadı');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm({ username: '', password: '', role: 'waiter', pin: '' });
        setEditingId(null);
        setShowForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                const payload: any = { username: form.username, role: form.role };
                if (form.password) payload.password = form.password;
                if (form.role !== 'admin') payload.pin = form.pin || '';
                const { data } = await api.put(`/admin/users/${editingId}`, payload);
                setUsers((prev) => prev.map((u) => (u._id === editingId ? { ...u, ...data } : u)));
                toast.success('İstifadəçi yeniləndi');
            } else {
                const payload: any = { ...form };
                if (form.role !== 'admin' && form.pin) payload.pin = form.pin;
                else delete payload.pin;
                const { data } = await api.post('/admin/users', payload);
                setUsers((prev) => [data, ...prev]);
                toast.success('İstifadəçi yaradıldı');
            }
            resetForm();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Əməliyyat uğursuz oldu');
        }
    };

    const handleEdit = (user: User) => {
        setForm({ username: user.username, password: '', role: user.role, pin: user.pin || '' });
        setEditingId(user._id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu istifadəçini silmək istədiyinizə əminsiniz?')) return;
        try {
            await api.delete(`/admin/users/${id}`);
            setUsers((prev) => prev.filter((u) => u._id !== id));
            toast.success('İstifadəçi silindi');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Silmək mümkün olmadı');
        }
    };

    const toggleActive = async (user: User) => {
        try {
            const { data } = await api.put(`/admin/users/${user._id}`, { isActive: !user.isActive });
            setUsers((prev) => prev.map((u) => (u._id === user._id ? { ...u, ...data } : u)));
            toast.success(`İstifadəçi ${data.isActive ? 'aktivləşdirildi' : 'deaktivləşdirildi'}`);
        } catch {
            toast.error('Yeniləmək mümkün olmadı');
        }
    };

    const roleBadge: Record<string, string> = {
        admin: 'badge-admin',
        waiter: 'badge-waiter',
        kitchen: 'badge-kitchen',
        bar: 'badge-bar',
        cashier: 'badge-cashier',
    };

    return (
        <Layout title="Admin Paneli" navItems={adminNav}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-surface-100">İstifadəçi İdarəetməsi</h2>
                    <button
                        onClick={() => { resetForm(); setShowForm(!showForm); }}
                        className={showForm ? 'btn-secondary' : 'btn-primary'}
                    >
                        {showForm ? <><HiOutlineX className="w-4 h-4" /> Ləğv et</> : <><HiOutlinePlus className="w-4 h-4" /> İstifadəçi Əlavə Et</>}
                    </button>
                </div>

                {showForm && (
                    <div className="card animate-slide-up">
                        <h3 className="text-lg font-semibold text-surface-100 mb-4">
                            {editingId ? 'İstifadəçini Redaktə Et' : 'Yeni İstifadəçi Yarat'}
                        </h3>
                        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[140px]">
                                <label className="label">İstifadəçi adı</label>
                                <input
                                    className="input"
                                    value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                                    required
                                    placeholder="e.g. John"
                                />
                            </div>
                            {form.role === 'admin' && (
                                <div>
                                    <label className="label">{editingId ? 'Yeni Şifrə (istəyə bağlı)' : 'Şifrə'}</label>
                                    <input
                                        className="input"
                                        type="password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        required={!editingId}
                                        placeholder="••••••••"
                                    />
                                </div>
                            )}
                            {form.role !== 'admin' && (
                                <div className="w-28">
                                    <label className="label">PIN</label>
                                    <input
                                        className="input font-mono tracking-[0.3em] text-center"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={4}
                                        value={form.pin}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                            setForm({ ...form, pin: val });
                                        }}
                                        placeholder="----"
                                    />
                                </div>
                            )}
                            <div className="w-36">
                                <label className="label">Rol</label>
                                <select
                                    className="input"
                                    value={form.role}
                                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                                >
                                    <option value="waiter">Ofisiant</option>
                                    <option value="kitchen">Mətbəx</option>
                                    <option value="bar">Bar</option>
                                    <option value="cashier">Kassir</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <button type="submit" className="btn-primary whitespace-nowrap">
                                    {editingId ? 'İstifadəçini Yenilə' : 'İstifadəçi Yarat'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Mobile card view */}
                        <div className="md:hidden space-y-3">
                            {users.map((user) => (
                                <div key={user._id} className="card space-y-3 animate-slide-up">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-surface-100">{user.username}</h3>
                                            <p className="text-xs text-surface-400 mt-0.5">{new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={roleBadge[user.role] || 'badge'}>{user.role}</span>
                                            {user.pin && <span className="text-xs font-mono text-surface-400">PIN: {user.pin}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1 border-t border-surface-700/30">
                                        <button
                                            onClick={() => toggleActive(user)}
                                            disabled={user._id === currentUser?.id}
                                            className={`badge transition-all ${user._id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${user.isActive
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                }`}
                                        >
                                            {user.isActive ? 'Aktiv' : 'Deaktiv'}
                                        </button>
                                        <div className="flex-1" />
                                        <button onClick={() => handleEdit(user)} className="btn-ghost btn-sm">
                                            <HiOutlinePencil className="w-4 h-4" /> Redaktə et
                                        </button>
                                        {user._id !== currentUser?.id && (
                                            <button onClick={() => handleDelete(user._id)} className="btn-ghost btn-sm text-red-400 hover:text-red-300">
                                                <HiOutlineTrash className="w-4 h-4" /> Sil
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop table view */}
                        <div className="card overflow-x-auto p-0 hidden md:block">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-700/50 text-surface-400">
                                        <th className="text-left p-4 font-medium">İstifadəçi adı</th>
                                        <th className="text-left p-4 font-medium">Rol</th>
                                        <th className="text-center p-4 font-medium">PİN</th>
                                        <th className="text-center p-4 font-medium">Status</th>
                                        <th className="text-left p-4 font-medium">Yaradılıb</th>
                                        <th className="text-right p-4 font-medium">Əməliyyatlar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user._id} className="border-b border-surface-700/30 hover:bg-surface-800/30 transition">
                                            <td className="p-4 font-medium text-surface-100">{user.username}</td>
                                            <td className="p-4">
                                                <span className={roleBadge[user.role] || 'badge'}>{user.role}</span>
                                            </td>
                                            <td className="p-4 text-center font-mono text-surface-300">
                                                {user.pin || <span className="text-surface-600">—</span>}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => toggleActive(user)}
                                                    disabled={user._id === currentUser?.id}
                                                    title={user._id === currentUser?.id ? 'Öz hesabınızı deaktiv edə bilməzsiniz' : ''}
                                                    className={`badge transition-all ${user._id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${user.isActive
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                        }`}
                                                >
                                                    {user.isActive ? 'Aktiv' : 'Deaktiv'}
                                                </button>
                                            </td>
                                            <td className="p-4 text-surface-400">{new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleEdit(user)} className="btn-ghost btn-sm">
                                                        <HiOutlinePencil className="w-4 h-4" />
                                                    </button>
                                                    {user._id !== currentUser?.id && (
                                                        <button onClick={() => handleDelete(user._id)} className="btn-ghost btn-sm text-red-400 hover:text-red-300">
                                                            <HiOutlineTrash className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};

export default UserManagement;
