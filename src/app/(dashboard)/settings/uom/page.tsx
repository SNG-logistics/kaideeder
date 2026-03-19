'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Product {
    id: string
    sku: string
    name: string
    unit: string
    productType: string
    category: { name: string; icon: string; color?: string }
}

interface UomConversion {
    id: string
    productId: string
    fromUnit: string
    toUnit: string
    factor: number
    isDefault: boolean
    note?: string | null
    product: { id: string; name: string; sku: string; unit: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// Common unit presets
// ─────────────────────────────────────────────────────────────────────────────
const UNIT_PRESETS = ['กรัม', 'กิโลกรัม', 'มล.', 'ลิตร', 'ชิ้น', 'ถุง', 'โหล', 'แพ็ค', 'ขวด', 'กล่อง', 'ถัง', 'แท่ง', 'มัด', 'ลัง']

// ─────────────────────────────────────────────────────────────────────────────
// Add/Edit Conversion Modal
// ─────────────────────────────────────────────────────────────────────────────
function ConversionModal({
    product, existing, onClose, onSaved,
}: {
    product: Product
    existing?: UomConversion
    onClose: () => void
    onSaved: () => void
}) {
    const [fromUnit, setFromUnit] = useState(existing?.fromUnit ?? '')
    const [toUnit, setToUnit] = useState(existing?.toUnit ?? product.unit)
    const [factor, setFactor] = useState(String(existing?.factor ?? ''))
    const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false)
    const [note, setNote] = useState(existing?.note ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    async function handleSave() {
        setError('')
        const f = parseFloat(factor)
        if (!fromUnit.trim()) return setError('กรุณากรอกหน่วยต้นทาง')
        if (!toUnit.trim()) return setError('กรุณากรอกหน่วยปลายทาง')
        if (!f || f <= 0) return setError('Factor ต้องมากกว่า 0')
        if (fromUnit.trim() === toUnit.trim()) return setError('หน่วยต้องต่างกัน')

        setSaving(true)
        try {
            let res
            if (existing) {
                res = await fetch(`/api/uom-conversion/${existing.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fromUnit: fromUnit.trim(), toUnit: toUnit.trim(), factor: f, isDefault, note: note || null }),
                })
            } else {
                res = await fetch('/api/uom-conversion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: product.id, fromUnit: fromUnit.trim(), toUnit: toUnit.trim(), factor: f, isDefault, note: note || null }),
                })
            }
            const json = await res.json()
            if (json.success) {
                toast.success(existing ? '✅ แก้ไขสำเร็จ' : '✅ เพิ่มหน่วยแปลงแล้ว')
                onSaved()
                onClose()
            } else setError(json.error ?? 'เกิดข้อผิดพลาด')
        } catch { setError('ไม่สามารถเชื่อมต่อได้') }
        finally { setSaving(false) }
    }

    // คำนวณ preview
    const factorNum = parseFloat(factor)
    const previewText = factorNum > 0 && fromUnit && toUnit
        ? `1 ${fromUnit} = ${factorNum} ${toUnit} | 1 ${toUnit} = ${(1 / factorNum).toFixed(4)} ${fromUnit}`
        : null

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                            {existing ? '✏️ แก้ไขหน่วยแปลง' : '➕ เพิ่มหน่วยแปลง'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
                            <strong>{product.name}</strong> <span style={{ fontFamily: 'monospace', color: '#7C3AED' }}>{product.sku}</span>
                            {' · '}หน่วยหลัก: <strong>{product.unit}</strong>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* From/To units */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'end' }}>
                        <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                                🛒 หน่วยที่ซื้อ / นับเข้า (fromUnit)
                            </label>
                            <input list="unit-list-from" value={fromUnit} onChange={e => setFromUnit(e.target.value)}
                                placeholder="เช่น ถุง, โหล, แพ็ค"
                                style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            />
                            <datalist id="unit-list-from">{UNIT_PRESETS.map(u => <option key={u} value={u} />)}</datalist>
                        </div>
                        <div style={{ paddingBottom: 6, fontSize: '1.3rem', color: 'var(--text-muted)', textAlign: 'center' }}>→</div>
                        <div>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                                📦 หน่วยที่ใช้ใน BOM (toUnit)
                            </label>
                            <input list="unit-list-to" value={toUnit} onChange={e => setToUnit(e.target.value)}
                                placeholder={`เช่น ${product.unit}`}
                                style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            />
                            <datalist id="unit-list-to">{UNIT_PRESETS.map(u => <option key={u} value={u} />)}</datalist>
                        </div>
                    </div>

                    {/* Factor */}
                    <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                            ✖️ Factor (1 {fromUnit || 'fromUnit'} = ? {toUnit || 'toUnit'})
                        </label>
                        <input type="number" inputMode="decimal" value={factor} onChange={e => setFactor(e.target.value)}
                            placeholder="เช่น 1000 (1 ถุง = 1000 กรัม)"
                            style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: '1.1rem', fontWeight: 700, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', textAlign: 'right' }}
                        />
                    </div>

                    {/* Preview */}
                    {previewText && (
                        <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 10, padding: '0.65rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: '#2563EB', fontFamily: 'monospace' }}>
                            🔄 {previewText}
                        </div>
                    )}

                    {/* Note */}
                    <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>📝 หมายเหตุ</label>
                        <input value={note} onChange={e => setNote(e.target.value)} placeholder="เช่น ถุง 1 กก. จาก Supplier A"
                            style={{ width: '100%', padding: '0.55rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>

                    {/* Default toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '0.65rem 0.85rem', borderRadius: 10, background: isDefault ? 'rgba(5,150,105,0.06)' : 'var(--bg)', border: `1.5px solid ${isDefault ? 'rgba(5,150,105,0.3)' : 'var(--border)'}`, transition: 'all 0.15s' }}>
                        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)}
                            style={{ accentColor: '#059669', width: 16, height: 16 }} />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isDefault ? '#059669' : 'var(--text)' }}>⭐ ใช้เป็นค่าเริ่มต้น</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ระบบจะเลือก conversion นี้ก่อนเมื่อแปลงหน่วยอัตโนมัติ</div>
                        </div>
                    </label>

                    {error && (
                        <div style={{ padding: '0.5rem 0.85rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: '0.82rem' }}>
                            ❌ {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '0.9rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                        ยกเลิก
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        style={{ flex: 2, padding: '0.6rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563EB,#3B82F6)', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                        {saving ? '⏳ กำลังบันทึก...' : existing ? '💾 บันทึกการแก้ไข' : '➕ เพิ่มหน่วยแปลง'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion row card per product
// ─────────────────────────────────────────────────────────────────────────────
function ProductConvCard({
    product, conversions, onAdd, onEdit, onDelete,
}: {
    product: Product
    conversions: UomConversion[]
    onAdd: (p: Product) => void
    onEdit: (conv: UomConversion, p: Product) => void
    onDelete: (id: string) => void
}) {
    const [expanded, setExpanded] = useState(true)
    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: conversions.length === 0 ? '1.5px dashed var(--border)' : '1px solid var(--border)' }}>
            {/* Product header */}
            <div onClick={() => setExpanded(e => !e)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1rem',
                cursor: 'pointer', background: 'var(--bg)', borderBottom: expanded ? '1px solid var(--border)' : 'none',
                transition: 'background 0.12s',
            }}>
                <span style={{ fontSize: '1.1rem' }}>{product.category.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{product.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#7C3AED', marginLeft: 6 }}>{product.sku}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>· หน่วยหลัก: <strong>{product.unit}</strong></span>
                </div>
                <span style={{
                    padding: '2px 10px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700,
                    background: conversions.length > 0 ? 'rgba(37,99,235,0.1)' : 'var(--bg)',
                    color: conversions.length > 0 ? '#2563EB' : 'var(--text-muted)',
                    border: '1px solid ' + (conversions.length > 0 ? 'rgba(37,99,235,0.2)' : 'var(--border)'),
                }}>
                    {conversions.length} กฎ
                </span>
                <button onClick={e => { e.stopPropagation(); onAdd(product) }}
                    style={{ padding: '0.3rem 0.7rem', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#2563EB,#3B82F6)', color: '#fff', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    + เพิ่ม
                </button>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            </div>

            {/* Conversion rules */}
            {expanded && (
                <div>
                    {conversions.length === 0 ? (
                        <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>🔄</div>
                            ยังไม่มีกฎหน่วยแปลง — เพิ่มเพื่อให้ระบบแปลงหน่วยได้อัตโนมัติ
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                        {['หน่วยต้นทาง', '', 'หน่วยปลายทาง', 'Factor', 'Reverse', 'ค่าเริ่มต้น', 'หมายเหตุ', ''].map((h, i) => (
                                            <th key={i} style={{ padding: '0.5rem 0.85rem', textAlign: h === 'Factor' || h === 'Reverse' ? 'right' : 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {conversions.map((c, i) => (
                                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? 'var(--white)' : 'rgba(248,250,252,0.6)' }}>
                                            <td style={{ padding: '0.6rem 0.85rem' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2563EB' }}>{c.fromUnit}</span>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.4rem', color: 'var(--text-muted)' }}>→</td>
                                            <td style={{ padding: '0.6rem 0.85rem' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#059669' }}>{c.toUnit}</span>
                                            </td>
                                            <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                                {c.factor.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                {(1 / c.factor).toFixed(4)}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.85rem' }}>
                                                {c.isDefault
                                                    ? <span style={{ background: 'rgba(5,150,105,0.1)', color: '#059669', padding: '2px 8px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700 }}>⭐ Default</span>
                                                    : <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.75rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {c.note || '—'}
                                            </td>
                                            <td style={{ padding: '0.6rem 0.85rem' }}>
                                                <div style={{ display: 'flex', gap: 5 }}>
                                                    <button onClick={() => onEdit(c, product)}
                                                        style={{ padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--white)', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                        ✏️
                                                    </button>
                                                    <button onClick={() => onDelete(c.id)}
                                                        style={{ padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function UomSettingsPage() {
    useRoleGuard(['owner', 'manager'])

    const [products, setProducts] = useState<Product[]>([])
    const [conversions, setConversions] = useState<UomConversion[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showNoConvOnly, setShowNoConvOnly] = useState(false)
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'RAW_MATERIAL' | 'PACKAGING' | 'PREP'>('RAW_MATERIAL')
    const [modal, setModal] = useState<{ product: Product; existing?: UomConversion } | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [pRes, cRes] = await Promise.all([
                fetch(`/api/products?limit=200&productType=${typeFilter === 'ALL' ? '' : typeFilter}`),
                fetch('/api/uom-conversion'),
            ])
            const [pJson, cJson] = await Promise.all([pRes.json(), cRes.json()])
            if (pJson.success) setProducts(pJson.data.products)
            if (cJson.success) setConversions(cJson.data)
        } catch { toast.error('โหลดข้อมูลไม่สำเร็จ') }
        finally { setLoading(false) }
    }, [typeFilter])

    useEffect(() => { load() }, [load])

    async function handleDelete(id: string) {
        if (!confirm('ลบกฎหน่วยแปลงนี้?')) return
        try {
            const res = await fetch(`/api/uom-conversion/${id}`, { method: 'DELETE' })
            const json = await res.json()
            if (json.success) { toast.success('🗑️ ลบแล้ว'); load() }
            else toast.error(json.error ?? 'เกิดข้อผิดพลาด')
        } catch { toast.error('เกิดข้อผิดพลาด') }
    }

    // Group conversions by productId
    const convByProduct = conversions.reduce<Record<string, UomConversion[]>>((acc, c) => {
        if (!acc[c.productId]) acc[c.productId] = []
        acc[c.productId].push(c)
        return acc
    }, {})

    // Filter products
    const filteredProducts = products.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
        const matchNoConv = !showNoConvOnly || !convByProduct[p.id]?.length
        return matchSearch && matchNoConv
    })

    const totalConvCount = conversions.length
    const noConvCount = products.filter(p => !convByProduct[p.id]?.length).length

    const TYPE_TABS = [
        { key: 'RAW_MATERIAL' as const, label: 'วัตถุดิบ', icon: '🥩' },
        { key: 'PACKAGING' as const, label: 'บรรจุภัณฑ์', icon: '📦' },
        { key: 'PREP' as const, label: 'ของเตรียม', icon: '🍲' },
        { key: 'ALL' as const, label: 'ทั้งหมด', icon: '📋' },
    ]

    return (
        <div className="page-container">
            {modal && (
                <ConversionModal
                    product={modal.product}
                    existing={modal.existing}
                    onClose={() => setModal(null)}
                    onSaved={load}
                />
            )}

            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">⚙️ UOM Conversion Settings</h1>
                    <p className="page-subtitle">
                        ตั้งค่าหน่วยแปลงสำหรับวัตถุดิบ — ใช้เมื่อหน่วยซื้อ ≠ หน่วยใน BOM
                        <span style={{ marginLeft: 10, color: '#2563EB', fontWeight: 700 }}>{totalConvCount} กฎทั้งหมด</span>
                        {noConvCount > 0 && <span style={{ marginLeft: 10, color: '#DC2626', fontWeight: 700 }}>⚠️ {noConvCount} วัตถุดิบยังไม่มีกฎ</span>}
                    </p>
                </div>
                <button onClick={load} className="btn btn-outline btn-sm">🔄 รีโหลด</button>
            </div>

            {/* How it works banner */}
            <div style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>💡</span>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e40af', marginBottom: 4 }}>วิธีใช้ UOM Conversion</div>
                    <div style={{ fontSize: '0.78rem', color: '#3b82f6', lineHeight: 1.6 }}>
                        เมื่อ BOM กำหนดว่า "เมนูหมูแดง ใช้หมูหมัก 200 กรัม" แต่รับสินค้าเป็น "ถุง (1 กก.)" →
                        ตั้งกฎ <strong>1 ถุง = 1000 กรัม</strong> ระบบจะแปลงโดยอัตโนมัติเมื่อตัดสต็อค
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Type tabs */}
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 10, padding: 3 }}>
                    {TYPE_TABS.map(t => (
                        <button key={t.key} onClick={() => setTypeFilter(t.key)}
                            style={{
                                padding: '0.35rem 0.75rem', borderRadius: 8, border: 'none',
                                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                                background: typeFilter === t.key ? 'var(--accent)' : 'transparent',
                                color: typeFilter === t.key ? '#fff' : 'var(--text-muted)',
                                transition: 'all 0.15s',
                            }}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 ค้นหาชื่อ / SKU..."
                    style={{ padding: '0.45rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', minWidth: 200 }}
                />

                {/* No conv filter */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={showNoConvOnly} onChange={e => setShowNoConvOnly(e.target.checked)}
                        style={{ accentColor: '#DC2626', width: 15, height: 15 }} />
                    <span style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 600 }}>⚠️ ยังไม่มีกฎเท่านั้น</span>
                </label>

                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {filteredProducts.length} วัตถุดิบ
                </span>
            </div>

            {/* Product list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                    กำลังโหลด...
                </div>
            ) : filteredProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔍</div>
                    <p style={{ fontWeight: 600 }}>ไม่พบวัตถุดิบ</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredProducts.map(p => (
                        <ProductConvCard
                            key={p.id}
                            product={p}
                            conversions={convByProduct[p.id] ?? []}
                            onAdd={prod => setModal({ product: prod })}
                            onEdit={(conv, prod) => setModal({ product: prod, existing: conv })}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
