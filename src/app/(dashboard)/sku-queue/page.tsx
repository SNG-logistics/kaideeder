'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Suggestion {
    id: string
    rawName: string
    rawUnit?: string | null
    rawCategory?: string | null
    rawCostPrice?: number | null
    rawSalePrice?: number | null
    suggestedSku?: string | null
    matchScore?: number | null
    importSource?: string | null
    createdAt: string
    matchedProduct?: {
        sku: string; name: string; unit: string
        category: { code: string; name: string }
    } | null
}

type StatusTab = 'PENDING' | 'APPROVED_MAP' | 'APPROVED_NEW' | 'REJECTED'

// ── Score badge ───────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score?: number | null }) {
    if (score == null) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
    const pct = Math.round(score * 100)
    const color = pct >= 85 ? '#059669' : pct >= 60 ? '#D97706' : '#EF4444'
    return (
        <span style={{
            display: 'inline-block', padding: '1px 8px', borderRadius: 20,
            fontSize: '0.72rem', fontWeight: 700, color: '#fff',
            background: color, letterSpacing: '0.02em',
        }}>
            {pct}%
        </span>
    )
}

// ── Approve modal ─────────────────────────────────────────────────────────────
function ApproveModal({ suggestion, onClose, onDone }: {
    suggestion: Suggestion
    onClose: () => void
    onDone: () => void
}) {
    const [action, setAction] = useState<'map' | 'new'>(suggestion.matchedProduct ? 'map' : 'new')
    const [editName, setEditName] = useState(suggestion.rawName)
    const [editUnit, setEditUnit] = useState(suggestion.rawUnit ?? '')
    const [editCat, setEditCat] = useState(suggestion.rawCategory ?? '')
    const [editAlias, setEditAlias] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleApprove() {
        setSaving(true)
        try {
            const res = await fetch(`/api/sku-queue/${suggestion.id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    targetProductId: action === 'map' ? suggestion.matchedProduct?.sku : undefined,
                    editedName: editName || undefined,
                    editedUnit: editUnit || undefined,
                    editedCategoryCode: editCat || undefined,
                    editedAlias: editAlias || undefined,
                }),
            })
            const json = await res.json()
            if (json.success) {
                toast.success(action === 'map' ? `✅ Map สำเร็จ → ${suggestion.matchedProduct?.sku}` : `✅ สร้าง SKU ใหม่ ${json.sku}`)
                onDone()
            } else toast.error(json.error ?? 'เกิดข้อผิดพลาด')
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: '1rem', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'var(--white)', borderRadius: 18, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                {/* Header */}
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>✅ อนุมัติรายการ</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>"{suggestion.rawName}"</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }}>✕</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Action selector */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                            { val: 'map' as const, icon: '🔗', label: 'Map → SKU เดิม', disabled: !suggestion.matchedProduct, color: '#059669' },
                            { val: 'new' as const, icon: '✨', label: 'สร้าง SKU ใหม่', disabled: false, color: '#7C3AED' },
                        ].map(opt => (
                            <button key={opt.val} disabled={opt.disabled}
                                onClick={() => setAction(opt.val)}
                                style={{
                                    padding: '0.75rem', borderRadius: 12, fontFamily: 'inherit', cursor: opt.disabled ? 'not-allowed' : 'pointer',
                                    border: `2px solid ${action === opt.val ? opt.color : 'var(--border)'}`,
                                    background: action === opt.val ? `${opt.color}18` : 'var(--bg)',
                                    opacity: opt.disabled ? 0.4 : 1,
                                    color: action === opt.val ? opt.color : 'var(--text)',
                                    fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.15s',
                                }}>
                                <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{opt.icon}</div>
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Matched product info (map mode) */}
                    {action === 'map' && suggestion.matchedProduct && (
                        <div style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 12, padding: '0.85rem 1rem' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>จะ Map ไปที่</div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{suggestion.matchedProduct.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                SKU: {suggestion.matchedProduct.sku} · {suggestion.matchedProduct.unit} · {suggestion.matchedProduct.category.name}
                            </div>
                            <div style={{ marginTop: 10 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Alias ที่จะสร้าง</label>
                                <input value={editAlias || suggestion.rawName} onChange={e => setEditAlias(e.target.value)}
                                    className="input" style={{ fontSize: '0.85rem' }} placeholder="ชื่อ alias..." />
                            </div>
                        </div>
                    )}

                    {/* New SKU form */}
                    {action === 'new' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                จะสร้าง SKU ใหม่: <strong style={{ fontFamily: 'monospace', color: '#7C3AED' }}>{suggestion.suggestedSku}</strong>
                            </div>
                            {[
                                { label: 'ชื่อสินค้า', val: editName, set: setEditName, ph: 'ชื่อ...' },
                                { label: 'หน่วย', val: editUnit, set: setEditUnit, ph: 'กก., ขวด, จาน...' },
                                { label: 'Category Code', val: editCat, set: setEditCat, ph: 'PROTEIN_PORK, BEER, FOOD_GRILL...' },
                            ].map(f => (
                                <div key={f.label}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                                    <input value={f.val} onChange={e => f.set(e.target.value)}
                                        className="input" style={{ fontSize: '0.85rem' }} placeholder={f.ph} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '0.65rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                        ยกเลิก
                    </button>
                    <button onClick={handleApprove} disabled={saving}
                        style={{ flex: 2, padding: '0.65rem', borderRadius: 10, border: 'none', background: action === 'map' ? 'linear-gradient(135deg,#059669,#10B981)' : 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                        {saving ? '⏳ กำลังบันทึก...' : action === 'map' ? '🔗 ยืนยัน Map' : '✨ สร้าง SKU ใหม่'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SkuQueuePage() {
    useRoleGuard(['owner', 'manager'])

    const [tab, setTab] = useState<StatusTab>('PENDING')
    const [items, setItems] = useState<Suggestion[]>([])
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState<Suggestion | null>(null)
    const [rejecting, setRejecting] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/sku-queue?status=${tab}`)
            const json = await res.json()
            if (json.success) setItems(json.data)
        } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
        finally { setLoading(false) }
    }, [tab])

    useEffect(() => { load() }, [load])

    async function handleReject(id: string) {
        setRejecting(id)
        try {
            const res = await fetch(`/api/sku-queue/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
            const json = await res.json()
            if (json.success) { toast.success('❌ ปฏิเสธรายการแล้ว'); load() }
            else toast.error(json.error ?? 'เกิดข้อผิดพลาด')
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setRejecting(null) }
    }

    const TABS: { key: StatusTab; label: string; icon: string }[] = [
        { key: 'PENDING', label: 'รอดำเนินการ', icon: '⏳' },
        { key: 'APPROVED_MAP', label: 'Map แล้ว', icon: '🔗' },
        { key: 'APPROVED_NEW', label: 'สร้างใหม่แล้ว', icon: '✨' },
        { key: 'REJECTED', label: 'ปฏิเสธ', icon: '❌' },
    ]

    return (
        <div className="page-container">
            {selected && (
                <ApproveModal
                    suggestion={selected}
                    onClose={() => setSelected(null)}
                    onDone={() => { setSelected(null); load() }}
                />
            )}

            <div className="page-header">
                <div>
                    <h1 className="page-title">🔍 SKU Mapping Queue</h1>
                    <p className="page-subtitle">รายการที่รอการอนุมัติ mapping / สร้าง SKU ใหม่</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Template downloads */}
                    <div style={{ position: 'relative' }}>
                        <details style={{ listStyle: 'none' }}>
                            <summary style={{
                                padding: '0.45rem 0.85rem', borderRadius: 10, border: '1.5px solid var(--border)',
                                background: 'var(--white)', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none',
                            }}>
                                📥 Template
                            </summary>
                            <div style={{
                                position: 'absolute', right: 0, top: '110%', zIndex: 500,
                                background: 'var(--white)', border: '1px solid var(--border)',
                                borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                                minWidth: 220, padding: '0.5rem',
                            }}>
                                {[
                                    { type: 'sku_master',  icon: '📦', label: 'SKU Master (วัตถุดิบ/สินค้า)' },
                                    { type: 'categories',  icon: '🏷️', label: 'Categories (หมวดหมู่)' },
                                    { type: 'units',       icon: '⚖️', label: 'Units (หน่วยนับ)' },
                                    { type: 'sku_aliases', icon: '🔤', label: 'SKU Aliases (ชื่อเรียก)' },
                                    { type: 'stock_in',    icon: '📋', label: 'Stock-In Import (รับเข้า)' },
                                    { type: 'menu_recipe', icon: '🍽️', label: 'Menu Recipe (สูตรอาหาร)' },
                                ].map(t => (
                                    <a key={t.type}
                                        href={`/api/master/templates?type=${t.type}`}
                                        download
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '0.5rem 0.75rem', borderRadius: 8,
                                            color: 'var(--text)', textDecoration: 'none',
                                            fontSize: '0.82rem', fontWeight: 600,
                                            transition: 'background 0.12s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {t.icon} {t.label}
                                    </a>
                                ))}
                            </div>
                        </details>
                    </div>
                    <button onClick={load} className="btn btn-outline btn-sm">🔄 รีโหลด</button>
                </div>
            </div>


            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        style={{
                            padding: '0.45rem 1rem', borderRadius: 20, fontFamily: 'inherit',
                            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', border: 'none',
                            background: tab === t.key ? 'var(--accent)' : 'var(--bg)',
                            color: tab === t.key ? '#fff' : 'var(--text)',
                            boxShadow: tab === t.key ? '0 2px 10px rgba(var(--accent-rgb),0.3)' : 'none',
                            transition: 'all 0.15s',
                        }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>⏳ กำลังโหลด...</div>
                ) : items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                        <p style={{ fontWeight: 600 }}>ไม่มีรายการในหมวดนี้</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                    {['ชื่อดิบ', 'หน่วย / หมวด', 'ผลการจับคู่', 'คะแนน', 'ไฟล์', 'วันที่', tab === 'PENDING' ? 'Action' : 'สถานะ'].map(h => (
                                        <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((s, i) => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? 'var(--white)' : 'var(--bg)' }}>
                                        {/* Raw name */}
                                        <td style={{ padding: '0.65rem 0.85rem' }}>
                                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{s.rawName}</div>
                                            {s.suggestedSku && (
                                                <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#7C3AED', marginTop: 2 }}>→ {s.suggestedSku}</div>
                                            )}
                                        </td>
                                        {/* Unit / Category */}
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                            <div>{s.rawUnit || '—'}</div>
                                            <div style={{ fontSize: '0.68rem', marginTop: 1 }}>{s.rawCategory || '—'}</div>
                                        </td>
                                        {/* Matched product */}
                                        <td style={{ padding: '0.65rem 0.85rem' }}>
                                            {s.matchedProduct ? (
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#059669', fontSize: '0.8rem' }}>{s.matchedProduct.name}</div>
                                                    <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>{s.matchedProduct.sku} · {s.matchedProduct.unit}</div>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>ไม่พบ — สร้างใหม่</span>
                                            )}
                                        </td>
                                        {/* Score */}
                                        <td style={{ padding: '0.65rem 0.85rem' }}><ScoreBadge score={s.matchScore} /></td>
                                        {/* Source */}
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.72rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {s.importSource || '—'}
                                        </td>
                                        {/* Date */}
                                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                            {new Date(s.createdAt).toISOString().slice(0, 10)}

                                        </td>
                                        {/* Action */}
                                        <td style={{ padding: '0.65rem 0.85rem' }}>
                                            {tab === 'PENDING' ? (
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        onClick={() => setSelected(s)}
                                                        style={{ padding: '0.35rem 0.75rem', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                                        ✅ อนุมัติ
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(s.id)}
                                                        disabled={rejecting === s.id}
                                                        style={{ padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontWeight: 700, fontSize: '0.75rem', cursor: rejecting === s.id ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: rejecting === s.id ? 0.6 : 1 }}>
                                                        ❌
                                                    </button>
                                                </div>
                                            ) : (
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                                                    background: tab === 'APPROVED_MAP' ? 'rgba(5,150,105,0.12)' : tab === 'APPROVED_NEW' ? 'rgba(124,58,237,0.12)' : 'rgba(107,114,128,0.12)',
                                                    color: tab === 'APPROVED_MAP' ? '#059669' : tab === 'APPROVED_NEW' ? '#7C3AED' : '#6B7280',
                                                }}>
                                                    {tab === 'APPROVED_MAP' ? 'Map แล้ว' : tab === 'APPROVED_NEW' ? 'สร้างแล้ว' : 'ปฏิเสธ'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Summary footer */}
            {items.length > 0 && (
                <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {items.length} รายการ
                </div>
            )}
        </div>
    )
}
