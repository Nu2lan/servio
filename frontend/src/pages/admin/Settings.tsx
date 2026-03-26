import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck, HiOutlineX, HiOutlineClock, HiOutlinePrinter, HiOutlineRefresh, HiOutlineChevronDown } from 'react-icons/hi';
import qz from 'qz-tray';
import { initQzSecurity } from '../../lib/printReceipt';

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
    { label: 'Əsas səhifə', path: '/admin' },
    { label: 'Menyu', path: '/admin/menu' },
    { label: 'Anbar', path: '/admin/inventory' },
    { label: 'İstifadəçilər', path: '/admin/users' },
    { label: 'Hesabatlar', path: '/admin/reports' },
    { label: 'Tənzimləmələr', path: '/admin/settings' },
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

    // Working hours state
    const [workingHoursStart, setWorkingHoursStart] = useState('10:00');
    const [workingHoursEnd, setWorkingHoursEnd] = useState('02:00');
    const [savedStart, setSavedStart] = useState('10:00');
    const [savedEnd, setSavedEnd] = useState('02:00');

    // Printers state
    const [printers, setPrinters] = useState<string[]>([]);
    const [qzConnected, setQzConnected] = useState(false);
    const [findingPrinters, setFindingPrinters] = useState(false);
    
    const [printerReceipt, setPrinterReceipt] = useState('');
    const [printerKitchen, setPrinterKitchen] = useState('');
    const [printerBar, setPrinterBar] = useState('');
    const [printerCancel, setPrinterCancel] = useState('');
    const [savedPrinters, setSavedPrinters] = useState({
        receipt: '', kitchen: '', bar: '', cancel: ''
    });

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
            setWorkingHoursStart(data.workingHoursStart || '10:00');
            setWorkingHoursEnd(data.workingHoursEnd || '02:00');
            setSavedStart(data.workingHoursStart || '10:00');
            setSavedEnd(data.workingHoursEnd || '02:00');
            setPrinterReceipt(data.printerReceipt || '');
            setPrinterKitchen(data.printerKitchen || '');
            setPrinterBar(data.printerBar || '');
            setPrinterCancel(data.printerCancel || '');
            setSavedPrinters({
                receipt: data.printerReceipt || '',
                kitchen: data.printerKitchen || '',
                bar: data.printerBar || '',
                cancel: data.printerCancel || ''
            });
        } catch {
            toast.error('Tənzimləmələri yükləmək mümkün olmadı');
        } finally {
            setLoading(false);
        }
    };

    const connectAndFindPrinters = async () => {
        setFindingPrinters(true);
        initQzSecurity();
        try {
            if (!qz.websocket.isActive()) {
                await qz.websocket.connect({ retries: 2, delay: 1 });
            }
            setQzConnected(true);
            const list = await qz.printers.find();
            setPrinters(list);
            toast.success('Printerlər uğurla tapıldı');
        } catch (err) {
            console.error('QZ connection error:', err);
            toast.error('QZ Tray ilə əlaqə qurulmadı. QZ Tray-in arxa planda işlədiyindən əmin olun.');
            setQzConnected(false);
        } finally {
            setFindingPrinters(false);
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
            toast.success('Kateqoriya əlavə edildi');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Kateqoriya əlavə etmək mümkün olmadı');
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
            toast.success('Kateqoriya yeniləndi');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Kateqoriyanı yeniləmək mümkün olmadı');
        }
    };

    const handleDeleteCategory = async (name: string) => {
        if (!confirm(`"${name}" kateqoriyasını silməyə əminsiniz?`)) return;
        try {
            const { data } = await api.delete('/admin/settings/categories', { data: { name } });
            const cats = (data.categories || []).map((c: any) =>
                typeof c === 'string' ? { name: c, role: 'kitchen' } : c
            );
            setCategories(cats);
            toast.success('Kateqoriya silindi');
        } catch {
            toast.error('Kateqoriyanı silmək mümkün olmadı');
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
            toast.success(`${cat.name} → ${newRole === 'kitchen' ? 'mətbəx' : 'bar'}`);
        } catch {
            toast.error('Rolu yeniləmək mümkün olmadı');
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
            toast.success(newHallType === 'cabinet' ? 'Kabinet əlavə edildi' : 'Zal əlavə edildi');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Zal əlavə etmək mümkün olmadı');
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
            toast.success('Yeniləndi');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Zalı yeniləmək mümkün olmadı');
        }
    };

    const handleDeleteHall = async (name: string) => {
        if (!confirm(`"${name}" zalını silməyə əminsiniz?`)) return;
        try {
            const { data } = await api.delete('/admin/settings/halls', { data: { name } });
            setHalls(data.halls || []);
            toast.success('Zal silindi');
        } catch {
            toast.error('Zalı silmək mümkün olmadı');
        }
    };

    if (loading) {
        return (
            <Layout title="Admin Paneli" navItems={adminNav}>
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Admin Paneli" navItems={adminNav}>
            <div className="space-y-8">
                <h2 className="text-xl font-bold text-surface-100">Tənzimləmələr</h2>

                {/* ─── Working Hours ─── */}
                <div className="card">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 mr-auto">
                            <HiOutlineClock className="w-5 h-5 text-brand-400" />
                            <h3 className="text-base font-semibold text-surface-100">İş saatları</h3>
                        </div>
                        <input
                            type="text"
                            className="input w-20 text-center font-mono"
                            value={workingHoursStart}
                            onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                                const formatted = digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
                                setWorkingHoursStart(formatted);
                            }}
                            placeholder="10:00"
                            maxLength={5}
                        />
                        <span className="text-surface-400 font-medium">–</span>
                        <input
                            type="text"
                            className="input w-20 text-center font-mono"
                            value={workingHoursEnd}
                            onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                                const formatted = digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
                                setWorkingHoursEnd(formatted);
                            }}
                            placeholder="02:00"
                            maxLength={5}
                        />
                        <button
                            onClick={async () => {
                                try {
                                    await api.put('/admin/settings', { workingHoursStart, workingHoursEnd });
                                    setSavedStart(workingHoursStart);
                                    setSavedEnd(workingHoursEnd);
                                    toast.success('İş saatları yeniləndi');
                                } catch {
                                    toast.error('İş saatlarını saxlamaq mümkün olmadı');
                                }
                            }}
                            disabled={workingHoursStart === savedStart && workingHoursEnd === savedEnd}
                            className="btn-primary disabled:opacity-40"
                        >
                            <HiOutlineCheck className="w-4 h-4" />
                            Saxla
                        </button>
                    </div>
                </div>

                {/* ─── Printers (QZ Tray) ─── */}
                <div className="card space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <HiOutlinePrinter className="w-5 h-5 text-brand-400" />
                            <h3 className="text-lg font-semibold text-surface-100">Çap Qurğuları (Səssiz Çap)</h3>
                        </div>
                        <button
                            onClick={connectAndFindPrinters}
                            disabled={findingPrinters}
                            className="btn-secondary text-xs h-8 px-3"
                        >
                            <HiOutlineRefresh className={`w-4 h-4 ${findingPrinters ? 'animate-spin' : ''}`} />
                            {printers.length > 0 ? 'Yenidən Axtar' : 'Axtar'}
                        </button>
                    </div>
                    <p className="text-sm text-surface-400">
                        Səssiz çap üçün QZ Tray proqramı aktiv olmalıdır.{' '}
                        {!qzConnected && <span className="text-brand-400">Printerləri seçmək üçün "Axtar" düyməsinə basın.</span>}
                        {qzConnected && <span className="text-green-400">QZ Tray qoşuludur ({printers.length} printer tapıldı).</span>}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { label: 'Kassa (Hesab, Gün sonu)', value: printerReceipt, setter: setPrinterReceipt },
                            { label: 'Mətbəx', value: printerKitchen, setter: setPrinterKitchen },
                            { label: 'Bar', value: printerBar, setter: setPrinterBar },
                            { label: 'Silinmə (Ləğv)', value: printerCancel, setter: setPrinterCancel },
                        ].map((item, i) => (
                            <div key={i} className="space-y-1">
                                <label className="block text-xs text-surface-400">{item.label}</label>
                                <div className="relative">
                                    <select
                                        className="input w-full appearance-none bg-surface-900 pr-10"
                                        value={item.value}
                                        onChange={(e) => item.setter(e.target.value)}
                                    >
                                        <option value="">(Varsayılan brauzer pəncərəsi)</option>
                                        {printers.map(p => <option key={p} value={p}>{p}</option>)}
                                        {/* Include current value if it's not in the detected list so it doesn't get lost */}
                                        {item.value && !printers.includes(item.value) && (
                                            <option value={item.value}>{item.value} (bağlıdır/tapılmadı)</option>
                                        )}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-surface-400">
                                        <HiOutlineChevronDown className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={async () => {
                                try {
                                    await api.put('/admin/settings', { printerReceipt, printerKitchen, printerBar, printerCancel });
                                    setSavedPrinters({ receipt: printerReceipt, kitchen: printerKitchen, bar: printerBar, cancel: printerCancel });
                                    toast.success('Çap qurğuları yadda saxlanıldı');
                                } catch {
                                    toast.error('Çap qurğularını saxlamaq mümkün olmadı');
                                }
                            }}
                            disabled={
                                printerReceipt === savedPrinters.receipt &&
                                printerKitchen === savedPrinters.kitchen &&
                                printerBar === savedPrinters.bar &&
                                printerCancel === savedPrinters.cancel
                            }
                            className="btn-primary"
                        >
                            <HiOutlineCheck className="w-4 h-4" />
                            Saxla
                        </button>
                    </div>
                </div>


                {/* ─── Halls Management ─── */}
                <div className="card space-y-4">
                    <h3 className="text-lg font-semibold text-surface-100">Zallar və Masalar</h3>
                    <p className="text-sm text-surface-400">
                        Zallar yaradın və hər birinə masa nömrələri təyin edin. <strong>1-10</strong> kimi aralıqlar və ya <strong>1, 3, 5-8</strong> kimi siyahılar istifadə edin.
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
                            {newHallType === 'cabinet' ? '🚪 Kabinet' : '🏠 Zal'}
                        </button>
                        <input
                            className="input flex-1"
                            value={newHallName}
                            onChange={(e) => setNewHallName(e.target.value)}
                            placeholder={newHallType === 'cabinet' ? 'Kabinet adı...' : 'Zal adı...'}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddHall()}
                        />
                        {newHallType === 'hall' && (
                            <input
                                className="input w-full sm:w-48"
                                value={newHallTables}
                                onChange={(e) => setNewHallTables(e.target.value)}
                                placeholder="Masalar: 1-10"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddHall()}
                            />
                        )}
                        <button onClick={handleAddHall} className="btn-primary">
                            <HiOutlinePlus className="w-4 h-4" />
                            Əlavə et
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
                                            placeholder={editHallType === 'cabinet' ? 'Kabinet adı' : 'Zal adı'}
                                        />
                                        {editHallType === 'hall' && (
                                            <input
                                                className="input w-full sm:w-48 py-1.5"
                                                value={editHallTables}
                                                onChange={(e) => setEditHallTables(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleEditHall(hall.name)}
                                                placeholder="Masalar: 1-10"
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
                                                    {hall.type === 'cabinet' ? '🚪 Kabinet' : '🏠 Zal'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-surface-500 mt-0.5">
                                                {hall.type === 'cabinet'
                                                    ? 'Kabinetin adını masa kimi istifadə edir'
                                                    : <>Masalar: {hall.tables.length > 0 ? formatTableRange(hall.tables) : 'Yoxdur'}
                                                        <span className="text-surface-600 ml-2">({hall.tables.length} masa)</span></>}
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
                            <p className="text-surface-500 text-sm text-center py-4">Hələ zal yaradılmayıb. İlk zalınızı yuxarıdan əlavə edin.</p>
                        )}
                    </div>
                </div>

                {/* ─── Categories ─── */}
                <div className="card space-y-4">
                    <h3 className="text-lg font-semibold text-surface-100">Menyu Kateqoriyaları</h3>
                    <p className="text-sm text-surface-400">
                        Menyu elementləri əlavə edərkən mövcud olan kateqoriyaları idarə edin. Hər birini <strong>Mətbəx</strong> və ya <strong>Bar</strong>-a təyin edin.
                    </p>

                    {/* Add new category */}
                    <div className="flex items-center gap-2">
                        <input
                            className="input flex-1"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="Yeni kateqoriya adı..."
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        />
                        <select
                            className="input w-36"
                            value={newCategoryRole}
                            onChange={(e) => setNewCategoryRole(e.target.value as 'kitchen' | 'bar')}
                        >
                            <option value="kitchen">🍳 Mətbəx</option>
                            <option value="bar">🍸 Bar</option>
                        </select>
                        <button onClick={handleAddCategory} className="btn-primary">
                            <HiOutlinePlus className="w-4 h-4" />
                            Əlavə et
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
                                            <option value="kitchen">🍳 Mətbəx</option>
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
                                                title={`Klikləyib ${cat.role === 'kitchen' ? 'bara' : 'mətbəxə'} dəyişin`}
                                            >
                                                {cat.role === 'kitchen' ? '🍳 Mətbəx' : '🍸 Bar'}
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
