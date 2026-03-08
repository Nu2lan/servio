import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck, HiOutlineX, HiOutlineSearch } from 'react-icons/hi';

interface InventoryItem {
    _id: string;
    name: string;
    stock: number;
    unit: string;
    lastUpdated: string;
}

const adminNav = [
    { label: 'Dashboard', path: '/admin' },
    { label: 'Menu', path: '/admin/menu' },
    { label: 'Inventory', path: '/admin/inventory' },
    { label: 'Users', path: '/admin/users' },
    { label: 'Reports', path: '/admin/reports' },
    { label: 'Settings', path: '/admin/settings' },
];

const InventoryManagement: React.FC = () => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', stock: '', unit: '' });
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', stock: '', unit: 'ədəd' });
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchInventory();
        const socket = getSocket();

        socket.on('inventory-updated', (updatedItems: InventoryItem[]) => {
            setInventory((prev) =>
                prev.map((item) => {
                    const updated = updatedItems.find((u) => u._id === item._id);
                    return updated ? { ...item, stock: updated.stock, lastUpdated: updated.lastUpdated } : item;
                })
            );
        });

        return () => {
            socket.off('inventory-updated');
        };
    }, []);

    const fetchInventory = async () => {
        try {
            const { data } = await api.get('/admin/inventory');
            setInventory(data);
        } catch {
            toast.error('Failed to load inventory');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/admin/inventory', {
                name: addForm.name,
                stock: parseFloat(addForm.stock) || 0,
                unit: addForm.unit,
            });
            setInventory((prev) => [...prev, data]);
            setAddForm({ name: '', stock: '', unit: 'ədəd' });
            setShowAddForm(false);
            toast.success('Inventory item added');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to add');
        }
    };

    const handleEdit = (item: InventoryItem) => {
        setEditingId(item._id);
        setEditForm({ name: item.name, stock: item.stock.toString(), unit: item.unit });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditForm({ name: '', stock: '', unit: '' });
    };

    const handleSave = async (id: string) => {
        try {
            const { data } = await api.put(`/admin/inventory/${id}`, {
                name: editForm.name,
                stock: parseFloat(editForm.stock),
                unit: editForm.unit,
            });
            setInventory((prev) => prev.map((i) => (i._id === id ? data : i)));
            toast.success('Inventory updated');
            setEditingId(null);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Update failed');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this inventory item? It will also be removed from any menu items using it.')) return;
        try {
            await api.delete(`/admin/inventory/${id}`);
            setInventory((prev) => prev.filter((i) => i._id !== id));
            toast.success('Inventory item deleted');
        } catch {
            toast.error('Failed to delete');
        }
    };

    const getStockBadge = (stock: number) => {
        if (stock <= 0) return 'badge bg-red-500/20 text-red-400 border border-red-500/30';
        if (stock < 10) return 'badge bg-amber-500/20 text-amber-400 border border-amber-500/30';
        return 'badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    };

    const getStockLabel = (stock: number) => {
        if (stock <= 0) return 'Out of stock';
        if (stock < 10) return 'Low stock';
        return 'In stock';
    };

    return (
        <Layout title="Admin Panel" navItems={adminNav}>
            <div className="space-y-6">
                <div className="sticky top-16 z-10 bg-surface-950 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 space-y-3">
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <h2 className="text-xl font-bold text-surface-100 flex-shrink-0">Inventory Management</h2>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                            <div className="relative max-w-xs flex-1 hidden sm:block">
                                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="input w-full pl-9 py-2 text-sm"
                                />
                            </div>
                            <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                className={showAddForm ? 'btn-secondary flex-shrink-0' : 'btn-primary flex-shrink-0'}
                            >
                                {showAddForm ? <><HiOutlineX className="w-4 h-4" /> Cancel</> : <><HiOutlinePlus className="w-4 h-4" /> Add Item</>}
                            </button>
                        </div>
                    </div>
                    <div className="relative sm:hidden">
                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input w-full pl-9 py-2 text-sm"
                        />
                    </div>
                </div>

                {/* Add Form */}
                {showAddForm && (
                    <div className="card animate-slide-up">
                        <h3 className="text-lg font-semibold text-surface-100 mb-4">New Inventory Item</h3>
                        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="label">Name</label>
                                <input
                                    className="input"
                                    value={addForm.name}
                                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                    required
                                    placeholder="e.g. Chicken Breast"
                                />
                            </div>
                            <div>
                                <label className="label">Initial Stock</label>
                                <input
                                    className="input"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={addForm.stock}
                                    onChange={(e) => setAddForm({ ...addForm, stock: e.target.value })}
                                    placeholder="0"
                                />
                            </div>
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="label">Unit</label>
                                    <select
                                        className="input"
                                        value={addForm.unit}
                                        onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                                    >
                                        <option value="ədəd">ədəd</option>
                                        <option value="kq">kq</option>
                                        <option value="litr">litr</option>
                                    </select>
                                </div>
                                <button type="submit" className="btn-primary h-[42px]">
                                    Add
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Edit Modal */}
                {editingId && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:hidden" onClick={handleCancel}>
                        <div className="bg-surface-800 border-t border-surface-700/50 rounded-t-2xl animate-slide-up w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <div className="sticky top-0 bg-surface-800 rounded-t-2xl px-6 pt-4 pb-3 z-10">
                                <div className="flex justify-center mb-3"><div className="w-10 h-1 rounded-full bg-surface-600" /></div>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-surface-100">Edit Inventory Item</h3>
                                    <button onClick={handleCancel} className="btn-ghost btn-sm">
                                        <HiOutlineX className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-4 overflow-y-auto px-6 py-2 flex-1">
                                <div>
                                    <label className="label">Name</label>
                                    <input className="input w-full" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="label">Stock</label>
                                        <input className="input w-full" type="number" min="0" step="0.1" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} placeholder="Stock" />
                                    </div>
                                    <div>
                                        <label className="label">Unit</label>
                                        <select className="input w-full" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}>
                                            <option value="ədəd">ədəd</option>
                                            <option value="kq">kq</option>
                                            <option value="litr">litr</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="sticky bottom-0 bg-surface-800 px-6 py-4 border-t border-surface-700/50 flex items-center gap-2">
                                <button onClick={() => handleSave(editingId)} className="btn-primary flex-1">
                                    <HiOutlineCheck className="w-4 h-4" /> Save
                                </button>
                                <button onClick={handleCancel} className="btn-secondary flex-1">
                                    <HiOutlineX className="w-4 h-4" /> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : inventory.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="card text-center py-12">
                        <p className="text-surface-400">{searchQuery ? 'No items match your search.' : 'No inventory items yet. Add your first item above.'}</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile card view */}
                        <div className="md:hidden space-y-3">
                            {inventory.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                                <div key={item._id} className="card space-y-3 animate-slide-up">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-surface-100">{item.name}</h3>
                                            <p className="text-sm text-surface-400">{item.stock} {item.unit}</p>
                                        </div>
                                        <span className={getStockBadge(item.stock)}>{getStockLabel(item.stock)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1 border-t border-surface-700/30">
                                        <button onClick={() => handleEdit(item)} className="btn-ghost btn-sm flex-1">
                                            <HiOutlinePencil className="w-4 h-4" /> Edit
                                        </button>
                                        <button onClick={() => handleDelete(item._id)} className="btn-ghost btn-sm flex-1 text-red-400 hover:text-red-300">
                                            <HiOutlineTrash className="w-4 h-4" /> Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop table view */}
                        <div className="card overflow-x-auto p-0 hidden md:block">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-surface-700/50 text-surface-400">
                                        <th className="text-left p-4 font-medium">Name</th>
                                        <th className="text-right p-4 font-medium">Stock</th>
                                        <th className="text-left p-4 font-medium">Unit</th>
                                        <th className="text-center p-4 font-medium">Status</th>
                                        <th className="text-right p-4 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventory.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                                        <tr key={item._id} className="border-b border-surface-700/30 hover:bg-surface-800/30 transition">
                                            <td className="p-4">
                                                {editingId === item._id ? (
                                                    <input className="input w-full" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                                                ) : (
                                                    <span className="font-medium text-surface-100">{item.name}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                {editingId === item._id ? (
                                                    <input className="input w-24 text-right" type="number" min="0" step="0.1" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} />
                                                ) : (
                                                    <span className="text-surface-200">{item.stock}</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {editingId === item._id ? (
                                                    <select className="input w-28" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}>
                                                        <option value="ədəd">ədəd</option>
                                                        <option value="kq">kq</option>
                                                        <option value="litr">litr</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-surface-300">{item.unit}</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={getStockBadge(item.stock)}>
                                                    {getStockLabel(item.stock)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {editingId === item._id ? (
                                                        <>
                                                            <button onClick={() => handleSave(item._id)} className="btn-ghost btn-sm text-emerald-400 hover:text-emerald-300">
                                                                <HiOutlineCheck className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={handleCancel} className="btn-ghost btn-sm text-red-400 hover:text-red-300">
                                                                <HiOutlineX className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleEdit(item)} className="btn-ghost btn-sm">
                                                                <HiOutlinePencil className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleDelete(item._id)} className="btn-ghost btn-sm text-red-400 hover:text-red-300">
                                                                <HiOutlineTrash className="w-4 h-4" />
                                                            </button>
                                                        </>
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

export default InventoryManagement;
