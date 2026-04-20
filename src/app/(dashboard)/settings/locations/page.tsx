'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRoleGuard } from '@/hooks/useRoleGuard'

type LocType = 'MAIN_WAREHOUSE' | 'FRESH_STORAGE' | 'DRINK_WAREHOUSE' | 'DISPLAY_FREEZER' | 'KITCHEN_STOCK' | 'BAR_STOCK'

interface Location {
    id: string
    code: string
    name: string
    nameLao: string | null
    type: LocType
    sortOrder: number
    isActive: boolean
    _count?: { inventory: number }
}

const TYPE_LABEL: Record<LocType, { label: string; color: string; icon: string }> = {
    MAIN_WAREHOUSE:  { label: 'คลังหลัก',        color: '#3B82F6', icon: '🏭' },
    FRESH_STORAGE:   { label: 'คลังของสด',        color: '#10B981', icon: '🌿' },
    DRINK_WAREHOUSE: { label: 'คลังเครื่องดื่ม',  color: '#F59E0B', icon: '🍺' },
    DISPLAY_FREEZER: { label: 'ตู้แช่',            color: '#06B6D4', icon: '❄️' },
    KITCHEN_STOCK:   { label: 'ครัว',              color: '#EF4444', icon: '🍳' },
    BAR_STOCK:       { label: 'บาร์',              color: '#8B5CF6', icon: '🍸' },
}

const TEMPLATES = [
    {
        id: 'small',
        icon: '🏪',
        name: 'ร้านเล็ก / ทั่วไป',
        desc: 'คลังหลักเดียว',
        locs: ['WH_MAIN'],
        bg: '#EFF6FF',
        border: '#BFDBFE',
        color: '#1D4ED8',
    },
    {
        id: 'restaurant',
        icon: '🍽️',
        name: 'ร้านอาหาร',
        desc: 'คลังใหญ่ + ของสด + ครัว',
        locs: ['WH_MAIN', 'WH_FRESH', 'KIT_STOCK'],
        bg: '#F0FDF4',
        border: '#BBF7D0',
        color: '#166534',
    },
    {
        id: 'restaurant_bar',
        icon: '🍺',
        name: 'ร้านอาหาร + บาร์',
        desc: 'คลังใหญ่ + ของสด + ครัว + บาร์ + ตู้แช่',
        locs: ['WH_MAIN', 'WH_FRESH', 'KIT_STOCK', 'BAR_STOCK', 'FR_FREEZER'],
        bg: '#FFFBEB',
        border: '#FDE68A',
        color: '#92400E',
    },
    {
        id: 'full',
        icon: '🏭',
        name: 'เต็มรูปแบบ',
        desc: 'ทั้ง 7 คลัง (ขนาดใหญ่)',
        locs: ['WH_MAIN', 'WH_FRESH', 'WH_DRINKbar1', 'WH_DRINKbar2', 'FR_FREEZER', 'KIT_STOCK', 'BAR_STOCK'],
        bg: '#F5F3FF',
        border: '#DDD6FE',
        color: '#5B21B6',
    },
]

const LOC_TYPES: LocType[] = ['MAIN_WAREHOUSE', 'FRESH_STORAGE', 'DRINK_WAREHOUSE', 'DISPLAY_FREEZER', 'KITCHEN_STOCK', 'BAR_STOCK']

export default function LocationsPage() {
    useRoleGuard(['owner', 'manager'])

    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [seeding, setSeeding] = useState<string | null>(null)
    const [seedMsg, setSeedMsg] = useState('')

    // Add modal
    const [showAdd, setShowAdd] = useState(false)
    const [addName, setAddName] = useState('')
    const [addCode, setAddCode] = useState('')
    const [addType, setAddType] = useState<LocType>('MAIN_WAREHOUSE')
    const [addLoading, setAddLoading] = useState(false)

    // Edit modal
    const [editLoc, setEditLoc] = useState<Location | null>(null)
    const [editName, setEditName] = useState('')
    const [editType, setEditType] = useState<LocType>('MAIN_WAREHOUSE')
    const [editLoading, setEditLoading] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/locations')
            const json = await res.json()
            if (json.success) setLocations(json.data ?? [])
        } finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    async function handleSeed(templateId: string) {
        setSeeding(templateId)
        setSeedMsg('')
        try {
            const res = await fetch(`/api/locations/seed?template=${templateId}`, { method: 'POST' })
            const json = await res.json()
            if (json.success) {
                setSeedMsg(json.data.message)
                await load()
            } else {
                setSeedMsg('❌ ' + (json.error || 'เกิดข้อผิดพลาด'))
            }
        } catch { setSeedMsg('❌ ไม่สามารถเชื่อมต่อได้') }
        finally { setSeeding(null) }
    }

    async function handleAdd() {
        if (!addName.trim() || !addCode.trim()) return
        setAddLoading(true)
        try {
            const res = await fetch('/api/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: addName.trim(), code: addCode.trim().toUpperCase(), type: addType }),
            })
            const json = await res.json()
            if (json.success) {
                setShowAdd(false); setAddName(''); setAddCode('')
                await load()
            } else {
                alert(json.error || 'เกิดข้อผิดพลาด')
            }
        } finally { setAddLoading(false) }
    }

    async function handleEdit() {
        if (!editLoc || !editName.trim()) return
        setEditLoading(true)
        try {
            const res = await fetch(`/api/locations/${editLoc.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim(), type: editType }),
            })
            const json = await res.json()
            if (json.success) { setEditLoc(null); await load() }
            else alert(json.error || 'เกิดข้อผิดพลาด')
        } finally { setEditLoading(false) }
    }

    async function handleDeactivate(loc: Location) {
        if (!confirm(`🗑️ ลบคลัง "${loc.name}" (${loc.code}) ถาวร?\n\n⚠️ จะลบ inventory, stock movement ที่เกี่ยวข้องทั้งหมด\nดำเนินการต่อ?`)) return
        const res = await fetch(`/api/locations/${loc.id}`, { method: 'DELETE' })
        const json = await res.json()
        if (json.success) {
            const c = json.data?.cleaned || {}
            alert(`✅ ลบคลัง "${loc.name}" แล้ว\n\nล้าง:\n• Inventory: ${c.inventory || 0} รายการ\n• Stock Movements: ${(c.stockMovementsFrom || 0) + (c.stockMovementsTo || 0)} รายการ\n• BOM อัปเดต: ${c.bomUpdated || 0} รายการ`)
            await load()
        } else alert(json.error || 'เกิดข้อผิดพลาด')
    }

    const active = locations.filter(l => l.isActive)

    return (
        <div className="page-container" style={{ maxWidth: 960 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 className="page-title">🏭 จัดการคลังสินค้า</h1>
                    <p className="page-subtitle">กำหนด location คลังสำหรับ Quick Receive, Transfer และ Inventory</p>
                </div>
                <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
                    + เพิ่มคลังใหม่
                </button>
            </div>

            {/* Quick Setup Templates */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                    ⚡ Quick Setup — สร้างคลังจาก Template
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {TEMPLATES.map(t => (
                        <div key={t.id} style={{ background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 14, padding: '1rem 1.1rem', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                        >
                            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{t.icon}</div>
                            <div style={{ fontWeight: 700, color: t.color, fontSize: '0.88rem', marginBottom: 4 }}>{t.name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#6B7280', marginBottom: 10, lineHeight: 1.5 }}>{t.desc}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                                {t.locs.map(l => (
                                    <span key={l} style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 4, padding: '2px 6px', fontSize: '0.64rem', fontFamily: 'monospace', color: '#374151' }}>{l}</span>
                                ))}
                            </div>
                            <button
                                onClick={() => handleSeed(t.id)}
                                disabled={seeding === t.id}
                                style={{ width: '100%', padding: '7px', borderRadius: 9, border: 'none', background: t.color, color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: seeding ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: seeding === t.id ? 0.7 : 1 }}
                            >
                                {seeding === t.id ? '⏳ กำลังสร้าง…' : '🚀 ใช้ Template นี้'}
                            </button>
                        </div>
                    ))}
                </div>
                {seedMsg && (
                    <div style={{ marginTop: 10, padding: '10px 16px', background: seedMsg.startsWith('❌') ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${seedMsg.startsWith('❌') ? '#FECACA' : '#BBF7D0'}`, borderRadius: 10, fontSize: '0.85rem', color: seedMsg.startsWith('❌') ? '#DC2626' : '#166534', fontWeight: 600 }}>
                        {seedMsg}
                    </div>
                )}
            </div>

            {/* Current Locations */}
            <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                    📦 คลังที่มีอยู่ ({active.length} แห่ง)
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>กำลังโหลด...</div>
                ) : active.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: 16, border: '1.5px dashed #E5E7EB' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏭</div>
                        <div style={{ fontWeight: 700, color: '#1A1D26', marginBottom: 4 }}>ยังไม่มีคลังสินค้า</div>
                        <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>เลือก Template ด้านบน หรือเพิ่มคลังด้วยตัวเอง</div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                        {active.map(loc => {
                            const cfg = TYPE_LABEL[loc.type] || { label: loc.type, color: '#6B7280', icon: '📦' }
                            return (
                                <div key={loc.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{cfg.icon}</div>
                                            <div style={{ fontWeight: 700, color: '#1A1D26', fontSize: '0.95rem' }}>{loc.name}</div>
                                            <code style={{ fontSize: '0.7rem', color: '#9CA3AF', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{loc.code}</code>
                                        </div>
                                        <span style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}40`, borderRadius: 8, padding: '3px 8px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {cfg.label}
                                        </span>
                                    </div>

                                    {loc._count?.inventory !== undefined && (
                                        <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                                            📊 {loc._count.inventory} รายการในสต็อค
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                                        <button
                                            onClick={() => { setEditLoc(loc); setEditName(loc.name); setEditType(loc.type) }}
                                            style={{ flex: 1, padding: '7px', borderRadius: 9, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
                                        >
                                            ✏️ แก้ไข
                                        </button>
                                        <button
                                            onClick={() => handleDeactivate(loc)}
                                            style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
                                        >
                                            🚫
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAdd && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 440 }}>
                        <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A1D26', marginBottom: '1.5rem' }}>+ เพิ่มคลังใหม่</h2>

                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: 6, color: '#374151' }}>ชื่อคลัง *</label>
                            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="เช่น คลังของสด, บาร์ 2"
                                style={{ width: '100%', padding: '0.75rem 1rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.95rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: 6, color: '#374151' }}>รหัสคลัง (CODE) * <span style={{ fontWeight: 400, color: '#9CA3AF' }}>ตัวพิมพ์ใหญ่ ไม่มีช่องว่าง</span></label>
                            <input value={addCode} onChange={e => setAddCode(e.target.value.toUpperCase().replace(/\s/g, '_'))} placeholder="เช่น WH_EXTRA, BAR_2"
                                style={{ width: '100%', padding: '0.75rem 1rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.95rem', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: 6, color: '#374151' }}>ประเภทคลัง</label>
                            <select value={addType} onChange={e => setAddType(e.target.value as LocType)}
                                style={{ width: '100%', padding: '0.75rem 1rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.9rem', fontFamily: 'inherit', background: '#fff' }}>
                                {LOC_TYPES.map(t => (
                                    <option key={t} value={t}>{TYPE_LABEL[t].icon} {TYPE_LABEL[t].label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => { setShowAdd(false); setAddName(''); setAddCode('') }}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: 12, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                ยกเลิก
                            </button>
                            <button onClick={handleAdd} disabled={addLoading || !addName.trim() || !addCode.trim()}
                                style={{ flex: 2, padding: '0.75rem', borderRadius: 12, border: 'none', background: (!addName.trim() || !addCode.trim()) ? '#E5E7EB' : '#1A1D26', color: (!addName.trim() || !addCode.trim()) ? '#9CA3AF' : '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {addLoading ? '⏳ กำลังบันทึก…' : '✅ เพิ่มคลัง'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editLoc && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 440 }}>
                        <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A1D26', marginBottom: '1.5rem' }}>✏️ แก้ไขคลัง — <code style={{ fontSize: '0.85rem', color: '#6B7280' }}>{editLoc.code}</code></h2>

                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: 6, color: '#374151' }}>ชื่อคลัง *</label>
                            <input value={editName} onChange={e => setEditName(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem 1rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.95rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: 6, color: '#374151' }}>ประเภทคลัง</label>
                            <select value={editType} onChange={e => setEditType(e.target.value as LocType)}
                                style={{ width: '100%', padding: '0.75rem 1rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.9rem', fontFamily: 'inherit', background: '#fff' }}>
                                {LOC_TYPES.map(t => (
                                    <option key={t} value={t}>{TYPE_LABEL[t].icon} {TYPE_LABEL[t].label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setEditLoc(null)}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: 12, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                ยกเลิก
                            </button>
                            <button onClick={handleEdit} disabled={editLoading || !editName.trim()}
                                style={{ flex: 2, padding: '0.75rem', borderRadius: 12, border: 'none', background: '#1A1D26', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {editLoading ? '⏳ กำลังบันทึก…' : '💾 บันทึก'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
