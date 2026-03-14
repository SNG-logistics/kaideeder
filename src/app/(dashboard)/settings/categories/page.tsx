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

function isStock(code: string) {
    if (code.startsWith('CUSTOM_RAW_')) return true
    if (code.startsWith('CUSTOM_MENU_')) return false
    return RAW_CODES.includes(code)
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
        </div>
    )
} 
