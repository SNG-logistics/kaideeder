'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useCurrency } from '@/context/TenantContext'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────
type Product = { id: string; name: string; sku: string; unit: string }
type Location = { id: string; code: string; name: string }
type RecipeLine = { id?: string; productId: string; product?: Product; quantity: number; unit: string }
type Production = { id: string; producedQty: number; location: Location; preparedById?: string; producedAt: string; note?: string; prepRecipe?: { yieldUnit: string } }
type StockEntry = { qty: number; location: string }
type PrepRecipe = {
    id: string; name: string
    outputProduct: Product; yieldQty: number; yieldUnit: string
    note?: string; isActive: boolean
    lines: RecipeLine[]
    productions: Production[]
    currentStock: StockEntry[]
}

// ─── Catalog Item shape (from /api/items/search-for-bom) ────────
interface CatalogItem {
    inventoryItemId: string; code: string; name: string
    itemRole: string; baseUnit: string; purchaseUnit: string
    hasProduct: boolean; productId: string | null; productSku: string | null
}

const ROLE_COLORS: Record<string, string> = {
    RAW: '#10B981', PREP: '#8B5CF6', SUPPLY: '#F59E0B', SERVICE: '#6B7280',
}

// ─── Catalog Combobox ────────────────────────────────────────────
// Generic combobox that searches Catalog and auto-provisions product
function CatalogCombobox({
    value, onChange, placeholder, roleFilter, style, disabled,
}: {
    value: { productId: string; productName: string; unit: string } | null
    onChange: (v: { productId: string; productName: string; unit: string } | null) => void
    placeholder?: string
    roleFilter?: string[]   // ['RAW','PREP'] etc.
    style?: React.CSSProperties
    disabled?: boolean
}) {
    const [q, setQ] = useState('')
    const [results, setResults] = useState<CatalogItem[]>([])
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [provisioning, setProvisioning] = useState(false)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    function doSearch(query: string) {
        setLoading(true)
        fetch(`/api/items/search-for-bom?q=${encodeURIComponent(query)}&limit=30`)
            .then(r => r.json())
            .then(j => {
                if (j.success) {
                    const items: CatalogItem[] = j.data
                    setResults(roleFilter ? items.filter(i => roleFilter.includes(i.itemRole)) : items)
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }

    function handleQ(val: string) {
        setQ(val)
        setOpen(true)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => doSearch(val), 230)
    }

    // Open → load results
    function handleFocus() {
        setOpen(true)
        if (results.length === 0) doSearch(q)
    }

    // Click outside closes
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    async function selectItem(item: CatalogItem) {
        setOpen(false)
        setQ(item.name)
        if (item.hasProduct && item.productId) {
            onChange({ productId: item.productId, productName: item.name, unit: item.baseUnit })
            return
        }
        // Auto-provision
        setProvisioning(true)
        try {
            const res = await fetch('/api/items/provision-product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inventoryItemId: item.inventoryItemId }),
            })
            const j = await res.json()
            if (j.success) {
                onChange({ productId: j.data.id, productName: j.data.name, unit: j.data.unit })
            }
        } catch { /* silent */ }
        finally { setProvisioning(false) }
    }

    function clear() {
        setQ('')
        onChange(null)
        setOpen(false)
    }

    const displayVal = value ? value.productName : q

    return (
        <div ref={containerRef} style={{ position: 'relative', ...style }}>
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    className="input"
                    placeholder={placeholder || '🧺 ค้นหาจาก Catalog...'}
                    value={provisioning ? '⏳ กำลังสร้าง product...' : displayVal}
                    onChange={e => { handleQ(e.target.value); if (value) onChange(null) }}
                    onFocus={handleFocus}
                    disabled={disabled || provisioning}
                    style={{
                        fontSize: '0.82rem', paddingRight: value ? 28 : undefined,
                        border: value ? '1.5px solid #059669' : undefined,
                        background: value ? 'rgba(5,150,105,0.03)' : undefined,
                    }}
                    autoComplete="off"
                />
                {value && (
                    <button
                        type="button"
                        onClick={clear}
                        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '0.9rem', padding: 2 }}
                    >✕</button>
                )}
            </div>

            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500,
                    background: 'var(--white)', border: '1.5px solid #059669',
                    borderRadius: '0 0 10px 10px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    maxHeight: 280, overflowY: 'auto',
                }}>
                    {loading ? (
                        <div style={{ padding: '0.6rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>⏳ กำลังค้นหา...</div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: '0.6rem 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>ไม่พบรายการ</div>
                    ) : results.map(item => (
                        <div
                            key={item.inventoryItemId}
                            onMouseDown={() => selectItem(item)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                            <span style={{
                                fontSize: '0.55rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                                background: `${ROLE_COLORS[item.itemRole] || '#6B7280'}18`,
                                color: ROLE_COLORS[item.itemRole] || '#6B7280', flexShrink: 0,
                            }}>{item.itemRole}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                                    <span style={{ fontFamily: 'monospace' }}>{item.baseUnit}</span>
                                    {item.hasProduct
                                        ? <span style={{ color: '#059669' }}>✅ พร้อมใช้</span>
                                        : <span style={{ color: '#D97706' }}>⚡ สร้างอัตโนมัติ</span>
                                    }
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const EMPTY_LINE: RecipeLine = { productId: '', quantity: 1, unit: 'กรัม' }

// ─── Main Page ──────────────────────────────────────────────────
export default function PrepRecipesPage() {
    const { fmt } = useCurrency()
    const [recipes, setRecipes] = useState<PrepRecipe[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editRecipe, setEditRecipe] = useState<PrepRecipe | null>(null)
    const [produceModal, setProduceModal] = useState<PrepRecipe | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const fetchAll = useCallback(async () => {
        setLoading(true)
        try {
            const [rRes, lRes] = await Promise.all([
                fetch('/api/prep-recipes'),
                fetch('/api/locations'),
            ])
            const [rJ, lJ] = await Promise.all([rRes.json(), lRes.json()])
            if (rJ.success) setRecipes(rJ.data)
            if (lJ.success) setLocations(lJ.data)
        } catch { toast.error('โหลดข้อมูลไม่ได้') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    async function deleteRecipe(r: PrepRecipe) {
        if (!confirm(`ลบสูตร "${r.name}" ใช่ไหม?`)) return
        const res = await fetch(`/api/prep-recipes/${r.id}`, { method: 'DELETE' })
        const j = await res.json()
        if (j.success) { toast.success('ลบสูตรแล้ว'); fetchAll() }
        else toast.error(j.error)
    }

    const showToast = (m: string, t: 'ok' | 'err' | 'warn') =>
        t === 'ok' ? toast.success(m) : t === 'warn' ? toast(m, { icon: '⚠️' }) : toast.error(m)

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">🧪 สูตรแปรรูป</h1>
                    <p className="page-subtitle">Prep Recipe — วัตถุดิบ → สินค้ากึ่งสำเร็จ (PREP) · ค้นหาจาก Catalog อัตโนมัติ</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={() => { setEditRecipe(null); setShowForm(true) }}>
                        + สร้างสูตรใหม่
                    </button>
                </div>
            </div>

            {/* Catalog Bridge Banner */}
            <div className="info-banner info-banner--purple">
                <span style={{ fontSize: '1.1rem' }}>🧺</span>
                <div><strong>Catalog Bridge:</strong> ค้นหาวัตถุดิบและสินค้า PREP จาก Catalog ได้โดยตรง — ถ้ายังไม่มี Product ระบบจะสร้างให้อัตโนมัติ</div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <RecipeFormModal
                    recipe={editRecipe}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { setShowForm(false); fetchAll() }}
                    showToast={showToast}
                />
            )}

            {/* Produce Modal */}
            {produceModal && (
                <ProduceModal
                    recipe={produceModal}
                    locations={locations}
                    onClose={() => setProduceModal(null)}
                    onSaved={() => { setProduceModal(null); fetchAll() }}
                    showToast={showToast}
                />
            )}

            {/* Recipe List */}
            {loading ? (
                <div className="empty-state">
                    <div className="spinner" />
                    <div className="empty-state__desc">กำลังโหลด...</div>
                </div>
            ) : recipes.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">🧪</div>
                    <div className="empty-state__title">ยังไม่มีสูตรแปรรูป</div>
                    <div className="empty-state__desc">กด <strong>+ สร้างสูตรใหม่</strong> ได้เลย</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {recipes.map(r => (
                        <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            {/* ── Header Row ── */}
                            <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{r.name}</span>
                                        <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                                            ✅ ได้ {r.yieldQty} {r.yieldUnit}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>→ {r.outputProduct.name}</span>
                                        <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>{r.lines.length} วัตถุดิบ</span>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                                        {r.lines.map(l => l.product?.name || '').filter(Boolean).join(' + ')}
                                    </p>
                                    {r.currentStock.length > 0 && (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                                            {r.currentStock.map((s, i) => (
                                                <span key={i} style={{ fontSize: '0.68rem', background: s.qty > 0 ? '#ECFDF5' : '#FEF2F2', color: s.qty > 0 ? '#059669' : '#DC2626', borderRadius: 99, padding: '2px 8px', fontWeight: 600 }}>
                                                    📦 {s.location}: {s.qty.toFixed(1)} {r.yieldUnit}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                    <button className="btn btn-primary btn-sm" onClick={() => setProduceModal(r)}>+ บันทึกการผลิต</button>
                                    <button className="btn btn-secondary btn-icon" onClick={() => { setEditRecipe(r); setShowForm(true) }}>✏️</button>
                                    <button className="btn btn-danger btn-icon" onClick={() => deleteRecipe(r)}>🗑️</button>
                                    <button className="btn btn-ghost btn-icon" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                                        {expandedId === r.id ? '▲' : '▼'}
                                    </button>
                                </div>
                            </div>

                            {/* ── Expanded Detail ── */}
                            {expandedId === r.id && (
                                <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                    <div>
                                        <h4 style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.88rem' }}>🧂 ส่วนผสม (ต่อ {r.yieldQty} {r.yieldUnit})</h4>
                                        <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ color: 'var(--text-secondary)', borderBottom: '2px solid var(--border)' }}>
                                                    <th style={{ textAlign: 'left', paddingBottom: 6, fontWeight: 600 }}>วัตถุดิบ</th>
                                                    <th style={{ textAlign: 'right', paddingBottom: 6, fontWeight: 600 }}>ปริมาณ</th>
                                                    <th style={{ textAlign: 'left', paddingBottom: 6, fontWeight: 600, paddingLeft: 8 }}>หน่วย</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {r.lines.map((line, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '6px 0' }}>{line.product?.name}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{line.quantity}</td>
                                                        <td style={{ paddingLeft: 8, color: 'var(--text-secondary)' }}>{line.unit}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {r.note && <p style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>📝 {r.note}</p>}
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.88rem' }}>📋 ประวัติการผลิต</h4>
                                        {r.productions.length === 0 ? (
                                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>ยังไม่มีประวัติ</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                {r.productions.map(p => (
                                                    <div key={p.id} style={{ display: 'flex', gap: 10, fontSize: '0.75rem', padding: '5px 10px', background: 'var(--bg)', borderRadius: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                        <span style={{ color: 'var(--text-secondary)', minWidth: 90 }}>
                                                            {new Date(p.producedAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <span style={{ fontWeight: 700, color: '#059669' }}>{p.producedQty} {r.yieldUnit}</span>
                                                        <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>{p.location.code}</span>
                                                        {p.note && <span style={{ color: 'var(--text-secondary)' }}>| {p.note}</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Recipe Form Modal (Catalog-powered) ────────────────────────
function RecipeFormModal({ recipe, onClose, onSaved, showToast }: {
    recipe: PrepRecipe | null
    onClose: () => void; onSaved: () => void
    showToast: (m: string, t: 'ok' | 'err' | 'warn') => void
}) {
    const [name, setName] = useState(recipe?.name || '')
    const [yieldQty, setYieldQty] = useState(recipe?.yieldQty || 1)
    const [yieldUnit, setYieldUnit] = useState(recipe?.yieldUnit || 'กรัม')
    const [note, setNote] = useState(recipe?.note || '')
    const [saving, setSaving] = useState(false)

    // Output Product — backed by CatalogCombobox
    const [outputVal, setOutputVal] = useState<{ productId: string; productName: string; unit: string } | null>(
        recipe ? { productId: recipe.outputProduct.id, productName: recipe.outputProduct.name, unit: recipe.outputProduct.unit } : null
    )

    // Ingredient lines — each line has a catalog-resolved productId
    type LineState = {
        productId: string
        productName: string
        unit: string
        quantity: number
        catalogVal: { productId: string; productName: string; unit: string } | null
    }

    const initLines = (): LineState[] => {
        if (recipe && recipe.lines.length > 0) {
            return recipe.lines.map(l => ({
                productId: l.productId || l.product?.id || '',
                productName: l.product?.name || '',
                unit: l.unit,
                quantity: l.quantity,
                catalogVal: l.product ? { productId: l.productId || l.product.id, productName: l.product.name, unit: l.unit } : null,
            }))
        }
        return [{ productId: '', productName: '', unit: 'กรัม', quantity: 1, catalogVal: null }]
    }

    const [lines, setLines] = useState<LineState[]>(initLines)

    function addLine() {
        setLines(p => [...p, { productId: '', productName: '', unit: 'กรัม', quantity: 1, catalogVal: null }])
    }
    function removeLine(i: number) { setLines(p => p.filter((_, idx) => idx !== i)) }
    function updateLineQty(i: number, qty: number) {
        setLines(p => p.map((l, idx) => idx === i ? { ...l, quantity: qty } : l))
    }
    function updateLineUnit(i: number, unit: string) {
        setLines(p => p.map((l, idx) => idx === i ? { ...l, unit } : l))
    }
    function updateLineCatalog(i: number, val: { productId: string; productName: string; unit: string } | null) {
        setLines(p => p.map((l, idx) => idx === i ? {
            ...l,
            catalogVal: val,
            productId: val?.productId ?? '',
            productName: val?.productName ?? '',
            unit: val?.unit ?? l.unit,
        } : l))
    }

    async function save() {
        if (!name.trim()) { showToast('กรุณาระบุชื่อสูตร', 'err'); return }
        if (!outputVal?.productId) { showToast('กรุณาเลือกสินค้าผลผลิต', 'err'); return }
        if (lines.some(l => !l.productId || l.quantity <= 0)) { showToast('ส่วนผสมยังไม่ครบ กรุณาเลือกวัตถุดิบทุกรายการ', 'err'); return }

        setSaving(true)
        try {
            const payload = {
                name: name.trim(),
                outputProductId: outputVal.productId,
                yieldQty,
                yieldUnit,
                note: note || undefined,
                lines: lines.map(l => ({ productId: l.productId, quantity: l.quantity, unit: l.unit })),
            }
            const url = recipe ? `/api/prep-recipes/${recipe.id}` : '/api/prep-recipes'
            const method = recipe ? 'PATCH' : 'POST'
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            const j = await res.json()
            if (j.success) { showToast(recipe ? '✏️ แก้ไขสูตรแล้ว' : '✅ สร้างสูตรแล้ว', 'ok'); onSaved() }
            else showToast(j.error || 'เกิดข้อผิดพลาด', 'err')
        } catch { showToast('เกิดข้อผิดพลาด', 'err') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--card)', borderRadius: 18, padding: '1.5rem', width: '100%', maxWidth: 700, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{recipe ? '✏️ แก้ไขสูตรแปรรูป' : '🧪 สร้างสูตรแปรรูปใหม่'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
                </div>

                {/* Catalog badge */}
                <div style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: '6px 12px', marginBottom: 16, fontSize: '0.72rem', color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🧺 <strong>Catalog Bridge</strong> — ค้นหาวัตถุดิบและสินค้า PREP จาก Catalog ได้โดยตรง Product จะถูกสร้างอัตโนมัติถ้ายังไม่มี
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ชื่อสูตร *</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="เช่น น้ำซุปหมู, หมูหมัก, ซอสพริก" />
                    </div>

                    {/* Output Product via Catalog */}
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                            🧺 สินค้าผลผลิต (PREP) * — ค้นหาจาก Catalog
                        </label>
                        <CatalogCombobox
                            value={outputVal}
                            onChange={v => { setOutputVal(v); if (v && !yieldUnit) setYieldUnit(v.unit) }}
                            placeholder="🔍 ค้นหาสินค้า PREP จาก Catalog..."
                            roleFilter={['PREP']}
                        />
                        {outputVal && (
                            <div style={{ fontSize: '0.68rem', color: '#059669', marginTop: 3 }}>
                                ✅ Product ID: <code style={{ fontFamily: 'monospace' }}>{outputVal.productId.slice(-8)}</code> · หน่วย: {outputVal.unit}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 8 }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Yield qty *</label>
                            <input type="number" min={0.01} step={0.01} value={yieldQty} onChange={e => setYieldQty(+e.target.value)} className="input" />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>หน่วย *</label>
                            <input value={yieldUnit} onChange={e => setYieldUnit(e.target.value)} className="input" placeholder="ลิตร, กก., ชิ้น" />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>หมายเหตุ</label>
                        <textarea value={note} onChange={e => setNote(e.target.value)} className="input" rows={2} placeholder="วิธีทำ, ข้อควรระวัง..." style={{ resize: 'vertical' }} />
                    </div>
                </div>

                {/* Ingredient Lines */}
                <div style={{ borderTop: '2px solid var(--border)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>🧂 ส่วนผสม (ต่อ {yieldQty} {yieldUnit})</h3>
                        <button onClick={addLine} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 12px' }}>+ เพิ่ม</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {lines.map((l, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 32px', gap: 8, alignItems: 'start' }}>
                                {/* Catalog search per line */}
                                <div>
                                    <CatalogCombobox
                                        value={l.catalogVal}
                                        onChange={v => updateLineCatalog(i, v)}
                                        placeholder="🧺 ค้นหาวัตถุดิบ..."
                                        roleFilter={['RAW', 'PREP', 'SUPPLY']}
                                    />
                                    {l.productId && (
                                        <div style={{ fontSize: '0.6rem', color: '#6B7280', marginTop: 2 }}>ID: {l.productId.slice(-8)}</div>
                                    )}
                                </div>
                                <input
                                    type="number" min={0.01} step={0.01} value={l.quantity}
                                    onChange={e => updateLineQty(i, +e.target.value)}
                                    className="input" style={{ textAlign: 'center', fontSize: '0.8rem' }}
                                    placeholder="qty"
                                />
                                <input
                                    value={l.unit} onChange={e => updateLineUnit(i, e.target.value)}
                                    className="input" style={{ fontSize: '0.8rem' }} placeholder="หน่วย"
                                />
                                <button onClick={() => removeLine(i)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '6px 0' }}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <button onClick={onClose} className="btn btn-secondary">ยกเลิก</button>
                    <button onClick={save} className="btn btn-primary" disabled={saving}>
                        {saving ? '⏳ กำลังบันทึก...' : recipe ? '✏️ บันทึก' : '✅ สร้างสูตร'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Produce Modal ───────────────────────────────────────────────
function ProduceModal({ recipe, locations, onClose, onSaved, showToast }: {
    recipe: PrepRecipe; locations: Location[]
    onClose: () => void; onSaved: () => void
    showToast: (m: string, t: 'ok' | 'err' | 'warn') => void
}) {
    const [producedQty, setProducedQty] = useState(recipe.yieldQty)
    const [locationId, setLocationId] = useState(locations[0]?.id || '')
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)

    const ratio = producedQty / recipe.yieldQty

    async function produce() {
        if (!locationId || producedQty <= 0) { showToast('กรอกข้อมูลให้ครบ', 'err'); return }
        setSaving(true)
        try {
            const res = await fetch(`/api/prep-recipes/${recipe.id}/produce`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ producedQty, locationId, note: note || undefined }),
            })
            const j = await res.json()
            if (j.success) {
                showToast(j.data.message + (j.data.warnings ? '\n' + j.data.warnings.join('\n') : ''), j.data.warnings ? 'warn' : 'ok')
                onSaved()
            } else showToast(j.error || 'เกิดข้อผิดพลาด', 'err')
        } catch { showToast('เกิดข้อผิดพลาด', 'err') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--card)', borderRadius: 18, padding: '1.5rem', width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 800, fontSize: '1.05rem' }}>🍲 บันทึกการผลิต</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
                </div>

                {/* Recipe summary */}
                <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '0.875rem 1rem', marginBottom: 16, fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>🧪 สูตร: {recipe.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                        วัตถุดิบ: {recipe.lines.map(l => `${l.product?.name} ${l.quantity} ${l.unit}`).join(' + ')}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            ทำได้ ({recipe.yieldUnit}) *
                        </label>
                        <input type="number" min={0.01} step={0.01}
                            value={producedQty} onChange={e => setProducedQty(+e.target.value)}
                            className="input" style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}
                        />
                    </div>

                    {/* Ingredient preview */}
                    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '0.75rem', fontSize: '0.78rem' }}>
                        <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>วัตถุดิบที่จะถูกตัด (ratio = {ratio.toFixed(2)}×):</p>
                        {recipe.lines.map((l, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                                <span>{l.product?.name}</span>
                                <span style={{ fontWeight: 600, color: '#DC2626' }}>- {(l.quantity * ratio).toFixed(2)} {l.unit}</span>
                            </div>
                        ))}
                        <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span style={{ color: '#059669' }}>+ {recipe.outputProduct.name}</span>
                            <span style={{ color: '#059669' }}>+{producedQty} {recipe.yieldUnit}</span>
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>เก็บไว้คลัง *</label>
                        <select value={locationId} onChange={e => setLocationId(e.target.value)} className="input">
                            {locations.map(l => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>หมายเหตุ</label>
                        <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="ไม่บังคับ" />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <button onClick={onClose} className="btn btn-secondary">ยกเลิก</button>
                    <button onClick={produce} className="btn btn-primary" disabled={saving} style={{ fontWeight: 700 }}>
                        {saving ? '⏳ กำลังบันทึก...' : '✅ บันทึกการผลิต'}
                    </button>
                </div>
            </div>
        </div>
    )
}
