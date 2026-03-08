import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck, HiOutlineX } from 'react-icons/hi';

interface Category {
    name: string;
    role: 'kitchen' | 'bar';
}

interface Hall {
    name: string;
    tables: number[];
    type: 'hall' | 'cabinet';
}

const adminNav = [
    { label: 'Dashboard', path: '/admin' },
    { label: 'Menu', path: '/admin/menu' },
    { label: 'Inventory', path: '/admin/inventory' },
    { label: 'Users', path: '/admin/users' },
    { label: 'Reports', path: '/admin/reports' },
    { label: 'Settings', path: '/admin/settings' },
];

const Settings: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [halls, setHalls] = useState<Hall[]>([]);
    const [loading, setLoading] = useState(true);
    const [newCategory, setNewCategory] = useState('');
    const [newCategoryRole, setNewCategoryRole] = useState<'kitchen' | 'bar'>('kitchen');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editRole, setEditRole] = useState<'kitchen' | 'bar'>('kitchen');

    // Hall state
    const [newHallName, setNewHallName] = useState('');
    const [newHallTables, setNewHallTables] = useState('');
    const [newHallType, setNewHallType] = useState<'hall' | 'cabinet'>('hall');
    const [editingHallIndex, setEditingHallIndex] = useState<number | null>(null);
    const [editHallName, setEditHallName] = useState('');
    const [editHallTables, setEditHallTables] = useState('');
    const [editHallType, setEditHallType] = useState<'hall' | 'cabinet'>('hall');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/admin/settings');
            const cats = (data.categories || []).map((c: any) =>
                typeof c === 'string' ? { name: c, role: 'kitchen' } : c
            );
            setCategories(cats);
            setHalls(data.halls || []);
        } catch {
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    // Helper: parse "1-5, 7, 9-12" into [1,2,3,4,5,7,9,10,11,12]
    const parseTableRange = (input: string): number[] => {
        const tables: number[] = [];
        input.split(',').forEach((part) => {
            const trimmed = part.trim();
            if (!trimmed) return;
            const rangeParts = trimmed.split('-').map((s) => parseInt(s.trim()));
            if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
                for (let i = rangeParts[0]; i <= rangeParts[1]; i++) tables.push(i);
            } else if (rangeParts.length === 1 && !isNaN(rangeParts[0])) {
                tables.push(rangeParts[0]);
            }
        });
        return [...new Set(tables)].sort((a, b) => a - b);
    };

    // Helper: [1,2,3,5,7,8,9] => "1-3, 5, 7-9"
    const formatTableRange = (tables: number[]): string => {
        if (!tables.length) return '';
        const sorted = [...tables].sort((a, b) => a - b);
        const ranges: string[] = [];
        let start = sorted[0], end = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === end + 1) {
                end = sorted[i];
            } else {
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                start = end = sorted[i];
            }
        }
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        return ranges.join(', ');
    };

    // ─── Category handlers ───
    const handleAddCategory = async () => {
        if (!newCategory.trim()) return;
        try {
            const { data } = await api.post('/admin/settings/categories', {
                name: newCategory.trim(),
                role: newCategoryRole,
            });
            const cats = (data.categories || []).map((c: any) =>
                typeof c === 'string' ? { name: c, role: 'kitchen' } : c
            );
            setCategories(cats);
            setNewCategory('');
            setNewCategoryRole('kitchen');
            toast.success('Category added');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to add category');
        }
    };

    const handleEditCategory = async (oldName: string) => {
        if (!editValue.trim()) return;
        try {
            const { data } = await api.put('/admin/settings/categories', {
                oldName,
                newName: editValue.trim(),
                role: editRole,
            });
            const cats = (data.categories || []).map((c: any) =>
                typeof c === 'string' ? { name: c, role: 'kitchen' } : c
            );
            setCategories(cats);
            setEditingIndex(null);
            setEditValue('');
            toast.success('Category updated');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update category');
        }
    };

    const handleDeleteCategory = async (name: string) => {
        if (!confirm(`Delete category "${name}"?`)) return;
        try {
            const { data } = await api.delete('/admin/settings/categories', { data: { name } });
            const cats = (data.categories || []).map((c: any) =>
                typeof c === 'string' ? { name: c, role: 'kitchen' } : c
            );
            setCategories(cats);
            toast.success('Category deleted');
        } catch {
            toast.error('Failed to delete category');
        }
    };

    const handleRoleChange = async (cat: Category, newRole: 'kitchen' | 'bar') => {
        try {
            const { data } = await api.put('/admin/settings/categories', {
                oldName: cat.name,
                newName: cat.name,
                role: newRole,
            });
            const cats = (data.categories || []).map((c: any) =>
                typeof c === 'string' ? { name: c, role: 'kitchen' } : c
            );
            setCategories(cats);
            toast.success(`${cat.name} → ${newRole}`);
        } catch {
            toast.error('Failed to update role');
        }
    };

    // ─── Hall handlers ───
    const handleAddHall = async () => {
        if (!newHallName.trim()) return;
        const tables = newHallType === 'cabinet'
            ? parseTableRange(newHallTables).slice(0, 1)
            : parseTableRange(newHallTables);
        try {
            const { data } = await api.post('/admin/settings/halls', {
                name: newHallName.trim(),
                tables,
                type: newHallType,
            });
            setHalls(data.halls || []);
            setNewHallName('');
            setNewHallTables('');
            setNewHallType('hall');
            toast.success(newHallType === 'cabinet' ? 'Cabinet added' : 'Hall added');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to add hall');
        }
    };

    const handleEditHall = async (oldName: string) => {
        if (!editHallName.trim()) return;
        const tables = editHallType === 'cabinet'
            ? parseTableRange(editHallTables).slice(0, 1)
            : parseTableRange(editHallTables);
        try {
            const { data } = await api.put('/admin/settings/halls', {
                oldName,
                newName: editHallName.trim(),
                tables,
                type: editHallType,
            });
            setHalls(data.halls || []);
            setEditingHallIndex(null);
            setEditHallName('');
            setEditHallTables('');
            setEditHallType('hall');
            toast.success('Updated');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update hall');
        }
    };

    const handleDeleteHall = async (name: string) => {
        if (!confirm(`Delete hall "${name}"?`)) return;
        try {
            const { data } = await api.delete('/admin/settings/halls', { data: { name } });
            setHalls(data.halls || []);
            toast.success('Hall deleted');
        } catch {
            toast.error('Failed to delete hall');
        }
    };

    if (loading) {
        return (
            <Layout title="Admin Panel" navItems={adminNav}>
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Admin Panel" navItems={adminNav}>
            <div className="space-y-8">
                <h2 className="text-xl font-bold text-surface-100">Settings</h2>


                {/* ─── Halls Management ─── */}
                <div className="card space-y-4">
                    <h3 className="text-lg font-semibold text-surface-100">Halls & Tables</h3>
                    <p className="text-sm text-surface-400">
                        Create halls and assign table numbers to each. Use ranges like <strong>1-10</strong> or lists like <strong>1, 3, 5-8</strong>.
                    </p>

                    {/* Add new hall/cabinet */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setNewHallType(newHallType === 'hall' ? 'cabinet' : 'hall')}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all whitespace-nowrap ${newHallType === 'cabinet'
                                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                : 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                                }`}
                        >
                            {newHallType === 'cabinet' ? '🚪 Cabinet' : '🏠 Hall'}
                        </button>
                        <input
                            className="input flex-1"
                            value={newHallName}
                            onChange={(e) => setNewHallName(e.target.value)}
                            placeholder={newHallType === 'cabinet' ? 'Cabinet name...' : 'Hall name...'}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddHall()}
                        />
                        {newHallType === 'hall' && (
                            <input
                                className="input w-full sm:w-48"
                                value={newHallTables}
                                onChange={(e) => setNewHallTables(e.target.value)}
                                placeholder="Tables: 1-10"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddHall()}
                            />
                        )}
                        <button onClick={handleAddHall} className="btn-primary">
                            <HiOutlinePlus className="w-4 h-4" />
                            Add
                        </button>
                    </div>

                    {/* Hall list */}
                    <div className="space-y-2">
                        {halls.map((hall, index) => (
                            <div
                                key={index}
                                className="flex flex-wrap items-center justify-between gap-2 py-3 px-4 rounded-xl bg-surface-800/30 border border-surface-700/50 group"
                            >
                                {editingHallIndex === index ? (
                                    <div className="flex flex-wrap items-center gap-2 flex-1">
                                        <button
                                            onClick={() => setEditHallType(editHallType === 'hall' ? 'cabinet' : 'hall')}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${editHallType === 'cabinet'
                                                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                                : 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                                                }`}
                                        >
                                            {editHallType === 'cabinet' ? '🚪' : '🏠'}
                                        </button>
                                        <input
                                            className="input flex-1 py-1.5"
                                            value={editHallName}
                                            onChange={(e) => setEditHallName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleEditHall(hall.name)}
                                            autoFocus
                                            placeholder={editHallType === 'cabinet' ? 'Cabinet name' : 'Hall name'}
                                        />
                                        {editHallType === 'hall' && (
                                            <input
                                                className="input w-full sm:w-48 py-1.5"
                                                value={editHallTables}
                                                onChange={(e) => setEditHallTables(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleEditHall(hall.name)}
                                                placeholder="Tables: 1-10"
                                            />
                                        )}
                                        <button
                                            onClick={() => handleEditHall(hall.name)}
                                            className="btn-ghost btn-sm text-emerald-400 hover:text-emerald-300"
                                        >
                                            <HiOutlineCheck className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setEditingHallIndex(null); setEditHallName(''); setEditHallTables(''); setEditHallType('hall'); }}
                                            className="btn-ghost btn-sm text-surface-400"
                                        >
                                            <HiOutlineX className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-surface-200">{hall.name}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded-full border ${hall.type === 'cabinet'
                                                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                                    : 'bg-brand-500/15 text-brand-400 border-brand-500/30'
                                                    }`}>
                                                    {hall.type === 'cabinet' ? '🚪 Cabinet' : '🏠 Hall'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-surface-500 mt-0.5">
                                                {hall.type === 'cabinet'
                                                    ? 'Uses cabinet name as table'
                                                    : <>Tables: {hall.tables.length > 0 ? formatTableRange(hall.tables) : 'None'}
                                                        <span className="text-surface-600 ml-2">({hall.tables.length} tables)</span></>}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setEditingHallIndex(index);
                                                    setEditHallName(hall.name);
                                                    setEditHallTables(formatTableRange(hall.tables));
                                                    setEditHallType(hall.type || 'hall');
                                                }}
                                                className="btn-ghost btn-sm"
                                            >
                                                <HiOutlinePencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteHall(hall.name)}
                                                className="btn-ghost btn-sm text-red-400 hover:text-red-300"
                                            >
                                                <HiOutlineTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        {halls.length === 0 && (
                            <p className="text-surface-500 text-sm text-center py-4">No halls created yet. Add your first hall above.</p>
                        )}
                    </div>
                </div>

                {/* ─── Categories ─── */}
                <div className="card space-y-4">
                    <h3 className="text-lg font-semibold text-surface-100">Menu Categories</h3>
                    <p className="text-sm text-surface-400">
                        Manage the categories available when adding menu items. Assign each to <strong>Kitchen</strong> or <strong>Bar</strong>.
                    </p>

                    {/* Add new category */}
                    <div className="flex items-center gap-2">
                        <input
                            className="input flex-1"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="New category name..."
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        />
                        <select
                            className="input w-36"
                            value={newCategoryRole}
                            onChange={(e) => setNewCategoryRole(e.target.value as 'kitchen' | 'bar')}
                        >
                            <option value="kitchen">🍳 Kitchen</option>
                            <option value="bar">🍸 Bar</option>
                        </select>
                        <button onClick={handleAddCategory} className="btn-primary">
                            <HiOutlinePlus className="w-4 h-4" />
                            Add
                        </button>
                    </div>

                    {/* Category list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[...categories].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((cat, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface-700/30 transition-colors group"
                            >
                                {editingIndex === index ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            className="input flex-1 py-1.5"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleEditCategory(cat.name)}
                                            autoFocus
                                        />
                                        <select
                                            className="input w-36 py-1.5"
                                            value={editRole}
                                            onChange={(e) => setEditRole(e.target.value as 'kitchen' | 'bar')}
                                        >
                                            <option value="kitchen">🍳 Kitchen</option>
                                            <option value="bar">🍸 Bar</option>
                                        </select>
                                        <button
                                            onClick={() => handleEditCategory(cat.name)}
                                            className="btn-ghost btn-sm text-emerald-400 hover:text-emerald-300"
                                        >
                                            <HiOutlineCheck className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setEditingIndex(null); setEditValue(''); }}
                                            className="btn-ghost btn-sm text-surface-400"
                                        >
                                            <HiOutlineX className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-surface-200">{cat.name.toUpperCase()}</span>
                                            <button
                                                onClick={() => handleRoleChange(cat, cat.role === 'kitchen' ? 'bar' : 'kitchen')}
                                                className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-all ${cat.role === 'kitchen'
                                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                                                    : 'bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25'
                                                    }`}
                                                title={`Click to switch to ${cat.role === 'kitchen' ? 'bar' : 'kitchen'}`}
                                            >
                                                {cat.role === 'kitchen' ? '🍳 Kitchen' : '🍸 Bar'}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingIndex(index); setEditValue(cat.name); setEditRole(cat.role); }}
                                                className="btn-ghost btn-sm"
                                            >
                                                <HiOutlinePencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCategory(cat.name)}
                                                className="btn-ghost btn-sm text-red-400 hover:text-red-300"
                                            >
                                                <HiOutlineTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Settings;
