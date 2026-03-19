'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type FailReason = 'NO_BOM' | 'BOM_INCOMPLETE' | 'NO_UOM_CONV' | 'STOCK_EMPTY' | 'WRONG_WAREHOUSE' | 'NO_GR' | 'SYSTEM_ERROR'
type FailStatus = 'OPEN' | 'RESOLVED' | 'IGNORED'

interface FailLog {
    id: string
    orderId: string
    orderNumber?: string | null
    menuId?: string | null
    menuName?: string | null
    ingredientId?: string | null
    ingredientName?: string | null
    locationId?: string | null
    failReason: FailReason
    requiredQty: number
    requiredUnit?: string | null
    availableQty: number
    detail?: string | null
    status: FailStatus
    createdAt: string
    resolvedAt?: string | null
}

interface Summary { reason: FailReason; count: number }

// ─────────────────────────────────────────────────────────────────────────────
// ข้อความภาษาไทยสำหรับแต่ละปัญหา
// ─────────────────────────────────────────────────────────────────────────────
const REASON_CONFIG: Record<FailReason, {
    label: string       // ชื่อสั้นบน badge
    desc: string        // คำอธิบายในตาราง
    fix: string         // วิธีแก้
    color: string; bg: string; icon: string
    btnLabel: string    // ข้อความปุ่ม action
    btnIcon: string
    actionHref?: string
}> = {
    NO_BOM: {
        label: 'ยังไม่มีสูตรอาหาร',
        desc: 'เมนูนี้ยังไม่ได้ตั้งสูตรวัตถุดิบ (BOM) ระบบเลยตัดสต็อคไม่ได้',
        fix: 'ไปตั้งสูตรอาหารที่หน้า "สูตรอาหาร (BOM)"',
        color: '#D97706', bg: '#FFFBEB', icon: '📋',
        btnLabel: 'ไปตั้งสูตร', btnIcon: '📋', actionHref: '/recipes',
    },
    BOM_INCOMPLETE: {
        label: 'สูตรอาหารไม่ครบ',
        desc: 'สูตรอาหารมีวัตถุดิบบางตัวหายไป หรือข้อมูลไม่สมบูรณ์',
        fix: 'เปิดสูตรอาหารแล้วตรวจสอบรายการวัตถุดิบให้ครบ',
        color: '#D97706', bg: '#FFFBEB', icon: '⚠️',
        btnLabel: 'แก้ไขสูตร', btnIcon: '✏️', actionHref: '/recipes',
    },
    NO_UOM_CONV: {
        label: 'หน่วยไม่ตรงกัน',
        desc: 'วัตถุดิบในสต็อคใช้หน่วยต่างกับในสูตร เช่น ซื้อเป็น "ถุง" แต่สูตรใช้ "กรัม" และยังไม่ได้ตั้งค่าแปลงหน่วย',
        fix: 'ไปตั้งค่าแปลงหน่วยที่ Settings → หน่วยแปลง (UOM)',
        color: '#DC2626', bg: '#FEF2F2', icon: '🔄',
        btnLabel: 'ตั้งค่าหน่วย', btnIcon: '⚙️', actionHref: '/settings/uom',
    },
    STOCK_EMPTY: {
        label: 'ของหมด / ของขาด',
        desc: 'วัตถุดิบในคลังมีไม่พอ ระบบตัดสต็อคได้บางส่วน แต่ยอดติดลบ',
        fix: 'รับวัตถุดิบเพิ่มเข้าคลัง หรือตรวจสอบว่านับสต็อคครบหรือยัง',
        color: '#DC2626', bg: '#FEF2F2', icon: '📭',
        btnLabel: 'ซื้อเพิ่ม', btnIcon: '🛒', actionHref: '/purchase',
    },
    WRONG_WAREHOUSE: {
        label: 'ของอยู่คลังอื่น',
        desc: 'มีวัตถุดิบอยู่ แต่อยู่ผิดคลัง ระบบหาไม่เจอในคลังที่กำหนด',
        fix: 'โอนวัตถุดิบจากคลังที่มีมาไว้คลังที่ถูกต้อง',
        color: '#7C3AED', bg: '#F5F3FF', icon: '🏭',
        btnLabel: 'โอนวัตถุดิบ', btnIcon: '🔄', actionHref: '/transfer',
    },
    NO_GR: {
        label: 'ยังไม่ได้รับเข้าคลัง',
        desc: 'ซื้อวัตถุดิบมาแล้ว แต่ยังไม่ได้บันทึกรับเข้าคลัง ระบบเลยไม่เห็นของ',
        fix: 'บันทึกรับวัตถุดิบเข้าคลัง (GR) ที่หน้า "ซื้อเข้า / GR"',
        color: '#2563EB', bg: '#EFF6FF', icon: '📦',
        btnLabel: 'บันทึกรับของ', btnIcon: '📥', actionHref: '/purchase',
    },
    SYSTEM_ERROR: {
        label: 'ระบบมีปัญหา',
        desc: 'เกิดข้อผิดพลาดในระบบระหว่างตัดสต็อค อาจเป็นปัญหาชั่วคราว',
        fix: 'ลองปิดบิลใหม่ หรือติดต่อผู้ดูแลระบบถ้าปัญหายังอยู่',
        color: '#6B7280', bg: '#F9FAFB', icon: '🔧',
        btnLabel: 'ดูรายละเอียด', btnIcon: '🔍',
    },
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────────────────────────────────────────
function SummaryCard({ reason, count, active, onClick }: {
    reason: FailReason | 'ALL'; count: number; active: boolean; onClick: () => void
}) {
    const cfg = reason === 'ALL'
        ? { icon: '⚠️', label: 'ปัญหาทั้งหมด', color: '#DC2626', bg: '#FEF2F2' }
        : REASON_CONFIG[reason as FailReason]
    return (
        <div onClick={onClick} style={{
            padding: '0.75rem 1rem', borderRadius: 14, cursor: 'pointer',
            border: active ? `2px solid ${cfg.color}` : '1.5px solid var(--border)',
            background: active ? cfg.bg : 'var(--white)',
            transition: 'all 0.15s',
            boxShadow: active ? `0 0 0 3px ${cfg.color}20` : 'none',
            minWidth: 120,
        }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{cfg.icon}</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: cfg.color, lineHeight: 1 }}>{count}</div>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: 3 }}>{cfg.label}</div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail modal — ภาษาไทยชัดเจน
// ─────────────────────────────────────────────────────────────────────────────
function DetailModal({ log, onClose, onResolve }: {
    log: FailLog
    onClose: () => void
    onResolve: (ids: string[], status: 'RESOLVED' | 'IGNORED', note?: string) => void
}) {
    const cfg = REASON_CONFIG[log.failReason]
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)

    async function handle(status: 'RESOLVED' | 'IGNORED') {
        setSaving(true)
        await onResolve([log.id], status, note)
        setSaving(false)
        onClose()
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', background: cfg.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: '1.4rem' }}>{cfg.icon}</span>
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: cfg.color }}>{cfg.label}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            บิลเลขที่ <strong style={{ fontFamily: 'monospace' }}>#{log.orderNumber || log.orderId.slice(-6)}</strong>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* ปัญหาคืออะไร */}
                    <div style={{ background: `${cfg.color}0d`, border: `1px solid ${cfg.color}30`, borderRadius: 10, padding: '0.85rem 1rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>ปัญหาคืออะไร?</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.6 }}>{cfg.desc}</div>
                    </div>

                    {/* Info rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                            { label: '🍽️ เมนูที่สั่ง', val: log.menuName },
                            { label: '🥩 วัตถุดิบที่ขาด', val: log.ingredientName },
                            { label: '📦 ต้องการ', val: log.requiredQty > 0 ? `${log.requiredQty} ${log.requiredUnit || ''}` : null },
                            { label: '📊 มีในคลัง', val: log.requiredQty > 0 ? `${log.availableQty} ${log.requiredUnit || ''}` : null },
                        ].filter(r => r.val).map(r => (
                            <div key={r.label} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 100, flexShrink: 0 }}>{r.label}</span>
                                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{r.val}</span>
                            </div>
                        ))}
                    </div>

                    {/* วิธีแก้ */}
                    <div style={{ background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 10, padding: '0.85rem 1rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>วิธีแก้ไข</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.6 }}>{cfg.fix}</div>
                    </div>

                    {/* ปุ่มไปแก้ */}
                    {cfg.actionHref && (
                        <Link href={cfg.actionHref} onClick={onClose} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '0.65rem 1rem', borderRadius: 10,
                            background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`,
                            color: cfg.color, fontWeight: 700, fontSize: '0.85rem',
                            textDecoration: 'none',
                        }}>
                            <span>{cfg.btnIcon}</span>
                            <span>ไปแก้เลย: {cfg.btnLabel} →</span>
                        </Link>
                    )}

                    {/* หมายเหตุ */}
                    <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>📝 บันทึกวิธีที่แก้ไข (ไม่บังคับ)</label>
                        <input value={note} onChange={e => setNote(e.target.value)}
                            placeholder="เช่น รับของเพิ่มแล้ว / เพิ่มสูตรอาหารแล้ว..."
                            style={{ width: '100%', padding: '0.55rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '0.9rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                    <button onClick={() => handle('IGNORED')} disabled={saving}
                        style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem' }}>
                        ⏭️ ข้ามไปก่อน
                    </button>
                    <button onClick={() => handle('RESOLVED')} disabled={saving}
                        style={{ flex: 2, padding: '0.6rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', opacity: saving ? 0.7 : 1 }}>
                        {saving ? '⏳ กำลังบันทึก...' : '✅ แก้ไขเรียบร้อยแล้ว'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function ConsumeFailPage() {
    useRoleGuard(['owner', 'manager'])

    const [items, setItems] = useState<FailLog[]>([])
    const [summary, setSummary] = useState<Summary[]>([])
    const [loading, setLoading] = useState(true)
    const [statusTab, setStatusTab] = useState<'OPEN' | 'RESOLVED' | 'IGNORED' | 'ALL'>('OPEN')
    const [filterReason, setFilterReason] = useState<FailReason | 'ALL'>('ALL')
    const [selected, setSelected] = useState<FailLog | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkSaving, setBulkSaving] = useState(false)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        setSelectedIds(new Set())
        try {
            const params = new URLSearchParams({ status: statusTab, page: String(page), limit: '30' })
            const res = await fetch(`/api/consume-fail?${params}`)
            const json = await res.json()
            if (json.success) {
                setItems(json.data.items)
                setSummary(json.data.summary)
                setTotal(json.data.total)
                setTotalPages(json.data.totalPages)
            }
        } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
        finally { setLoading(false) }
    }, [statusTab, page])

    useEffect(() => { load() }, [load])

    const filteredItems = filterReason === 'ALL' ? items : items.filter(i => i.failReason === filterReason)

    async function handleResolve(ids: string[], status: 'RESOLVED' | 'IGNORED', note?: string) {
        try {
            const res = await fetch('/api/consume-fail', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, status, resolvedNote: note }),
            })
            const json = await res.json()
            if (json.success) {
                toast.success(status === 'RESOLVED' ? `✅ บันทึกแก้ไขแล้ว ${json.data.updated} รายการ` : `⏭️ ข้ามไปแล้ว ${json.data.updated} รายการ`)
                load()
            } else toast.error(json.error ?? 'เกิดข้อผิดพลาด')
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    async function handleBulk(status: 'RESOLVED' | 'IGNORED') {
        if (selectedIds.size === 0) return
        setBulkSaving(true)
        await handleResolve([...selectedIds], status)
        setBulkSaving(false)
        setSelectedIds(new Set())
    }

    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    function toggleAll() {
        if (selectedIds.size === filteredItems.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(filteredItems.map(i => i.id)))
    }

    const openCount = summary.reduce((s, r) => s + r.count, 0)

    const STATUS_TABS = [
        { key: 'OPEN' as const,     label: 'รอแก้ไข',    icon: '🔴', color: '#DC2626' },
        { key: 'RESOLVED' as const, label: 'แก้แล้ว',    icon: '✅', color: '#059669' },
        { key: 'IGNORED' as const,  label: 'ข้ามไปก่อน', icon: '⏭️', color: '#6B7280' },
        { key: 'ALL' as const,      label: 'ดูทั้งหมด',  icon: '📋', color: '#374151' },
    ]

    const TABLE_HEADERS = ['ประเภทปัญหา', 'บิลเลขที่', 'เมนูที่สั่ง', 'วัตถุดิบที่ขาด', 'ต้องการ / มีในคลัง', 'เวลา', 'จัดการ']

    return (
        <div className="page-container">
            {selected && (
                <DetailModal
                    log={selected}
                    onClose={() => setSelected(null)}
                    onResolve={async (ids, status, note) => { await handleResolve(ids, status, note) }}
                />
            )}

            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        ⚠️ ปัญหาการตัดสต็อค
                        {openCount > 0 && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                marginLeft: 10, minWidth: 26, height: 26, borderRadius: 13,
                                background: '#DC2626', color: '#fff',
                                fontSize: '0.72rem', fontWeight: 800,
                            }}>{openCount}</span>
                        )}
                    </h1>
                    <p className="page-subtitle">
                        รายการวัตถุดิบที่ระบบตัดสต็อคไม่ได้หลังปิดบิล — แก้ไขให้ครบเพื่อให้ยอดสต็อคถูกต้อง
                    </p>
                </div>
                <button onClick={load} className="btn btn-outline btn-sm">🔄 โหลดใหม่</button>
            </div>

            {/* Summary cards */}
            {statusTab === 'OPEN' && summary.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
                    <SummaryCard reason="ALL" count={openCount} active={filterReason === 'ALL'} onClick={() => setFilterReason('ALL')} />
                    {summary.map(s => (
                        <SummaryCard key={s.reason} reason={s.reason} count={s.count}
                            active={filterReason === s.reason}
                            onClick={() => setFilterReason(prev => prev === s.reason ? 'ALL' : s.reason)}
                        />
                    ))}
                </div>
            )}

            {/* Status tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                {STATUS_TABS.map(t => (
                    <button key={t.key} onClick={() => { setStatusTab(t.key); setPage(1); setFilterReason('ALL') }}
                        style={{
                            padding: '0.4rem 0.9rem', borderRadius: 20, fontFamily: 'inherit',
                            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', border: 'none',
                            background: statusTab === t.key ? t.color : 'var(--bg)',
                            color: statusTab === t.key ? '#fff' : 'var(--text)',
                            transition: 'all 0.15s',
                        }}>
                        {t.icon} {t.label}
                    </button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    {total} รายการ
                </span>
            </div>

            {/* Bulk actions */}
            {statusTab === 'OPEN' && selectedIds.size > 0 && (
                <div style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    padding: '0.65rem 1rem', borderRadius: 12, marginBottom: 12,
                    background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)',
                }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563EB' }}>
                        เลือก {selectedIds.size} รายการ
                    </span>
                    <button onClick={() => handleBulk('RESOLVED')} disabled={bulkSaving}
                        style={{ padding: '0.35rem 0.85rem', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        ✅ แก้ไขทั้งหมดแล้ว
                    </button>
                    <button onClick={() => handleBulk('IGNORED')} disabled={bulkSaving}
                        style={{ padding: '0.35rem 0.85rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        ⏭️ ข้ามไปก่อน
                    </button>
                    <button onClick={() => setSelectedIds(new Set())}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        ยกเลิก
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        กำลังโหลด...
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>{statusTab === 'OPEN' ? '🎉' : '📋'}</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                            {statusTab === 'OPEN' ? 'ไม่มีปัญหาค้างอยู่ เยี่ยมมาก!' : 'ไม่มีรายการ'}
                        </div>
                        <div style={{ fontSize: '0.82rem' }}>
                            {statusTab === 'OPEN' ? 'ระบบตัดสต็อคให้อัตโนมัติทุกรายการปกติดี ✅' : 'ยังไม่มีรายการในหมวดนี้'}
                        </div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                    {statusTab === 'OPEN' && (
                                        <th style={{ padding: '0.6rem 0.75rem', width: 40 }}>
                                            <input type="checkbox"
                                                checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                                                onChange={toggleAll}
                                                style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                                            />
                                        </th>
                                    )}
                                    {TABLE_HEADERS.map(h => (
                                        <th key={h} style={{ padding: '0.6rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((log, i) => {
                                    const cfg = REASON_CONFIG[log.failReason]
                                    const isSelected = selectedIds.has(log.id)
                                    return (
                                        <tr key={log.id} style={{
                                            borderBottom: '1px solid var(--border-light)',
                                            background: isSelected ? 'rgba(37,99,235,0.04)' : i % 2 === 0 ? 'var(--white)' : 'var(--bg)',
                                            transition: 'background 0.1s',
                                        }}>
                                            {/* Checkbox */}
                                            {statusTab === 'OPEN' && (
                                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(log.id)}
                                                        style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                                                </td>
                                            )}
                                            {/* ประเภทปัญหา */}
                                            <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                                                    background: cfg.bg, color: cfg.color,
                                                }}>
                                                    {cfg.icon} {cfg.label}
                                                </span>
                                            </td>
                                            {/* บิลเลขที่ */}
                                            <td style={{ padding: '0.6rem 0.85rem' }}>
                                                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    #{log.orderNumber || log.orderId.slice(-6)}
                                                </span>
                                            </td>
                                            {/* เมนู */}
                                            <td style={{ padding: '0.6rem 0.85rem' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.menuName || '—'}</span>
                                            </td>
                                            {/* วัตถุดิบ */}
                                            <td style={{ padding: '0.6rem 0.85rem' }}>
                                                <span style={{ fontSize: '0.82rem' }}>{log.ingredientName || '—'}</span>
                                            </td>
                                            {/* จำนวน */}
                                            <td style={{ padding: '0.6rem 0.85rem', whiteSpace: 'nowrap' }}>
                                                {log.requiredQty > 0 ? (
                                                    <div style={{ lineHeight: 1.5 }}>
                                                        <div style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.82rem' }}>
                                                            ต้องการ {log.requiredQty} {log.requiredUnit}
                                                        </div>
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                                            มีในคลัง {log.availableQty} {log.requiredUnit}
                                                        </div>
                                                    </div>
                                                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                            </td>
                                            {/* เวลา */}
                                            <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                                {new Date(log.createdAt).toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            {/* จัดการ */}
                                            <td style={{ padding: '0.6rem 0.85rem' }}>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                                                    <button onClick={() => setSelected(log)}
                                                        style={{ padding: '0.3rem 0.75rem', borderRadius: 8, border: `1px solid ${cfg.color}40`, background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                                        {cfg.btnIcon} ดูรายละเอียด
                                                    </button>
                                                    {statusTab === 'OPEN' && (
                                                        <button onClick={() => handleResolve([log.id], 'RESOLVED')}
                                                            style={{ padding: '0.3rem 0.65rem', borderRadius: 8, border: 'none', background: 'rgba(5,150,105,0.1)', color: '#059669', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                                            ✅ แก้แล้ว
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, fontFamily: 'inherit' }}>
                        ← หน้าก่อน
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        หน้า {page} / {totalPages}
                    </span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1, fontFamily: 'inherit' }}>
                        หน้าถัดไป →
                    </button>
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
