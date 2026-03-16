'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import toast from 'react-hot-toast'

interface Category {
    id: string
    code: string
    name: string
    icon: string
    color: string
    _count: { products: number }
}

const RAW_CODES = ['RAW_MEAT', 'RAW_PORK', 'RAW_POULTRY', 'RAW_SEA', 'EGG', 'RAW_VEG', 'DRY_GOODS', 'OTHER', 'DAIRY', 'CHEESE', 'FLOUR_DOUGH', 'BOX_BAG', 'TISSUE_CLEAN', 'DISPOSABLE', 'PACKAGING']

const SALE_TYPES = ['SALE_ITEM', 'ENTERTAIN', 'SET_MENU']

const TYPE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
    SALE_ITEM:   { label: '🛒 ขายหน้าร้าน', bg: '#DCFCE7', color: '#166534' },
    ENTERTAIN:   { label: '🎉 จัดเลี้ยง',   bg: '#FEF9C3', color: '#854D0E' },
    SET_MENU:    { label: '🍱 เซ็ตเมนู',    bg: '#EDE9FE', color: '#5B21B6' },
    RAW_MATERIAL:{ label: '🥩 วัตถุดิบ',    bg: '#FEE2E2', color: '#991B1B' },
    PACKAGING:   { label: '📦 บรรจุภัณฑ์',  bg: '#FFEDD5', color: '#9A3412' },
    OVERHEAD:    { label: '💼 ค่าใช้จ่าย',  bg: '#F3F4F6', color: '#374151' },
}

function isStock(code: string) {
    if (code.startsWith('CUSTOM_RAW_')) return true
    if (code.startsWith('CUSTOM_MENU_')) return false
    return RAW_CODES.includes(code)
}

function isMismatch(catIsStock: boolean, productType: string) {
    const isSale = SALE_TYPES.includes(productType)
    return catIsStock ? isSale : !isSale
}

export default function CategoriesSettingsPage() {
    useRoleGuard(['owner', 'manager'])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'MENU' | 'STOCK'>('MENU')

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [form, setForm] = useState({ id: '', name: '', icon: '🏷️', color: '#6B7280', type: 'MENU' })
    const [saving, setSaving] = useState(false)

    // Move Products Modal state
    const [showMoveModal, setShowMoveModal] = useState(false)
    const [movingCategory, setMovingCategory] = useState<Category | null>(null)
    const [movingProducts, setMovingProducts] = useState<any[]>([])
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
    const [targetCategoryId, setTargetCategoryId] = useState('')
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [moving, setMoving] = useState(false)

    const fetchCategories = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/categories')
            const json = await res.json()
            if (json.success) {
                setCategories(json.data)
            } else {
                toast.error(json.error || 'โหลดข้อมูลไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    const menuCats = categories.filter(c => !isStock(c.code))
    const stockCats = categories.filter(c => isStock(c.code))
    const displayCats = activeTab === 'MENU' ? menuCats : stockCats

    const openCreate = () => {
        setForm({ id: '', name: '', icon: '🏷️', color: activeTab === 'MENU' ? '#059669' : '#DC2626', type: activeTab })
        setEditMode(false)
        setShowModal(true)
    }

    const openEdit = (cat: Category) => {
        setForm({
            id: cat.id,
            name: cat.name,
            icon: cat.icon || '🏷️',
            color: cat.color || '#6B7280',
            type: isStock(cat.code) ? 'STOCK' : 'MENU'
        })
        setEditMode(true)
        setShowModal(true)
    }

    const handleDelete = async (cat: Category) => {
        if (cat._count.products > 0) {
            toast.error(`ไม่สามารถลบได้ มีสินค้าผูกอยู่ ${cat._count.products} รายการ`)
            return
        }
        if (!confirm(`ยืนยันการลบหมวดหมู่ "${cat.name}"?`)) return
        
        try {
            const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' })
            const json = await res.json()
            if (json.success) {
                toast.success('ลบหมวดหมู่เรียบร้อย')
                fetchCategories()
            } else {
                toast.error(json.error || 'ลบไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาดในการลบ')
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name.trim()) return toast.error('กรุณาระบุชื่อหมวดหมู่')
        setSaving(true)
        try {
            const url = editMode ? `/api/categories/${form.id}` : '/api/categories'
            const method = editMode ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    icon: form.icon,
                    color: form.color,
                    type: form.type
                })
            })
            const json = await res.json()
            if (json.success) {
                toast.success(editMode ? 'อัพเดตเรียบร้อย' : 'สร้างหมวดหมู่เรียบร้อย')
                setShowModal(false)
                fetchCategories()
            } else {
                toast.error(json.error || 'บันทึกไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาดในการบันทึก')
        } finally {
            setSaving(false)
        }
    }

    const openMoveProducts = async (cat: Category) => {
        setMovingCategory(cat)
        setTargetCategoryId('')
        setSelectedProductIds([])
        setMovingProducts([])
        setShowMoveModal(true)
        setLoadingProducts(true)
        try {
            const res = await fetch(`/api/products?categoryId=${cat.id}&limit=500`)
            const json = await res.json()
            if (res.ok && (json.products || json.data?.products)) {
                const products = json.products || json.data?.products
                setMovingProducts(products)
                setSelectedProductIds(products.map((p: any) => p.id))
            } else {
                toast.error(json.error || 'ไม่สามารถดึงข้อมูลสินค้าได้')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลสินค้า')
        } finally {
            setLoadingProducts(false)
        }
    }

    const handleMoveSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedProductIds.length === 0) return toast.error('กรุณาเลือกสินค้าที่ต้องการย้าย')
        if (!targetCategoryId) return toast.error('กรุณาเลือกหมวดหมู่ปลายทาง')
        if (targetCategoryId === movingCategory?.id) return toast.error('หมวดหมู่ปลายทางต้องไม่ซ้ำกับหมวดหมู่ปัจจุบัน')
        
        setMoving(true)
        try {
            const res = await fetch('/api/products/bulk-move', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productIds: selectedProductIds,
                    targetCategoryId
                })
            })
            const json = await res.json()
            if (json.success) {
                toast.success(json.data?.message || 'ย้ายสินค้าเรียบร้อย')
                setShowMoveModal(false)
                fetchCategories() 
            } else {
                toast.error(json.error || 'ย้ายสินค้าไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาดในการย้ายสินค้า')
        } finally {
            setMoving(false)
        }
    }

    const toggleProductSelection = (id: string) => {
        setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }
    
    const toggleSelectAll = () => {
        if (selectedProductIds.length === movingProducts.length) setSelectedProductIds([])
        else setSelectedProductIds(movingProducts.map(p => p.id))
    }

    const selectMismatch = () => {
        if (!movingCategory) return
        const catIsStock = isStock(movingCategory.code)
        const mismatched = movingProducts.filter(p => isMismatch(catIsStock, p.productType))
        setSelectedProductIds(mismatched.map(p => p.id))
    }

    const mismatchCount = movingCategory
        ? movingProducts.filter(p => isMismatch(isStock(movingCategory.code), p.productType)).length
        : 0

    const PRESET_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#6B7280', '#374151']
    const PRESET_ICONS = ['🏷️', '🍽️', '🥤', '🍺', '🥩', '🥦', '📦', '🥡', '🐟', '🥚', '🥛', '🌶️', '🍜', '🍱', '🍧', '🥐', '🍗', '🍟', '🧀']

    return (
        <div className="page-container" style={{ maxWidth: 1000 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '1rem' }}>
                <div>
                    <h1 className="page-title">📂 จัดการหมวดหมู่สินค้า (Categories)</h1>
                    <p className="page-subtitle">จัดการหมวดหมู่สำหรับเมนูหน้าร้านและวัตถุดิบหลังบ้าน</p>
                </div>
                <button suppressHydrationWarning onClick={openCreate} className="btn-primary" style={{ padding: '0.6rem 1.25rem', minHeight: 44 }}>
                    ➕ สร้างหมวดหมู่
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', background: '#fff', padding: 6, borderRadius: 14, border: '1px solid var(--border)', width: 'fit-content' }}>
                <button
                    suppressHydrationWarning
                    onClick={() => setActiveTab('MENU')}
                    style={{
                        padding: '10px 24px', borderRadius: 10, fontSize: '0.9rem', fontWeight: activeTab === 'MENU' ? 700 : 500,
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                        background: activeTab === 'MENU' ? '#059669' : 'transparent',
                        color: activeTab === 'MENU' ? '#fff' : '#6B7280',
                        boxShadow: activeTab === 'MENU' ? '0 4px 12px rgba(5,150,105,0.2)' : 'none'
                    }}
                >
                    🍽️ หมวดหมู่เมนู ({menuCats.length})
                </button>
                <button
                    suppressHydrationWarning
                    onClick={() => setActiveTab('STOCK')}
                    style={{
                        padding: '10px 24px', borderRadius: 10, fontSize: '0.9rem', fontWeight: activeTab === 'STOCK' ? 700 : 500,
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                        background: activeTab === 'STOCK' ? '#DC2626' : 'transparent',
                        color: activeTab === 'STOCK' ? '#fff' : '#6B7280',
                        boxShadow: activeTab === 'STOCK' ? '0 4px 12px rgba(220,38,38,0.2)' : 'none'
                    }}
                >
                    🥩 หมวดหมู่วัตถุดิบ/บรรจุภัณฑ์ ({stockCats.length})
                </button>
            </div>

            {/* Content List */}
            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>กำลังโหลด...</div>
            ) : displayCats.length === 0 ? (
                <div style={{ padding: '4rem 2rem', textAlign: 'center', background: '#fff', borderRadius: 16, border: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>📂</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1A1D26' }}>ยังไม่มีหมวดหมู่</div>
                    <div style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: 4 }}>คลิกที่ปุ่มสร้างหมวดหมู่เพื่อเพิ่มรายการใหม่</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {displayCats.map(cat => (
                        <div key={cat.id} style={{
                            background: '#fff', border: '1px solid var(--border)', borderRadius: 16,
                            padding: '1rem', display: 'flex', alignItems: 'center', gap: 12,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'all 0.2s'
                        }}>
                            <div style={{
                                width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                                background: `${cat.color || '#6B7280'}15`,
                                color: cat.color || '#6B7280',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.6rem'
                            }}>
                                {cat.icon || '🏷️'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: '#1A1D26', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: 4, display: 'flex', gap: 6 }}>
                                    <span>สินค้ารวม: {cat._count.products}</span>
                                    {cat.code.startsWith('CUSTOM_') ? <span style={{ color: '#059669' }}>สร้างเอง</span> : <span style={{ color: '#3B82F6' }}>ระบบพื้นฐาน</span>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <button onClick={() => openEdit(cat)} style={{
                                    background: '#F3F4F6', border: 'none', color: '#4B5563', borderRadius: 8,
                                    padding: '6px', cursor: 'pointer', transition: 'all 0.15s'
                                }} title="แก้ไข">✏️</button>
                                <button onClick={() => openMoveProducts(cat)} disabled={cat._count.products === 0} style={{
                                    background: '#EFF6FF', border: 'none', color: '#3B82F6', borderRadius: 8,
                                    padding: '6px', cursor: cat._count.products === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                                    opacity: cat._count.products === 0 ? 0.4 : 1
                                }} title="ย้ายสินค้า">📦</button>
                                <button onClick={() => handleDelete(cat)} disabled={cat._count.products > 0} style={{
                                    background: '#FEF2F2', border: 'none', color: '#DC2626', borderRadius: 8,
                                    padding: '6px', cursor: cat._count.products > 0 ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                                    opacity: cat._count.products > 0 ? 0.4 : 1
                                }} title="ลบ">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: 20, padding: '1.5rem', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>{editMode ? '✏️ แก้ไขหมวดหมู่' : '➕ สร้างหมวดหมู่ใหม่'}</h2>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label className="label">ชื่อหมวดหมู่</label>
                                <input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" placeholder="เช่น เครื่องดื่ม, เนื้อหมู" />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="label">ประเภท</label>
                                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input" disabled={editMode} style={{ background: editMode ? '#F3F4F6' : '#fff' }}>
                                        <option value="MENU">🍽️ หมวดหมู่เมนูหน้าร้าน</option>
                                        <option value="STOCK">🥩 หมวดหมู่วัตถุดิบ/สต็อก</option>
                                    </select>
                                    {editMode && <p style={{ fontSize: '0.65rem', color: '#9CA3AF', marginTop: 4 }}>ประเภทหมวดหมู่ถูกกำหนดแล้ว ไม่สามารถเปลี่ยนได้</p>}
                                </div>
                                <div>
                                    <label className="label">สีประจำหมวด</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                                        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {PRESET_COLORS.slice(0, 10).map(c => (
                                                <div key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '2px solid #1A1D26' : '2px solid transparent' }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="label">ไอคอน</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ fontSize: '2rem', width: 64, height: 64, borderRadius: 14, background: `${form.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{form.icon}</div>
                                    <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}>
                                        {PRESET_ICONS.map(ic => (
                                            <div key={ic} onClick={() => setForm({ ...form, icon: ic })} style={{ fontSize: '1.4rem', padding: '4px', cursor: 'pointer', borderRadius: 8, background: form.icon === ic ? '#F3F4F6' : 'transparent', border: form.icon === ic ? '1px solid var(--border)' : '1px solid transparent' }}>{ic}</div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1, minHeight: 44 }}>ยกเลิก</button>
                                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, minHeight: 44 }}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Move Products Modal */}
            {showMoveModal && movingCategory && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: 540, borderRadius: 20, padding: '1.5rem', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>📦 ย้ายสินค้าจากหมวด "{movingCategory.name}"</h2>
                        <p style={{ fontSize: '0.9rem', color: '#6B7280', marginBottom: '1.25rem' }}>เลือกสินค้าที่ต้องการย้ายไปหมวดหมู่ใหม่</p>

                        {loadingProducts ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#6B7280' }}>กำลังโหลดสินค้า...</div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: 8, flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, background: '#F3F4F6', padding: '10px 12px', borderRadius: 8 }}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedProductIds.length === movingProducts.length && movingProducts.length > 0} 
                                            onChange={toggleSelectAll} 
                                            style={{ width: 16, height: 16 }}
                                        />
                                        เลือกทั้งหมด ({selectedProductIds.length}/{movingProducts.length})
                                    </label>
                                    {mismatchCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={selectMismatch}
                                            style={{
                                                background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#DC2626',
                                                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                                                fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit',
                                                display: 'flex', alignItems: 'center', gap: 6
                                            }}
                                            title="เลือกสินค้าที่ประเภทไม่ตรงกับหมวดหมู่นี้"
                                        >
                                            ⚠️ เลือกผิดประเภทอัตโนมัติ ({mismatchCount})
                                        </button>
                                    )}
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {movingProducts.map(p => {
                                        const catIsStock = isStock(movingCategory.code)
                                        const mismatch = isMismatch(catIsStock, p.productType)
                                        const typeInfo = TYPE_LABEL[p.productType] || { label: p.productType, bg: '#F3F4F6', color: '#374151' }
                                        const isSelected = selectedProductIds.includes(p.id)
                                        return (
                                        <label key={p.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                                            background: mismatch ? '#FFF1F2' : isSelected ? '#F0FDF4' : '#fff',
                                            borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s',
                                            border: '1.5px solid',
                                            borderColor: mismatch ? '#FECDD3' : isSelected ? '#BBF7D0' : 'transparent'
                                        }}>
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected} 
                                                onChange={() => toggleProductSelection(p.id)} 
                                                style={{ width: 16, height: 16, flexShrink: 0 }}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: isSelected ? 600 : 500 }}>{p.name}{p.nameTh ? ` (${p.nameTh})` : ''}</span>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: typeInfo.bg, color: typeInfo.color, whiteSpace: 'nowrap' }}>
                                                        {typeInfo.label}
                                                    </span>
                                                    {mismatch && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#DC2626' }}>⚠️ ผิดประเภท</span>}
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>SKU: {p.sku} | หน่วย: {p.unit}</span>
                                            </div>
                                        </label>
                                        )
                                    })}
                                    {movingProducts.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>ไม่พบสินค้าในหมวดหมู่นี้</div>}
                                </div>

                                <form onSubmit={handleMoveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem' }}>
                                    <div>
                                        <label className="label">หมวดหมู่ปลายทาง</label>
                                        <select required value={targetCategoryId} onChange={e => setTargetCategoryId(e.target.value)} className="input">
                                            <option value="">-- เลือกหมวดหมู่ที่ต้องการย้ายไป --</option>
                                            <optgroup label="🍽️ หมวดหมู่เมนูหน้าร้าน">
                                                {menuCats.filter(c => c.id !== movingCategory.id).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                            </optgroup>
                                            <optgroup label="🥩 หมวดหมู่วัตถุดิบ/สต็อก">
                                                {stockCats.filter(c => c.id !== movingCategory.id).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <button type="button" onClick={() => setShowMoveModal(false)} className="btn-secondary" style={{ flex: 1, minHeight: 44 }}>ยกเลิก</button>
                                        <button type="submit" disabled={moving || selectedProductIds.length === 0 || !targetCategoryId} className="btn-primary" style={{ flex: 1, minHeight: 44 }}>
                                            {moving ? 'กำลังย้าย...' : `ย้าย ${selectedProductIds.length} รายการ`}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
} 
