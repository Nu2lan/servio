import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineSearch } from 'react-icons/hi';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: '' };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error: error.message };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="card text-center py-12">
                    <p className="text-red-400 text-lg font-semibold mb-2">Something went wrong</p>
                    <p className="text-surface-400 text-sm">{this.state.error}</p>
                    <button onClick={() => window.location.reload()} className="btn-primary mt-4">Reload</button>
                </div>
            );
        }
        return this.props.children;
    }
}
interface InventoryItem {
    _id: string;
    name: string;
    stock: number;
    unit: string;
}

interface IngredientInput {
    inventoryItem: string; // ID
    name: string;          // display name
    qty: number;
}

interface MenuItem {
    _id: string;
    name: string;
    price: number;
    category: string;
    isActive: boolean;
    ingredients: {
        inventoryItem: InventoryItem | string;
        qty: number;
    }[];
}

const adminNav = [
    { label: 'Dashboard', path: '/admin' },
    { label: 'Menu', path: '/admin/menu' },
    { label: 'Inventory', path: '/admin/inventory' },
    { label: 'Users', path: '/admin/users' },
    { label: 'Reports', path: '/admin/reports' },
    { label: 'Settings', path: '/admin/settings' },
];

const MenuManagement: React.FC = () => {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', price: '', category: '' });
    const [selectedIngredients, setSelectedIngredients] = useState<IngredientInput[]>([]);
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [showNewInventory, setShowNewInventory] = useState(false);
    const [newInventory, setNewInventory] = useState({ name: '', stock: '', unit: 'ədəd' });
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchItems();
        fetchCategories();
        fetchInventory();
    }, []);

    const fetchCategories = async () => {
        try {
            const { data } = await api.get('/settings');
            const catNames = (data.categories || []).map((c: any) =>
                typeof c === 'string' ? c : c.name
            );
            setCategories(catNames);
            setForm((prev) => ({ ...prev, category: prev.category || catNames[0] || '' }));
        } catch {
            toast.error('Failed to load categories');
        }
    };

    const fetchItems = async () => {
        try {
            const { data } = await api.get('/admin/menu');
            setItems(data);
        } catch {
            toast.error('Failed to load menu items');
        } finally {
            setLoading(false);
        }
    };

    const fetchInventory = async () => {
        try {
            const { data } = await api.get('/admin/inventory');
            setInventoryItems(data);
        } catch {
            toast.error('Failed to load inventory');
        }
    };

    const resetForm = () => {
        setForm({ name: '', price: '', category: categories[0] || '' });
        setSelectedIngredients([]);
        setEditingId(null);
        setShowForm(false);
        setIngredientSearch('');
        setShowNewInventory(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name: form.name,
            price: parseFloat(form.price),
            category: form.category,
            ingredients: selectedIngredients.map((i) => ({
                inventoryItem: i.inventoryItem,
                qty: i.qty,
            })),
        };

        try {
            if (editingId) {
                const { data } = await api.put(`/admin/menu/${editingId}`, payload);
                setItems((prev) => prev.map((i) => (i._id === editingId ? data : i)));
                toast.success('Menu item updated');
            } else {
                const { data } = await api.post('/admin/menu', payload);
                setItems((prev) => [...prev, data]);
                toast.success('Menu item added');
            }
            resetForm();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Operation failed');
        }
    };

    const handleEdit = (item: MenuItem) => {
        setForm({
            name: item.name,
            price: item.price.toString(),
            category: item.category,
        });
        setSelectedIngredients(
            (item.ingredients || []).map((ing) => {
                const inv = ing.inventoryItem as InventoryItem;
                return {
                    inventoryItem: inv._id || (ing.inventoryItem as string),
                    name: inv.name || 'Unknown',
                    qty: ing.qty,
                };
            })
        );
        setEditingId(item._id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;
        try {
            await api.delete(`/admin/menu/${id}`);
            setItems((prev) => prev.filter((i) => i._id !== id));
            toast.success('Menu item deleted');
        } catch {
            toast.error('Failed to delete');
        }
    };

    const toggleIngredient = (inv: InventoryItem) => {
        setSelectedIngredients((prev) => {
            const exists = prev.find((i) => i.inventoryItem === inv._id);
            if (exists) {
                return prev.filter((i) => i.inventoryItem !== inv._id);
            }
            return [...prev, { inventoryItem: inv._id, name: inv.name, qty: 1 }];
        });
    };

    const updateIngredientQty = (invId: string, qty: number) => {
        setSelectedIngredients((prev) =>
            prev.map((i) => (i.inventoryItem === invId ? { ...i, qty } : i))
        );
    };

    const isSelected = (invId: string) => selectedIngredients.some((i) => i.inventoryItem === invId);

    const filteredInventory = inventoryItems.filter((inv) =>
        (inv.name || '').toLowerCase().includes(ingredientSearch.toLowerCase())
    );

    const handleAddNewInventory = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/admin/inventory', {
                name: newInventory.name,
                stock: parseFloat(newInventory.stock) || 0,
                unit: newInventory.unit,
            });
            setInventoryItems((prev) => [...prev, data]);
            // Auto-select the new item
            setSelectedIngredients((prev) => [
                ...prev,
                { inventoryItem: data._id, name: data.name, qty: 1 },
            ]);
            setNewInventory({ name: '', stock: '', unit: 'portions' });
            setShowNewInventory(false);
            toast.success('Inventory item created');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to create inventory item');
        }
    };

    const getIngredientsSummary = (item: MenuItem) => {
        return item.ingredients
            .map((ing) => {
                const inv = ing.inventoryItem as InventoryItem;
                return `${inv?.name || '?'} ×${ing.qty}`;
            })
            .join(', ') || '—';
    };

    return (
        <Layout title="Admin Panel" navItems={adminNav}>
            <div className="space-y-6">
                <div className="sticky top-16 z-10 bg-surface-950 pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 space-y-3">
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <h2 className="text-xl font-bold text-surface-100 flex-shrink-0">Menu Management</h2>
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
                                onClick={() => { resetForm(); setShowForm(!showForm); }}
                                className={showForm ? 'btn-secondary flex-shrink-0' : 'btn-primary flex-shrink-0'}
                            >
                                {showForm ? <><HiOutlineX className="w-4 h-4" /> Cancel</> : <><HiOutlinePlus className="w-4 h-4" /> Add Item</>}
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

                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:hidden" onClick={() => { resetForm(); setShowForm(false); }}>
                        <div className="bg-surface-800 border-t border-surface-700/50 rounded-t-2xl animate-slide-up w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <div className="sticky top-0 bg-surface-800 rounded-t-2xl px-6 pt-4 pb-3 z-10">
                                <div className="flex justify-center mb-3"><div className="w-10 h-1 rounded-full bg-surface-600" /></div>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-surface-100">
                                        {editingId ? 'Edit Menu Item' : 'New Menu Item'}
                                    </h3>
                                    <button onClick={() => { resetForm(); setShowForm(false); }} className="btn-ghost btn-sm">
                                        <HiOutlineX className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                                <div className="space-y-4 overflow-y-auto px-6 py-2 flex-1">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="label">Name</label>
                                            <input
                                                className="input"
                                                value={form.name}
                                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                                required
                                                placeholder="e.g. Grilled Chicken"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Category</label>
                                            <select
                                                className="input"
                                                value={form.category}
                                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                            >
                                                {[...categories].sort((a, b) => a.localeCompare(b)).map((cat) => (
                                                    <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">Price ($)</label>
                                            <input
                                                className="input"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={form.price}
                                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                                                required
                                                placeholder="12.99"
                                            />
                                        </div>
                                    </div>

                                    {/* Ingredients Picker */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="label mb-0">Ingredients (Inventory Items)</label>
                                            <button
                                                type="button"
                                                onClick={() => setShowNewInventory(!showNewInventory)}
                                                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                                            >
                                                <HiOutlinePlus className="w-3 h-3" />
                                                Add New Inventory Item
                                            </button>
                                        </div>

                                        {/* New Inventory Item inline form */}
                                        {showNewInventory && (
                                            <div className="bg-surface-800/50 rounded-xl p-3 mb-3 border border-surface-700/50">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <input
                                                        className="input text-sm"
                                                        placeholder="Item name"
                                                        value={newInventory.name}
                                                        onChange={(e) => setNewInventory({ ...newInventory, name: e.target.value })}
                                                    />
                                                    <input
                                                        className="input text-sm"
                                                        type="number"
                                                        placeholder="Initial stock"
                                                        min="0"
                                                        value={newInventory.stock}
                                                        onChange={(e) => setNewInventory({ ...newInventory, stock: e.target.value })}
                                                    />
                                                    <div className="flex gap-2">
                                                        <select
                                                            className="input text-sm flex-1"
                                                            value={newInventory.unit}
                                                            onChange={(e) => setNewInventory({ ...newInventory, unit: e.target.value })}
                                                        >
                                                            <option value="ədəd">ədəd</option>
                                                            <option value="kq">kq</option>
                                                            <option value="litr">litr</option>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            onClick={handleAddNewInventory}
                                                            className="btn-primary text-xs px-3"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Search inventory */}
                                        <div className="relative mb-2">
                                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                            <input
                                                className="input pl-9 text-sm"
                                                placeholder="Search inventory items..."
                                                value={ingredientSearch}
                                                onChange={(e) => setIngredientSearch(e.target.value)}
                                            />
                                        </div>

                                        {/* Inventory items list */}
                                        <div className="bg-surface-800/30 rounded-xl border border-surface-700/50 max-h-48 overflow-y-auto">
                                            {filteredInventory.length === 0 ? (
                                                <p className="text-surface-500 text-sm text-center py-4">
                                                    No inventory items found. Create one above.
                                                </p>
                                            ) : (
                                                filteredInventory.map((inv) => {
                                                    const selected = isSelected(inv._id);
                                                    const ingredient = selectedIngredients.find((i) => i.inventoryItem === inv._id);
                                                    return (
                                                        <div
                                                            key={inv._id}
                                                            className={`flex items-center justify-between px-3 py-2 border-b border-surface-700/30 last:border-b-0 cursor-pointer transition-all ${selected ? 'bg-brand-500/10' : 'hover:bg-surface-700/30'
                                                                }`}
                                                            onClick={() => toggleIngredient(inv)}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selected
                                                                        ? 'bg-brand-500 border-brand-500'
                                                                        : 'border-surface-600'
                                                                        }`}
                                                                >
                                                                    {selected && (
                                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <span className="text-sm font-medium text-surface-200">{inv.name}</span>
                                                                    <span className="text-xs text-surface-500 ml-2">
                                                                        ({inv.stock} {inv.unit})
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {selected && (
                                                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                    <label className="text-xs text-surface-400">Qty:</label>
                                                                    <input
                                                                        className="input w-20 text-sm text-right"
                                                                        type="number"
                                                                        value={ingredient?.qty ?? ''}
                                                                        onChange={(e) => updateIngredientQty(inv._id, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                                        onFocus={(e) => e.target.select()}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>

                                        {/* Selected summary */}
                                        {selectedIngredients.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {selectedIngredients.map((ing) => (
                                                    <span
                                                        key={ing.inventoryItem}
                                                        className="badge bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs"
                                                    >
                                                        {ing.name} ×{ing.qty}
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedIngredients((prev) => prev.filter((i) => i.inventoryItem !== ing.inventoryItem))}
                                                            className="ml-1 hover:text-red-400"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                </div>
                                <div className="sticky bottom-0 bg-surface-800 px-6 py-4 border-t border-surface-700/50 flex items-center gap-2">
                                    <button type="submit" className="btn-primary flex-1">
                                        {editingId ? 'Update Item' : 'Add Item'}
                                    </button>
                                    <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="btn-secondary flex-1">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Desktop inline form */}
                {showForm && (
                    <div className="hidden md:block card animate-slide-up">
                        <h3 className="text-lg font-semibold text-surface-100 mb-4">
                            {editingId ? 'Edit Menu Item' : 'New Menu Item'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="label">Name</label>
                                    <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Grilled Chicken" />
                                </div>
                                <div>
                                    <label className="label">Category</label>
                                    <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                        {[...categories].sort((a, b) => a.localeCompare(b)).map((cat) => (
                                            <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Price ($)</label>
                                    <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required placeholder="12.99" />
                                </div>
                            </div>
                            {/* Ingredients Picker */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="label mb-0">Ingredients (Inventory Items)</label>
                                    <button type="button" onClick={() => setShowNewInventory(!showNewInventory)} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                                        <HiOutlinePlus className="w-3 h-3" /> Add New Inventory Item
                                    </button>
                                </div>
                                {showNewInventory && (
                                    <div className="bg-surface-800/50 rounded-xl p-3 mb-3 border border-surface-700/50">
                                        <div className="grid grid-cols-3 gap-2">
                                            <input className="input text-sm" placeholder="Item name" value={newInventory.name} onChange={(e) => setNewInventory({ ...newInventory, name: e.target.value })} />
                                            <input className="input text-sm" type="number" placeholder="Initial stock" min="0" value={newInventory.stock} onChange={(e) => setNewInventory({ ...newInventory, stock: e.target.value })} />
                                            <div className="flex gap-2">
                                                <select className="input text-sm flex-1" value={newInventory.unit} onChange={(e) => setNewInventory({ ...newInventory, unit: e.target.value })}>
                                                    <option value="ədəd">ədəd</option>
                                                    <option value="kq">kq</option>
                                                    <option value="litr">litr</option>
                                                </select>
                                                <button type="button" onClick={handleAddNewInventory} className="btn-primary text-xs px-3">Add</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="relative mb-2">
                                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                    <input className="input pl-9 text-sm" placeholder="Search inventory items..." value={ingredientSearch} onChange={(e) => setIngredientSearch(e.target.value)} />
                                </div>
                                <div className="bg-surface-800/30 rounded-xl border border-surface-700/50 max-h-48 overflow-y-auto">
                                    {filteredInventory.length === 0 ? (
                                        <p className="text-surface-500 text-sm text-center py-4">No inventory items found. Create one above.</p>
                                    ) : (
                                        filteredInventory.map((inv) => {
                                            const selected = isSelected(inv._id);
                                            const ingredient = selectedIngredients.find((i) => i.inventoryItem === inv._id);
                                            return (
                                                <div key={inv._id} className={`flex items-center justify-between px-3 py-2 border-b border-surface-700/30 last:border-b-0 cursor-pointer transition-all ${selected ? 'bg-brand-500/10' : 'hover:bg-surface-700/30'}`} onClick={() => toggleIngredient(inv)}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-brand-500 border-brand-500' : 'border-surface-600'}`}>
                                                            {selected && (<svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>)}
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-medium text-surface-200">{inv.name}</span>
                                                            <span className="text-xs text-surface-500 ml-2">({inv.stock} {inv.unit})</span>
                                                        </div>
                                                    </div>
                                                    {selected && (
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <label className="text-xs text-surface-400">Qty:</label>
                                                            <input className="input w-20 text-sm text-right" type="number" value={ingredient?.qty ?? ''} onChange={(e) => updateIngredientQty(inv._id, e.target.value === '' ? 0 : parseFloat(e.target.value))} onFocus={(e) => e.target.select()} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                {selectedIngredients.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selectedIngredients.map((ing) => (
                                            <span key={ing.inventoryItem} className="badge bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs">
                                                {ing.name} ×{ing.qty}
                                                <button type="button" onClick={() => setSelectedIngredients((prev) => prev.filter((i) => i.inventoryItem !== ing.inventoryItem))} className="ml-1 hover:text-red-400">×</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button type="submit" className="btn-primary flex-1">
                                    {editingId ? 'Update Item' : 'Add Item'}
                                </button>
                                <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="btn-secondary flex-1">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Items table */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="card text-center py-12">
                        <p className="text-surface-400">{searchQuery ? 'No items match your search.' : 'No menu items yet. Add your first item above.'}</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile card view */}
                        <div className="md:hidden space-y-3">
                            {items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                                <div key={item._id} className="card space-y-3 animate-slide-up">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-surface-100">{item.name}</h3>
                                            <p className="text-xs text-surface-400 mt-0.5">{item.category.toUpperCase()}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold text-surface-100">{(item.price ?? 0).toFixed(2)} AZN</span>
                                            <span className={item.isActive ? 'badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'badge bg-red-500/20 text-red-400 border border-red-500/30'}>
                                                {item.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                    {(item.ingredients || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {item.ingredients.map((ing, idx) => {
                                                const inv = ing.inventoryItem as InventoryItem;
                                                return (
                                                    <span key={idx} className="badge bg-surface-700/50 text-surface-300 text-xs">
                                                        {inv?.name || '?'} ×{ing.qty}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
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
                                        <th className="text-left p-4 font-medium">Category</th>
                                        <th className="text-right p-4 font-medium">Price</th>
                                        <th className="text-left p-4 font-medium">Ingredients</th>
                                        <th className="text-center p-4 font-medium">Status</th>
                                        <th className="text-right p-4 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                                        <tr key={item._id} className="border-b border-surface-700/30 hover:bg-surface-800/30 transition">
                                            <td className="p-4 font-medium text-surface-100">{item.name}</td>
                                            <td className="p-4 text-surface-300">{item.category.toUpperCase()}</td>
                                            <td className="p-4 text-right text-surface-200">{(item.price ?? 0).toFixed(2)} AZN</td>
                                            <td className="p-4 text-surface-300 text-xs max-w-xs">
                                                <div className="flex flex-wrap gap-1">
                                                    {(item.ingredients || []).length > 0 ?
                                                        (item.ingredients || []).map((ing, idx) => {
                                                            const inv = ing.inventoryItem as InventoryItem;
                                                            return (
                                                                <span key={idx} className="badge bg-surface-700/50 text-surface-300 text-xs">
                                                                    {inv?.name || '?'} ×{ing.qty}
                                                                </span>
                                                            );
                                                        })
                                                        : <span className="text-surface-500">—</span>
                                                    }
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={item.isActive ? 'badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'badge bg-red-500/20 text-red-400 border border-red-500/30'}>
                                                    {item.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleEdit(item)} className="btn-ghost btn-sm">
                                                        <HiOutlinePencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(item._id)} className="btn-ghost btn-sm text-red-400 hover:text-red-300">
                                                        <HiOutlineTrash className="w-4 h-4" />
                                                    </button>
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
        </Layout >
    );
};

const MenuManagementWithBoundary: React.FC = () => (
    <ErrorBoundary>
        <MenuManagement />
    </ErrorBoundary>
);

export default MenuManagementWithBoundary;
