'use client'
import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ── Catalog item shape from /api/items/search-for-bom ──────────────────────
interface CatalogItem {
    inventoryItemId: string; code: string; name: string;
    itemRole: string; baseUnit: string; hasProduct: boolean; productId: string | null;
}

// ── Slide-in panel: search Catalog → add to count sheet ────────────────────
function CatalogAddPanel({ countId, locationId, locations, onAdded, onClose }: {
    countId: string
    locationId: string   // pre-selected from count; user can override
    locations: { id: string; code: string; name: string }[]
    onAdded: () => void  // refresh parent
    onClose: () => void
}) {
    const [q, setQ] = useState('')
    const [results, setResults] = useState<CatalogItem[]>([])
    const [loading, setLoading] = useState(false)
    const [adding, setAdding] = useState<string | null>(null)  // inventoryItemId being added
    const [locId, setLocId] = useState(locationId)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

    const showToast = (msg: string, ok: boolean) => {
        setToast({ msg, ok })
        setTimeout(() => setToast(null), 3500)
    }

    function doSearch(query: string) {
        setLoading(true)
        fetch(`/api/items/search-for-bom?q=${encodeURIComponent(query)}&limit=25`)
            .then(r => r.json())
            .then(j => { if (j.success) setResults(j.data) })
            .catch(() => {})
            .finally(() => setLoading(false))
    }

    function handleQ(val: string) {
        setQ(val)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => doSearch(val), 250)
    }

    // load all on mount
    useEffect(() => { doSearch('') }, [])

    async function addItem(item: CatalogItem) {
        if (!locId) { showToast('กรุณาเลือกคลังก่อน', false); return }
        setAdding(item.inventoryItemId)
        try {
            const res = await fetch(`/api/stock-count/${countId}/add-item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inventoryItemId: item.inventoryItemId, locationId: locId }),
            })
            const j = await res.json()
            if (j.success) {
                showToast(`✅ เพิ่ม "${item.name}" แล้ว`, true)
                onAdded()
                // refresh results so duplicates are visually gone
                doSearch(q)
            } else {
                showToast(j.error || 'เกิดข้อผิดพลาด', false)
            }
        } catch {
            showToast('เกิดข้อผิดพลาด', false)
        } finally {
            setAdding(null)
        }
    }

    const ROLE_COLORS: Record<string, string> = {
        RAW: '#10B981', PREP: '#8B5CF6', SUPPLY: '#F59E0B', SERVICE: '#6B7280',
    }

    return (
        // Backdrop
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            {/* Panel */}
            <div style={{
                width: '100%', maxWidth: 420, height: '100%', background: 'var(--white)',
                display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.18)',
                animation: 'slideInRight 0.22s ease',
            }}>
                {/* Header */}
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1rem' }}>🧺 เพิ่มจาก Catalog</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>ค้นหารายการ → กด ➕ เพื่อเพิ่มเข้านับสต็อค</div>
                        </div>
                        <button onClick={onClose} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }}>✕</button>
                    </div>
                    {/* Location selector */}
                    <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>คลังที่นับ</label>
                        <select value={locId} onChange={e => setLocId(e.target.value)} className="input" style={{ fontSize: '0.82rem' }}>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                        </select>
                    </div>
                    {/* Search */}
                    <input
                        type="text"
                        className="input"
                        placeholder="🔍 ค้นหารายการ Catalog..."
                        value={q}
                        onChange={e => handleQ(e.target.value)}
                        style={{ fontSize: '0.83rem' }}
                        autoFocus
                    />
                </div>

                {/* Toast */}
                {toast && (
                    <div style={{
                        margin: '8px 12px 0', padding: '8px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                        background: toast.ok ? '#ECFDF5' : '#FEF2F2',
                        color: toast.ok ? '#059669' : '#DC2626',
                        border: `1px solid ${toast.ok ? '#A7F3D0' : '#FECACA'}`,
                    }}>{toast.msg}</div>
                )}

                {/* Results */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>⏳ กำลังค้นหา...</div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>ไม่พบรายการใน Catalog</div>
                    ) : results.map(item => (
                        <div key={item.inventoryItemId} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '0.6rem 1.25rem',
                            borderBottom: '1px solid var(--border-light)',
                        }}>
                            <span style={{
                                fontSize: '0.58rem', fontWeight: 800, padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                                background: `${ROLE_COLORS[item.itemRole] || '#6B7280'}18`,
                                color: ROLE_COLORS[item.itemRole] || '#6B7280',
                            }}>{item.itemRole}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 1 }}>
                                    <span style={{ fontFamily: 'monospace' }}>{item.baseUnit}</span>
                                    {item.hasProduct
                                        ? <span style={{ color: '#059669' }}>✅ มี Product</span>
                                        : <span style={{ color: '#D97706' }}>⚡ สร้างอัตโนมัติ</span>
                                    }
                                </div>
                            </div>
                            <button
                                onClick={() => addItem(item)}
                                disabled={adding === item.inventoryItemId}
                                style={{
                                    background: adding === item.inventoryItemId ? '#e5e7eb' : '#059669',
                                    border: 'none', borderRadius: 8, padding: '5px 12px',
                                    color: adding === item.inventoryItemId ? '#9ca3af' : '#fff',
                                    fontWeight: 700, fontSize: '0.78rem', cursor: adding === item.inventoryItemId ? 'not-allowed' : 'pointer',
                                    flexShrink: 0, fontFamily: 'inherit',
                                }}
                            >
                                {adding === item.inventoryItemId ? '⏳' : '➕'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
            `}</style>
        </div>
    )
}

type StockCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ADJUSTED' | 'CANCELLED'

interface CountItem {
    id: string; productId: string; locationId: string
    systemQty: number; countedQty: number | null; difference: number | null; unit: string
    product: { id: string; name: string; sku: string; unit: string; category: { name: string; icon: string; color?: string } }
    location: { id: string; code: string; name: string }
}

interface StockCount {
    id: string; name: string; status: StockCountStatus; note?: string
    startedAt?: string; completedAt?: string; approvedAt?: string
    location?: { code: string; name: string }
    items: CountItem[]
}

const STATUS_LABEL: Record<StockCountStatus, string> = {
    DRAFT: 'เตรียม', IN_PROGRESS: 'กำลังนับ', COMPLETED: 'รออนุมัติ', ADJUSTED: 'ปรับแล้ว', CANCELLED: 'ยกเลิก',
}

export default function StockCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [count, setCount] = useState<StockCount | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [filterDiff, setFilterDiff] = useState(false)
    const [pendingEdits, setPendingEdits] = useState<Record<string, number | null>>({})
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | 'warn' } | null>(null)
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
    const [showCatalogPanel, setShowCatalogPanel] = useState(false)
    const [locations, setLocations] = useState<{ id: string; code: string; name: string }[]>([])

    const showToast = (msg: string, type: 'ok' | 'err' | 'warn' = 'ok') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 5000)
    }

    const fetchCount = useCallback(async () => {
        const res = await fetch(`/api/stock-count/${id}`)
        const j = await res.json()
        if (j.success) setCount(j.data)
        setLoading(false)
    }, [id])

    useEffect(() => {
        fetchCount()
        fetch('/api/locations').then(r => r.json()).then(j => j.success && setLocations(j.data))
    }, [fetchCount])

    const canEdit = count?.status === 'IN_PROGRESS'

    function handleQtyChange(itemId: string, val: string) {
        const num = val === '' ? null : parseFloat(val)
        setPendingEdits(p => ({ ...p, [itemId]: num }))
    }

    function getCurrentQty(item: CountItem): number | null {
        if (itemId(item) in pendingEdits) return pendingEdits[itemId(item)]
        return item.countedQty
    }

    function itemId(item: CountItem) { return item.id }

    async function saveEdits() {
        if (!canEdit) return
        const items = Object.entries(pendingEdits).map(([id, countedQty]) => ({ id, countedQty }))
        if (items.length === 0) return
        setSaving(true)
        try {
            const res = await fetch(`/api/stock-count/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            })
            const j = await res.json()
            if (j.success) {
                setPendingEdits({})
                await fetchCount()
                showToast(`✅ บันทึก ${items.length} รายการ`, 'ok')
            } else showToast(j.error, 'err')
        } catch { showToast('เกิดข้อผิดพลาด', 'err') }
        finally { setSaving(false) }
    }

    async function action(endpoint: string, label: string, confirm_msg?: string) {
        if (confirm_msg && !confirm(confirm_msg)) return
        setActionLoading(true)
        try {
            const res = await fetch(`/api/stock-count/${id}/${endpoint}`, { method: 'POST' })
            const j = await res.json()
            if (j.success) {
                showToast(j.data.message || `✅ ${label} สำเร็จ`, 'ok')
                await fetchCount()
            } else showToast(j.error, 'err')
        } catch { showToast('เกิดข้อผิดพลาด', 'err') }
        finally { setActionLoading(false) }
    }

    if (loading) return <div className="page-container" style={{ paddingTop: 64, textAlign: 'center', color: 'var(--text-secondary)' }}>โหลด...</div>
    if (!count) return <div className="page-container" style={{ paddingTop: 64, textAlign: 'center' }}>ไม่พบข้อมูล</div>

    const items = count.items
    const filteredItems = items
        .filter(i => {
            if (search) {
                const q = search.toLowerCase()
                return i.product.name.toLowerCase().includes(q) || i.product.sku.toLowerCase().includes(q)
            }
            return true
        })
        .filter(i => !filterDiff || (i.difference !== null && Math.abs(i.difference) > 0.001))

    const totalItems = items.length
    const countedItems = items.filter(i => i.countedQty !== null).length
    const diffItems = items.filter(i => i.difference !== null && Math.abs(i.difference) > 0.001)
    const sumPlus = diffItems.filter(i => i.difference! > 0).reduce((s, i) => s + i.difference!, 0)
    const sumMinus = diffItems.filter(i => i.difference! < 0).reduce((s, i) => s + i.difference!, 0)

    const hasPending = Object.keys(pendingEdits).length > 0

    // Default location for catalog panel (first location of the count, or first available)
    const defaultLocId = count?.location
        ? (locations.find(l => l.code === count.location!.code)?.id ?? locations[0]?.id ?? '')
        : locations[0]?.id ?? ''

    return (
        <div className="page-container">
            {/* Catalog Add Panel */}
            {showCatalogPanel && (
                <CatalogAddPanel
                    countId={id}
                    locationId={defaultLocId}
                    locations={locations}
                    onAdded={fetchCount}
                    onClose={() => setShowCatalogPanel(false)}
                />
            )}
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 16, right: 16, zIndex: 9999,
                    background: toast.type === 'ok' ? '#ECFDF5' : toast.type === 'warn' ? '#FFFBEB' : '#FEF2F2',
                    border: `1px solid ${toast.type === 'ok' ? '#A7F3D0' : toast.type === 'warn' ? '#FDE68A' : '#FECACA'}`,
                    color: toast.type === 'ok' ? '#059669' : toast.type === 'warn' ? '#D97706' : '#DC2626',
                    borderRadius: 12, padding: '10px 18px', fontWeight: 600, fontSize: '0.85rem',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxWidth: 400, whiteSpace: 'pre-line',
                }}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <button onClick={() => router.push('/stock-count')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 8px 2px 0', color: 'var(--text-secondary)' }}>←</button>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
                            <h1 className="page-title" style={{ margin: 0 }}>📋 {count.name}</h1>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: count.status === 'IN_PROGRESS' ? '#FFFBEB' : count.status === 'ADJUSTED' ? '#ECFDF5' : count.status === 'COMPLETED' ? '#EFF6FF' : '#F3F4F6', color: count.status === 'IN_PROGRESS' ? '#D97706' : count.status === 'ADJUSTED' ? '#059669' : count.status === 'COMPLETED' ? '#2563EB' : '#6B7280' }}>
                                {STATUS_LABEL[count.status]}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                            {count.location ? `🏭 ${count.location.code}` : '🏭 ทุกคลัง'}
                            {count.startedAt && ` · เริ่ม ${new Date(count.startedAt).toLocaleString('th-TH')}`}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                        {hasPending && canEdit && (
                            <button onClick={saveEdits} disabled={saving} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
                                {saving ? '⏳ บันทึก...' : `💾 บันทึก (${Object.keys(pendingEdits).length})`}
                            </button>
                        )}
                        {/* ➕ Add from Catalog — available in DRAFT and IN_PROGRESS */}
                        {['DRAFT', 'IN_PROGRESS'].includes(count.status) && (
                            <button
                                onClick={() => setShowCatalogPanel(true)}
                                style={{
                                    background: 'rgba(5,150,105,0.1)', border: '1.5px solid #059669',
                                    borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                                    fontWeight: 700, fontSize: '0.8rem', color: '#059669', fontFamily: 'inherit',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}
                            >
                                🧺 เพิ่มจาก Catalog
                            </button>
                        )}
                        {count.status === 'DRAFT' && (
                            <button onClick={() => action('start', 'เริ่มนับ', 'เริ่มนับสต็อค? ระบบจะ snapshot จำนวนปัจจุบัน')} disabled={actionLoading} className="btn btn-primary">
                                {actionLoading ? '⏳...' : '▶️ เริ่มนับ'}
                            </button>
                        )}
                        {count.status === 'IN_PROGRESS' && (
                            <button onClick={() => { saveEdits().then(() => action('complete', 'เสร็จสิ้น', `เสร็จสิ้นการนับ? รายการที่ยังไม่นับ (${totalItems - countedItems} รายการ) จะถือว่าตรงกับระบบ`)) }} disabled={actionLoading} className="btn btn-primary">
                                {actionLoading ? '⏳...' : '✅ เสร็จสิ้นการนับ'}
                            </button>
                        )}
                        {count.status === 'COMPLETED' && (
                            <button onClick={() => action('approve', 'Approve', `Approve? ระบบจะปรับสต็อค ${diffItems.length} รายการที่มีผลต่าง — ไม่สามารถย้อนคืนได้!`)} disabled={actionLoading} className="btn btn-primary" style={{ background: '#059669' }}>
                                {actionLoading ? '⏳...' : `✅ Approve & ปรับสต็อค (${diffItems.length} รายการ)`}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress & Summary */}
            {count.status !== 'DRAFT' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
                    {[
                        { label: 'ทั้งหมด', value: totalItems, icon: '📦', color: '#6B7280' },
                        { label: 'นับแล้ว', value: countedItems, icon: '✅', color: '#059669' },
                        { label: 'ยังไม่นับ', value: totalItems - countedItems, icon: '⏳', color: '#D97706' },
                        { label: 'มีผลต่าง', value: diffItems.length, icon: '⚠️', color: '#EF4444' },
                    ].map(s => (
                        <div key={s.label} className="card" style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.4rem' }}>{s.icon}</div>
                            <div style={{ fontWeight: 800, fontSize: '1.3rem', color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Progress bar */}
            {count.status === 'IN_PROGRESS' && totalItems > 0 && (
                <div style={{ marginBottom: 16, background: '#F3F4F6', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#059669', width: `${(countedItems / totalItems) * 100}%`, transition: 'width 0.3s', borderRadius: 8 }} />
                </div>
            )}

            {/* Diff summary (COMPLETED / ADJUSTED) */}
            {diffItems.length > 0 && ['COMPLETED', 'ADJUSTED'].includes(count.status) && (
                <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600 }}>🟢 เพิ่มขึ้นรวม</span>
                        <div style={{ fontWeight: 800, color: '#059669' }}>+{sumPlus.toFixed(2)}</div>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600 }}>🔴 ลดลงรวม</span>
                        <div style={{ fontWeight: 800, color: '#DC2626' }}>{sumMinus.toFixed(2)}</div>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600 }}>ผลต่างสุทธิ</span>
                        <div style={{ fontWeight: 800, color: (sumPlus + sumMinus) >= 0 ? '#059669' : '#DC2626' }}>
                            {(sumPlus + sumMinus) >= 0 ? '+' : ''}{(sumPlus + sumMinus).toFixed(2)}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาสินค้า..." className="input" style={{ width: 220 }} />
                {diffItems.length > 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={filterDiff} onChange={e => setFilterDiff(e.target.checked)} style={{ accentColor: '#EF4444', width: 15, height: 15 }} />
                        ⚠️ แสดงเฉพาะที่มีผลต่าง ({diffItems.length})
                    </label>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                    แสดง {filteredItems.length} / {totalItems} รายการ
                </span>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.82rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>สินค้า</th>
                            <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>คลัง</th>
                            <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>ระบบ</th>
                            <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', minWidth: 110 }}>นับได้จริง</th>
                            <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>ผลต่าง</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredItems.map((item, idx) => {
                            const cqty = getCurrentQty(item)
                            const systemQty = item.systemQty
                            const diff = item.difference !== null ? item.difference : (cqty !== null ? cqty - systemQty : null)
                            const hasDiff = diff !== null && Math.abs(diff) > 0.001
                            const isPending = item.id in pendingEdits

                            return (
                                <tr key={item.id} style={{
                                    borderBottom: '1px solid var(--border)',
                                    background: hasDiff ? (diff! > 0 ? 'rgba(5,150,105,0.03)' : 'rgba(239,68,68,0.03)') : undefined,
                                }}>
                                    <td style={{ padding: '8px 14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '1rem' }}>{item.product.category.icon}</span>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                                                <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{item.product.sku}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px 8px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                        {item.location.code}
                                    </td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                        {systemQty.toFixed(2)}
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginLeft: 4 }}>{item.unit}</span>
                                    </td>
                                    <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                        {canEdit ? (
                                            <input
                                                ref={el => { inputRefs.current[item.id] = el }}
                                                type="number"
                                                step="0.01"
                                                value={cqty ?? ''}
                                                placeholder="—"
                                                onChange={e => handleQtyChange(item.id, e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        const next = filteredItems[idx + 1]
                                                        if (next) inputRefs.current[next.id]?.focus()
                                                    }
                                                }}
                                                style={{
                                                    width: 90, padding: '4px 8px', borderRadius: 6, textAlign: 'right',
                                                    border: `1.5px solid ${isPending ? '#7C3AED' : cqty !== null ? '#A7F3D0' : '#E5E7EB'}`,
                                                    background: isPending ? 'rgba(124,58,237,0.04)' : 'white',
                                                    fontWeight: 600, fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none',
                                                }}
                                            />
                                        ) : (
                                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: cqty !== null ? 'var(--text)' : 'var(--text-secondary)' }}>
                                                {cqty !== null ? cqty.toFixed(2) : '—'}
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block' }}>{item.unit}</span>
                                    </td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                        {diff !== null ? (
                                            <span style={{ color: Math.abs(diff) < 0.001 ? '#059669' : diff > 0 ? '#059669' : '#DC2626' }}>
                                                {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                            </span>
                                        ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {filteredItems.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        ไม่พบรายการ
                    </div>
                )}
            </div>

            {/* Floating save bar */}
            {hasPending && canEdit && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    background: '#1A1D26', color: '#fff', borderRadius: 16, padding: '12px 24px',
                    display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    zIndex: 100, fontSize: '0.85rem',
                }}>
                    <span>✏️ แก้ไข {Object.keys(pendingEdits).length} รายการ</span>
                    <button onClick={saveEdits} disabled={saving} style={{
                        background: '#059669', color: '#fff', border: 'none', borderRadius: 10,
                        padding: '6px 18px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                    }}>
                        {saving ? '⏳...' : '💾 บันทึก'}
                    </button>
                    <button onClick={() => setPendingEdits({})} style={{
                        background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none',
                        borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: '0.78rem',
                    }}>✕</button>
                </div>
            )}
        </div>
    )
}
