'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useCallback } from 'react'
import { formatNumber } from '@/lib/utils'
import { useCurrency } from '@/context/TenantContext'

interface InvItem {
    id: string; quantity: number; avgCost: number
    product: { id: string; sku: string; name: string; unit: string; minQty: number; imageUrl?: string; productType: string; category: { name: string; icon: string; color?: string } }
    location: { code: string; name: string }
}
interface LocationSummary { name: string; items: number; totalValue: number }

type ViewFilter = 'all' | 'sale' | 'raw'

// ─── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ inv, onClose, onSaved }: { inv: InvItem; onClose: () => void; onSaved: () => void }) {
    const { fmt } = useCurrency()
    const [qty, setQty] = useState(String(inv.quantity))
    const [cost, setCost] = useState(String(inv.avgCost))
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    async function handleSave() {
        setSaving(true); setError('')
        try {
            const res = await fetch(`/api/inventory/${inv.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: parseFloat(qty), avgCost: parseFloat(cost), note }),
            })
            const json = await res.json()
            if (json.success) { onSaved(); onClose() }
            else setError(json.error || 'เกิดข้อผิดพลาด')
        } catch { setError('ไม่สามารถเชื่อมต่อได้') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9CA3AF', minWidth: 32, minHeight: 32 }}>✕</button>

                <h2 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 4 }}>✏️ แก้ไขสต็อค</h2>
                <p style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: 16 }}>
                    <strong style={{ color: '#E8364E' }}>{inv.product.sku}</strong> · {inv.product.name}
                    <br /><span style={{ fontSize: '0.72rem' }}>คลัง: {inv.location.code}</span>
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                            📦 จำนวน ({inv.product.unit})
                        </label>
                        <input type="number" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '1rem', fontWeight: 700, textAlign: 'right', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', minHeight: 44 }} />
                        <p style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: 3 }}>เดิม: {formatNumber(inv.quantity, 1)}</p>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                            💰 ต้นทุน/หน่วย (LAK)
                        </label>
                        <input type="number" inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '1rem', fontWeight: 700, textAlign: 'right', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', minHeight: 44 }} />
                        <p style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: 3 }}>เดิม: {fmt(inv.avgCost)}</p>
                    </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>📝 หมายเหตุ</label>
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="เหตุผลที่แก้ไข..."
                        style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', minHeight: 44 }} />
                </div>

                {error && <div style={{ padding: '0.5rem 0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 12, color: '#DC2626', fontSize: '0.8rem' }}>❌ {error}</div>}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} disabled={saving}
                        style={{ padding: '0.6rem 1.2rem', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', minHeight: 44 }}>
                        ยกเลิก
                    </button>
                    <button onClick={handleSave} disabled={saving || !qty}
                        style={{ padding: '0.6rem 1.2rem', border: 'none', borderRadius: 8, background: saving ? '#9CA3AF' : '#E8364E', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', minHeight: 44 }}>
                        {saving ? '⏳ บันทึก...' : '💾 บันทึก'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function InventoryPage() {
    const { fmt } = useCurrency();

    useRoleGuard(['owner', 'manager', 'warehouse'])
    const [inventory, setInventory] = useState<InvItem[]>([])
    const [summary, setSummary] = useState<Record<string, LocationSummary>>({})
    const [locations, setLocations] = useState<{ id: string; code: string; name: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedLoc, setSelectedLoc] = useState('')
    const [lowOnly, setLowOnly] = useState(false)
    const [editItem, setEditItem] = useState<InvItem | null>(null)
    const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    const fetchInventory = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (selectedLoc) params.set('locationId', selectedLoc)
        if (lowOnly) params.set('lowOnly', 'true')
        const res = await fetch(`/api/inventory?${params}`)
        const json = await res.json()
        if (json.success) { setInventory(json.data.inventory); setSummary(json.data.summary) }
        setLoading(false)
    }, [search, selectedLoc, lowOnly])

    useEffect(() => { fetchInventory() }, [fetchInventory])
    useEffect(() => {
        fetch('/api/locations').then(r => r.json()).then(j => j.success && setLocations(j.data))
    }, [])

    const filteredInventory = inventory.filter(inv => {
        if (viewFilter === 'sale') return ['SALE_ITEM', 'ENTERTAIN'].includes(inv.product.productType)
        if (viewFilter === 'raw') return ['RAW_MATERIAL', 'PACKAGING'].includes(inv.product.productType)
        return true
    })

    const totalValue = Object.values(summary).reduce((s, l) => s + l.totalValue, 0)
    const lowCount = filteredInventory.filter(i => i.quantity <= i.product.minQty && i.product.minQty > 0).length

    return (
        <div className="page-container">
            {editItem && (
                <EditModal inv={editItem} onClose={() => setEditItem(null)} onSaved={fetchInventory} />
            )}

            {/* Header */}
            <div style={{
                display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'flex-start',
                justifyContent: 'space-between',
                gap: 12, marginBottom: '1.25rem', paddingBottom: '1rem',
                borderBottom: '2px solid var(--border)',
            }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: isMobile ? '1.2rem' : undefined }}>📦 สต็อคคลังสินค้า</h1>
                    <p className="page-subtitle">
                        มูลค่ารวม <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmt(totalValue)}</span>
                        {lowCount > 0 && <span style={{ marginLeft: 12, color: '#EF4444', fontWeight: 600 }}>⚠️ สต็อคต่ำ {lowCount} รายการ</span>}
                    </p>
                </div>
                <button onClick={fetchInventory} className="btn-secondary" style={{ minHeight: 44, whiteSpace: 'nowrap' }}>🔄 รีเฟรช</button>
            </div>

            {/* Location Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(155px, 1fr))', gap: 8, marginBottom: 16 }}>
                {Object.entries(summary).map(([code, loc]) => {
                    const locId = locations.find(l => l.code === code)?.id || ''
                    const isSelected = selectedLoc === locId
                    return (
                        <div key={code} onClick={() => setSelectedLoc(isSelected ? '' : locId)}
                            className="card" style={{
                                cursor: 'pointer', padding: '0.75rem',
                                border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                                background: isSelected ? 'var(--accent-bg)' : 'var(--white)',
                                transition: 'all 0.18s',
                                boxShadow: isSelected ? '0 0 0 3px rgba(232,54,78,0.12)' : undefined,
                            }}
                        >
                            <p style={{ fontSize: '0.6rem', fontFamily: 'monospace', color: 'var(--accent)', letterSpacing: '0.06em', fontWeight: 700 }}>{code}</p>
                            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{loc.name}</p>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 3 }}>{loc.items} SKU</p>
                            <p style={{ fontSize: isMobile ? '0.78rem' : '0.88rem', fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>{fmt(loc.totalValue)}</p>
                        </div>
                    )
                })}
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 ค้นหาชื่อ, SKU..." className="input" style={{ width: isMobile ? '100%' : 200, minHeight: 40 }} />
                {!isMobile && (
                    <select value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)} className="input" style={{ width: 160, minHeight: 40 }}>
                        <option value="">ทุกคลัง</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                )}

                {/* View filter toggle */}
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 3 }}>
                    {([
                        { key: 'all' as ViewFilter, label: 'ทั้งหมด' },
                        { key: 'sale' as ViewFilter, label: 'สินค้าขาย' },
                        { key: 'raw' as ViewFilter, label: 'วัตถุดิบ' },
                    ]).map(f => (
                        <button key={f.key} onClick={() => setViewFilter(f.key)}
                            style={{
                                padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem',
                                fontWeight: viewFilter === f.key ? 600 : 400,
                                cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                                background: viewFilter === f.key ? 'var(--accent)' : 'transparent',
                                color: viewFilter === f.key ? '#fff' : 'var(--text-secondary)',
                                transition: 'all 0.15s', minHeight: 30,
                            }}
                        >{f.label}</button>
                    ))}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minHeight: 40 }}>
                    <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)}
                        style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>⚠️ สต็อคต่ำ</span>
                </label>
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: 10 }}>
                    <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>กำลังโหลด...</span>
                </div>
            ) : filteredInventory.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: 8 }}>
                    <span style={{ fontSize: '2.5rem' }}>{lowOnly ? '✅' : '📭'}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {lowOnly ? 'ไม่มีสินค้าสต็อคต่ำ' : 'ไม่พบข้อมูลสต็อค'}
                    </span>
                </div>
            ) : isMobile ? (
                /* Mobile: Card list */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredInventory.map(inv => {
                        const isLow = inv.quantity <= inv.product.minQty && inv.product.minQty > 0
                        return (
                            <div key={inv.id} className="card" style={{
                                padding: '0.75rem', display: 'flex', gap: 10, alignItems: 'center',
                                background: isLow ? 'rgba(239,68,68,0.03)' : 'var(--white)',
                                borderColor: isLow ? '#FECACA' : 'var(--border)',
                            }}
                                onClick={() => setEditItem(inv)}
                            >
                                {/* Image */}
                                {inv.product.imageUrl ? (
                                    <img src={inv.product.imageUrl} alt={inv.product.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                                        background: (inv.product.category.color || '#E8364E') + '15',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.3rem',
                                    }}>
                                        {inv.product.category.icon}
                                    </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.product.name}</div>
                                    <div style={{ display: 'flex', gap: 6, fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                        <span style={{ fontFamily: 'monospace' }}>{inv.product.sku}</span>
                                        <span>• {inv.location.code}</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isLow ? '#EF4444' : 'var(--text)' }}>
                                        {formatNumber(inv.quantity, 1)} <span style={{ fontSize: '0.72rem', fontWeight: 400 }}>{inv.product.unit}</span>
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 600, marginTop: 2 }}>{fmt(inv.quantity * inv.avgCost)}</div>
                                    {isLow && <span style={{ fontSize: '0.6rem', color: '#DC2626', fontWeight: 600 }}>⚠️ ต่ำ</span>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* Desktop: Table */
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: 50 }}>รูป</th>
                                <th>SKU</th><th>ชื่อสินค้า</th><th>หมวด</th><th>คลัง</th>
                                <th style={{ textAlign: 'right' }}>คงเหลือ</th><th>หน่วย</th>
                                <th style={{ textAlign: 'right' }}>ต้นทุน/หน่วย</th>
                                <th style={{ textAlign: 'right' }}>มูลค่ารวม</th>
                                <th>สถานะ</th>
                                <th style={{ textAlign: 'center' }}>แก้ไข</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventory.map(inv => {
                                const isLow = inv.quantity <= inv.product.minQty && inv.product.minQty > 0
                                return (
                                    <tr key={inv.id} style={{ background: isLow ? 'rgba(239,68,68,0.03)' : undefined }}>
                                        <td style={{ padding: '6px 8px' }}>
                                            {inv.product.imageUrl ? (
                                                <img src={inv.product.imageUrl} alt={inv.product.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                                            ) : (
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: 8,
                                                    background: (inv.product.category.color || '#E8364E') + '15',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '1.1rem',
                                                }}>
                                                    {inv.product.category.icon}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>{inv.product.sku}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.84rem' }}>{inv.product.name}</td>
                                        <td><span style={{ background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{inv.product.category.icon} {inv.product.category.name}</span></td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{inv.location.code}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: isLow ? '#EF4444' : 'var(--text)', fontSize: '0.95rem' }}>{formatNumber(inv.quantity, 1)}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{inv.product.unit}</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{fmt(inv.avgCost)}</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: '#059669' }}>{fmt(inv.quantity * inv.avgCost)}</td>
                                        <td>{isLow
                                            ? <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>⚠️ ต่ำ</span>
                                            : <span style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>✓ ปกติ</span>}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button onClick={() => setEditItem(inv)}
                                                title="แก้ไขสต็อค"
                                                style={{
                                                    background: 'none', border: '1px solid #E5E7EB', borderRadius: 7,
                                                    padding: '4px 10px', cursor: 'pointer', fontSize: '0.78rem',
                                                    color: '#374151', transition: 'all 0.15s', minHeight: 32, fontFamily: 'inherit',
                                                }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F0FDF4'; (e.currentTarget as HTMLElement).style.borderColor = '#16a34a'; (e.currentTarget as HTMLElement).style.color = '#16a34a' }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.color = '#374151' }}
                                            >
                                                ✏️ แก้
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
