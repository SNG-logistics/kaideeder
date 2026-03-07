'use client'
import { useState, useEffect, useCallback } from 'react'

type DiningTable = {
    id: string
    number: number
    name: string
    zone: string
    seats: number
    isActive: boolean
    orders: { id: string }[]
}

type PanelState = 'list' | 'add-zone' | 'add-table' | 'edit-table' | 'manage-zones'

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.875rem',
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
    padding: '0.55rem 1.25rem', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
}
const btnDanger: React.CSSProperties = {
    padding: '0.4rem 0.75rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
    background: 'rgba(239,68,68,0.08)', color: '#ef4444',
    fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
    padding: '0.55rem 1rem', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
}

export default function TableManagerPanel({ onClose }: { onClose: () => void }) {
    const [tables, setTables] = useState<DiningTable[]>([])
    const [zones, setZones] = useState<string[]>([])
    const [activeZone, setActiveZone] = useState<string>('ALL')
    const [panel, setPanel] = useState<PanelState>('list')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [deletingZone, setDeletingZone] = useState<string | null>(null)
    const [renamingZone, setRenamingZone] = useState<string | null>(null)  // zone currently being renamed
    const [renameValue, setRenameValue] = useState('')

    // Add Zone form
    const [newZoneName, setNewZoneName] = useState('')

    // Add/Edit Table form
    const [editingTable, setEditingTable] = useState<DiningTable | null>(null)
    const [form, setForm] = useState({ name: '', zone: '', seats: 4 })

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/settings/tables')
        const d = await res.json()
        if (d.success) {
            setTables(d.data.tables)
            setZones(d.data.zones)
            if (d.data.zones.length > 0 && activeZone === 'ALL' && d.data.zones.length === 1) {
                setActiveZone(d.data.zones[0])
            }
        }
        setLoading(false)
    }, [activeZone])

    useEffect(() => { load() }, [])

    const flash = (ok: boolean, text: string) => {
        setMsg({ ok, text })
        setTimeout(() => setMsg(null), 3500)
    }

    // --- Add Zone ---
    async function handleAddZone(e: React.FormEvent) {
        e.preventDefault()
        if (!newZoneName.trim()) return
        setSaving(true)
        // Create a placeholder table in this zone so the zone appears
        const res = await fetch('/api/settings/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `${newZoneName} 1`, zone: newZoneName.trim(), seats: 4 }),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            flash(true, `✅ สร้างโซน "${newZoneName}" พร้อมโต๊ะแรกแล้ว`)
            setNewZoneName('')
            setActiveZone(newZoneName.trim())
            setPanel('list')
            load()
        } else {
            flash(false, d.error || 'เกิดข้อผิดพลาด')
        }
    }

    // --- Add Table ---
    async function handleAddTable(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const res = await fetch('/api/settings/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: form.name, zone: form.zone || activeZone, seats: Number(form.seats) }),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            flash(true, `✅ เพิ่มโต๊ะ "${form.name}" แล้ว`)
            setForm({ name: '', zone: activeZone !== 'ALL' ? activeZone : '', seats: 4 })
            setPanel('list')
            load()
        } else {
            flash(false, d.error || 'เกิดข้อผิดพลาด')
        }
    }

    // --- Edit Table ---
    function startEdit(t: DiningTable) {
        setEditingTable(t)
        setForm({ name: t.name, zone: t.zone, seats: t.seats })
        setPanel('edit-table')
    }

    async function handleEditTable(e: React.FormEvent) {
        e.preventDefault()
        if (!editingTable) return
        setSaving(true)
        const res = await fetch('/api/settings/tables', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingTable.id, name: form.name, zone: form.zone, seats: Number(form.seats) }),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            flash(true, `✅ แก้ไขโต๊ะสำเร็จ`)
            setPanel('list')
            setEditingTable(null)
            load()
        } else {
            flash(false, d.error || 'เกิดข้อผิดพลาด')
        }
    }

    // --- Zone: rename ---
    async function handleRenameZone(oldName: string) {
        if (!renameValue.trim() || renameValue.trim() === oldName) {
            setRenamingZone(null); return
        }
        const res = await fetch(`/api/settings/tables/zones/${encodeURIComponent(oldName)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName: renameValue.trim() }),
        })
        const d = await res.json()
        if (d.success) {
            flash(true, `✅ เปลี่ยนชื่อโซน “${oldName}” → “${renameValue.trim()}”`)
            setRenamingZone(null)
            if (activeZone === oldName) setActiveZone(renameValue.trim())
            load()
        } else {
            flash(false, d.error || 'ไม่สามารถเปลี่ยนชื่อได้')
        }
    }

    // --- Zone: delete ---
    async function handleDeleteZone(zoneName: string, tableCount: number) {
        if (!confirm(`ลบโซน "${zoneName}" (${tableCount} โต๊ะ) ทั้งหมด?\nโต๊ะทุกโต๊ะในโซนนี้จะถูกซ่อนออกจาก POS`)) return
        setDeletingZone(zoneName)
        const res = await fetch(`/api/settings/tables/zones/${encodeURIComponent(zoneName)}`, {
            method: 'DELETE',
        })
        const d = await res.json()
        setDeletingZone(null)
        if (d.success) {
            flash(true, `🗑️ ลบโซน “${zoneName}” แล้ว`)
            if (activeZone === zoneName) setActiveZone('ALL')
            load()
        } else {
            flash(false, d.error || 'ไม่สามารถลบได้')
        }
    }

    // --- Delete Table ---
    async function handleDelete(id: string) {
        if (!confirm('ยืนยันการลบโต๊ะนี้?')) return
        setDeleting(id)
        const res = await fetch(`/api/settings/tables/${id}`, { method: 'DELETE' })
        const d = await res.json()
        setDeleting(null)
        if (d.success) {
            flash(true, '🗑️ ลบโต๊ะแล้ว')
            load()
        } else {
            flash(false, d.error || 'ไม่สามารถลบได้')
        }
    }

    const displayTables = activeZone === 'ALL'
        ? tables.filter(t => t.isActive)
        : tables.filter(t => t.zone === activeZone && t.isActive)

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 800,
            display: 'flex', alignItems: 'stretch',
        }}>
            {/* Backdrop */}
            <div
                style={{ flex: 1, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                onClick={onClose}
            />

            {/* Panel */}
            <div style={{
                width: '100%', maxWidth: 480,
                height: '100vh',            /* ← fixed height */
                display: 'flex', flexDirection: 'column',
                background: 'linear-gradient(180deg,#0f1221 0%,#0d1117 100%)',
                borderLeft: '1px solid rgba(99,102,241,0.3)',
                boxShadow: '-24px 0 64px rgba(0,0,0,0.6)',
                overflowY: 'hidden',        /* ← no outer scroll; inner sections scroll */
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.06))',
                    flexShrink: 0,
                }}>
                    <div>
                        <h2 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.15rem', margin: 0 }}>
                            🪑 จัดการโต๊ะและโซน
                        </h2>
                        <p style={{ color: '#475569', fontSize: '0.78rem', margin: '4px 0 0' }}>
                            {tables.filter(t => t.isActive).length} โต๊ะ · {zones.length} โซน
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        color: '#94a3b8', borderRadius: 8, width: 36, height: 36,
                        cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✕</button>
                </div>

                {/* Toast */}
                {msg && (
                    <div style={{
                        margin: '0.75rem 1.25rem', padding: '0.65rem 1rem', borderRadius: 10, fontSize: '0.82rem',
                        background: msg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        color: msg.ok ? '#10b981' : '#ef4444',
                    }}>{msg.text}</div>
                )}

                {/* ===== MAIN LIST VIEW ===== */}
                {panel === 'list' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* Action buttons */}
                        <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button onClick={() => { setNewZoneName(''); setPanel('add-zone') }} style={btnSecondary}>
                                ➕ เพิ่มโซน
                            </button>
                            <button
                                onClick={() => setPanel('manage-zones')}
                                style={{ ...btnSecondary, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' }}
                            >
                                ⚙️ จัดการโซน
                            </button>
                            <button
                                onClick={() => {
                                    setForm({ name: '', zone: activeZone !== 'ALL' ? activeZone : (zones[0] || ''), seats: 4 })
                                    setPanel('add-table')
                                }}
                                style={btnPrimary}
                                disabled={zones.length === 0}
                            >
                                🪑 เพิ่มโต๊ะ
                            </button>
                        </div>

                        {/* Zone tabs — horizontal scroll */}
                        <div style={{
                            display: 'flex', overflowX: 'auto',
                            scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent',
                            padding: '0 1.25rem 10px', gap: 6, flexShrink: 0,
                        }}>
                            {['ALL', ...zones].map(z => (
                                <button key={z} onClick={() => setActiveZone(z)} style={{
                                    padding: '0.4rem 0.875rem', borderRadius: 999, border: '1px solid',
                                    whiteSpace: 'nowrap', fontSize: '0.8rem', cursor: 'pointer',
                                    fontWeight: activeZone === z ? 700 : 400,
                                    background: activeZone === z ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                                    color: activeZone === z ? '#818cf8' : '#64748b',
                                    borderColor: activeZone === z ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)',
                                }}>
                                    {z === 'ALL' ? '📋 ทั้งหมด' : `📍 ${z}`}
                                    <span style={{ marginLeft: 5, fontSize: '0.72rem', opacity: 0.7 }}>
                                        ({z === 'ALL' ? tables.filter(t => t.isActive).length : tables.filter(t => t.zone === z && t.isActive).length})
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Table list */}
                        <div style={{ flex: 1, padding: '0.5rem 1.25rem 1.5rem', overflowY: 'auto' }}>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>⏳ Loading...</div>
                            ) : displayTables.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#334155' }}>
                                    <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🪑</div>
                                    <p style={{ color: '#475569' }}>ยังไม่มีโต๊ะในโซนนี้</p>
                                    <button onClick={() => {
                                        setForm({ name: '', zone: activeZone !== 'ALL' ? activeZone : '', seats: 4 })
                                        setPanel('add-table')
                                    }} style={{ ...btnPrimary, marginTop: 12 }}>➕ เพิ่มโต๊ะ</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {displayTables.map(t => (
                                        <div key={t.id} style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 12, padding: '0.875rem 1rem',
                                            display: 'flex', alignItems: 'center', gap: 12,
                                        }}>
                                            <div style={{
                                                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                                background: t.orders.length > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 18,
                                            }}>
                                                {t.orders.length > 0 ? '🔴' : '🟢'}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {t.name}
                                                </p>
                                                <p style={{ color: '#475569', fontSize: '0.73rem', margin: '2px 0 0' }}>
                                                    📍 {t.zone} · {t.seats} ที่นั่ง
                                                    {t.orders.length > 0 && <span style={{ color: '#ef4444', marginLeft: 6 }}>· มีออเดอร์</span>}
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                <button onClick={() => startEdit(t)} style={{
                                                    padding: '0.4rem 0.75rem', borderRadius: 8,
                                                    border: '1px solid rgba(99,102,241,0.3)',
                                                    background: 'rgba(99,102,241,0.08)', color: '#818cf8',
                                                    fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                                                }}>✏️</button>
                                                <button
                                                    onClick={() => handleDelete(t.id)}
                                                    disabled={deleting === t.id || t.orders.length > 0}
                                                    title={t.orders.length > 0 ? 'มีออเดอร์ที่เปิดอยู่' : ''}
                                                    style={{ ...btnDanger, opacity: t.orders.length > 0 ? 0.4 : 1, cursor: t.orders.length > 0 ? 'not-allowed' : 'pointer' }}
                                                >
                                                    {deleting === t.id ? '⏳' : '🗑️'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ===== MANAGE ZONES ===== */}
                {panel === 'manage-zones' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                        <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <button type="button" onClick={() => setPanel('list')} style={{ ...btnSecondary, padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>← กลับ</button>
                            <h3 style={{ color: '#f1f5f9', fontWeight: 700, margin: 0, fontSize: '1rem' }}>⚙️ จัดการโซน</h3>
                        </div>
                        <div style={{ padding: '0 1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {zones.length === 0 ? (
                                <p style={{ color: '#475569', textAlign: 'center', padding: '2rem' }}>ยังไม่มีโซน</p>
                            ) : zones.map(z => {
                                const tableCount = tables.filter(t => t.zone === z && t.isActive).length
                                const isRenaming = renamingZone === z
                                return (
                                    <div key={z} style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 12, padding: '0.875rem 1rem',
                                        display: 'flex', alignItems: 'center', gap: 10,
                                    }}>
                                        <div style={{ fontSize: 20, flexShrink: 0 }}>📍</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            {isRenaming ? (
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <input
                                                        autoFocus
                                                        style={{ ...inputStyle, flex: 1, padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
                                                        value={renameValue}
                                                        onChange={e => setRenameValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleRenameZone(z)
                                                            if (e.key === 'Escape') setRenamingZone(null)
                                                        }}
                                                    />
                                                    <button onClick={() => handleRenameZone(z)} style={{ ...btnPrimary, padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>✓</button>
                                                    <button onClick={() => setRenamingZone(null)} style={{ ...btnSecondary, padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}>✕</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>{z}</p>
                                                    <p style={{ color: '#475569', fontSize: '0.73rem', margin: '2px 0 0' }}>{tableCount} โต๊ะ</p>
                                                </>
                                            )}
                                        </div>
                                        {!isRenaming && (
                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                <button
                                                    onClick={() => { setRenamingZone(z); setRenameValue(z) }}
                                                    style={{
                                                        padding: '0.4rem 0.75rem', borderRadius: 8,
                                                        border: '1px solid rgba(99,102,241,0.3)',
                                                        background: 'rgba(99,102,241,0.08)', color: '#818cf8',
                                                        fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                                                    }}
                                                >✏️</button>
                                                <button
                                                    onClick={() => handleDeleteZone(z, tableCount)}
                                                    disabled={deletingZone === z}
                                                    style={{ ...btnDanger, opacity: 1 }}
                                                    title={tableCount > 0 ? `ลบ ${tableCount} โต๊ะในโซนนี้` : 'ลบโซน'}
                                                >
                                                    {deletingZone === z ? '⏳' : '🗑️'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ===== ADD ZONE FORM =====  */}
                {panel === 'add-zone' && (
                    <form onSubmit={handleAddZone} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <button type="button" onClick={() => setPanel('list')} style={{ ...btnSecondary, padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>← กลับ</button>
                            <h3 style={{ color: '#f1f5f9', fontWeight: 700, margin: 0, fontSize: '1rem' }}>➕ เพิ่มโซนใหม่</h3>
                        </div>
                        <div>
                            <label style={{ display: 'block', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>ชื่อโซน *</label>
                            <input
                                style={inputStyle}
                                placeholder="เช่น ในร้าน, ระเบียง, VIP"
                                value={newZoneName}
                                onChange={e => setNewZoneName(e.target.value)}
                                required autoFocus
                            />
                            <p style={{ color: '#475569', fontSize: '0.73rem', marginTop: 6 }}>
                                ระบบจะสร้างโต๊ะแรกในโซนให้อัตโนมัติ 1 โต๊ะ
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" onClick={() => setPanel('list')} style={btnSecondary}>ยกเลิก</button>
                            <button type="submit" disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
                                {saving ? '⏳ กำลังสร้าง...' : '✅ สร้างโซน'}
                            </button>
                        </div>
                    </form>
                )}

                {/* ===== ADD / EDIT TABLE FORM ===== */}
                {(panel === 'add-table' || panel === 'edit-table') && (
                    <form
                        onSubmit={panel === 'add-table' ? handleAddTable : handleEditTable}
                        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <button type="button" onClick={() => setPanel('list')} style={{ ...btnSecondary, padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>← กลับ</button>
                            <h3 style={{ color: '#f1f5f9', fontWeight: 700, margin: 0, fontSize: '1rem' }}>
                                {panel === 'add-table' ? '🪑 เพิ่มโต๊ะใหม่' : `✏️ แก้ไข: ${editingTable?.name}`}
                            </h3>
                        </div>

                        {[
                            { key: 'name', label: 'ชื่อโต๊ะ *', placeholder: 'เช่น โต๊ะ 1, VIP 1', type: 'text' },
                        ].map(f => (
                            <div key={f.key}>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>{f.label}</label>
                                <input
                                    style={inputStyle}
                                    type={f.type}
                                    placeholder={f.placeholder}
                                    value={(form as any)[f.key]}
                                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    required
                                    autoFocus={f.key === 'name'}
                                />
                            </div>
                        ))}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>โซน *</label>
                                <select
                                    style={{ ...inputStyle, appearance: 'none' }}
                                    value={form.zone}
                                    onChange={e => setForm(prev => ({ ...prev, zone: e.target.value }))}
                                    required
                                >
                                    <option value="">-- เลือกโซน --</option>
                                    {zones.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>จำนวนที่นั่ง</label>
                                <input
                                    style={inputStyle}
                                    type="number"
                                    min={1} max={50}
                                    value={form.seats}
                                    onChange={e => setForm(prev => ({ ...prev, seats: Number(e.target.value) }))}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" onClick={() => setPanel('list')} style={btnSecondary}>ยกเลิก</button>
                            <button type="submit" disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
                                {saving ? '⏳ กำลังบันทึก...' : panel === 'add-table' ? '✅ เพิ่มโต๊ะ' : '✅ บันทึก'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
