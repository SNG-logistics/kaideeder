'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type StockCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ADJUSTED' | 'CANCELLED'

interface StockCount {
    id: string
    name: string
    status: StockCountStatus
    createdAt: string
    startedAt?: string
    completedAt?: string
    approvedAt?: string
    note?: string
    location?: { code: string; name: string }
    _count: { items: number }
    pendingCount: number
}

interface Location { id: string; code: string; name: string }

const STATUS_CONFIG: Record<StockCountStatus, { label: string; color: string; bg: string }> = {
    DRAFT:       { label: 'เตรียม', color: '#6B7280', bg: '#F3F4F6' },
    IN_PROGRESS: { label: 'กำลังนับ', color: '#D97706', bg: '#FFFBEB' },
    COMPLETED:   { label: 'รออนุมัติ', color: '#2563EB', bg: '#EFF6FF' },
    ADJUSTED:    { label: 'ปรับแล้ว', color: '#059669', bg: '#ECFDF5' },
    CANCELLED:   { label: 'ยกเลิก', color: '#9CA3AF', bg: '#F9FAFB' },
}

export default function StockCountListPage() {
    const [counts, setCounts] = useState<StockCount[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [name, setName] = useState('')
    const [locationId, setLocationId] = useState('')
    const [note, setNote] = useState('')
    const [creating, setCreating] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    const showToast = (msg: string, type: 'ok' | 'err') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4000)
    }

    const fetchCounts = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/stock-count')
        const j = await res.json()
        if (j.success) setCounts(j.data)
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchCounts()
        fetch('/api/locations').then(r => r.json()).then(j => j.success && setLocations(j.data))
    }, [fetchCounts])

    // Auto-generate name
    useEffect(() => {
        if (!name) {
            const now = new Date()
            setName(`นับสต็อค ${now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`)
        }
    }, [showCreate]) // eslint-disable-line

    async function create() {
        if (!name.trim()) { showToast('กรุณาระบุชื่อ', 'err'); return }
        setCreating(true)
        try {
            const res = await fetch('/api/stock-count', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), locationId: locationId || null, note }),
            })
            const j = await res.json()
            if (j.success) {
                showToast('✅ สร้าง Sheet แล้ว', 'ok')
                setShowCreate(false); setName(''); setLocationId(''); setNote('')
                fetchCounts()
            } else showToast(j.error || 'เกิดข้อผิดพลาด', 'err')
        } catch { showToast('เกิดข้อผิดพลาด', 'err') }
        finally { setCreating(false) }
    }

    async function cancel(count: StockCount) {
        if (!confirm(`ยกเลิก "${count.name}" ใช่ไหม?`)) return
        const res = await fetch(`/api/stock-count/${count.id}`, { method: 'DELETE' })
        const j = await res.json()
        if (j.success) { showToast('ยกเลิกแล้ว', 'ok'); fetchCounts() }
        else showToast(j.error, 'err')
    }

    return (
        <div className="page-container">
            {toast && (
                <div style={{
                    position: 'fixed', top: 16, right: 16, zIndex: 9999,
                    background: toast.type === 'ok' ? '#ECFDF5' : '#FEF2F2',
                    border: `1px solid ${toast.type === 'ok' ? '#A7F3D0' : '#FECACA'}`,
                    color: toast.type === 'ok' ? '#059669' : '#DC2626',
                    borderRadius: 12, padding: '10px 18px', fontWeight: 600, fontSize: '0.85rem',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                }}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, borderBottom: '2px solid var(--border)', paddingBottom: 16 }}>
                <div>
                    <h1 className="page-title">📋 นับสต็อคจริง</h1>
                    <p className="page-subtitle">Stock Count Sheet — เปรียบเทียบสต็อคจริงกับระบบ แล้ว apply adjustment</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(v => !v)}>
                    {showCreate ? '✕ ปิด' : '+ สร้าง Sheet ใหม่'}
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="card" style={{ marginBottom: 20, padding: '1.25rem' }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 14, fontSize: '0.95rem' }}>📋 สร้าง Stock Count Sheet ใหม่</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>ชื่อ Sheet *</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="นับสต็อค มี.ค. 67" />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>คลัง (ว่าง = ทั้งหมด)</label>
                            <select value={locationId} onChange={e => setLocationId(e.target.value)} className="input">
                                <option value="">ทุกคลัง</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>หมายเหตุ</label>
                        <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="ไม่บังคับ" />
                    </div>
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem', color: '#1D4ED8', marginBottom: 14 }}>
                        💡 ระบบจะดึงสินค้าจาก inventory ปัจจุบัน — systemQty จะ snapshot ใหม่อีกครั้งตอนกด <strong>เริ่มนับ</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowCreate(false)} className="btn btn-secondary">ยกเลิก</button>
                        <button onClick={create} className="btn btn-primary" disabled={creating}>
                            {creating ? '⏳ สร้าง...' : '✅ สร้าง Sheet'}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-secondary)' }}>โหลด...</div>
            ) : counts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 64 }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
                    <p style={{ color: 'var(--text-secondary)' }}>ยังไม่มี Sheet — กด <b>+ สร้าง Sheet ใหม่</b></p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {counts.map(c => {
                        const sc = STATUS_CONFIG[c.status]
                        return (
                            <div key={c.id} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{c.name}</span>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40` }}>
                                            {sc.label}
                                        </span>
                                        {c.status === 'IN_PROGRESS' && c.pendingCount > 0 && (
                                            <span style={{ fontSize: '0.68rem', background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 20, padding: '1px 8px', fontWeight: 600 }}>
                                                ⏳ ยังไม่ได้นับ {c.pendingCount} รายการ
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        <span>📦 {c._count.items} รายการ</span>
                                        {c.location ? <span>🏭 {c.location.code}</span> : <span>🏭 ทุกคลัง</span>}
                                        <span>📅 {new Date(c.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        {c.approvedAt && <span style={{ color: '#059669', fontWeight: 600 }}>✅ ปรับแล้ว</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                    {c.status !== 'CANCELLED' && c.status !== 'ADJUSTED' && (
                                        <Link href={`/stock-count/${c.id}`} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '6px 14px', textDecoration: 'none' }}>
                                            {c.status === 'DRAFT' ? '▶️ เปิด' : c.status === 'IN_PROGRESS' ? '✏️ นับต่อ' : '🔍 ดูผล'}
                                        </Link>
                                    )}
                                    {c.status === 'ADJUSTED' && (
                                        <Link href={`/stock-count/${c.id}`} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 14px', textDecoration: 'none' }}>
                                            📋 ดูรายงาน
                                        </Link>
                                    )}
                                    {['DRAFT', 'IN_PROGRESS'].includes(c.status) && (
                                        <button onClick={() => cancel(c)} style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer' }}>
                                            ยกเลิก
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
