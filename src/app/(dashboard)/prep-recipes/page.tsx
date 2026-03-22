'use client'
import { useEffect, useState, useCallback } from 'react'
import { useCurrency } from '@/context/TenantContext'

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

const EMPTY_LINE: RecipeLine = { productId: '', quantity: 1, unit: 'กรัม' }

// ─── Main Page ──────────────────────────────────────────────────
export default function PrepRecipesPage() {
    const { fmt } = useCurrency()
    const [recipes, setRecipes] = useState<PrepRecipe[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editRecipe, setEditRecipe] = useState<PrepRecipe | null>(null)
    const [produceModal, setProduceModal] = useState<PrepRecipe | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | 'warn' } | null>(null)

    const fetchAll = useCallback(async () => {
        setLoading(true)
        try {
            const [rRes, pRes, lRes] = await Promise.all([
                fetch('/api/prep-recipes'),
                fetch('/api/products'),
                fetch('/api/locations'),
            ])
            const [rJ, pJ, lJ] = await Promise.all([rRes.json(), pRes.json(), lRes.json()])
            if (rJ.success) setRecipes(rJ.data)
            if (pJ.success) setProducts(Array.isArray(pJ.data) ? pJ.data : (pJ.data.products ?? []))
            if (lJ.success) setLocations(lJ.data)
        } catch { showToast('โหลดข้อมูลไม่ได้', 'err') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    function showToast(msg: string, type: 'ok' | 'err' | 'warn') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 5000)
    }

    async function deleteRecipe(r: PrepRecipe) {
        if (!confirm(`ลบสูตร "${r.name}" ใช่ไหม?`)) return
        const res = await fetch(`/api/prep-recipes/${r.id}`, { method: 'DELETE' })
        const j = await res.json()
        if (j.success) { showToast('ลบสูตรแล้ว', 'ok'); fetchAll() }
        else showToast(j.error, 'err')
    }

    return (
        <div className="page-container">

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 16, right: 16, zIndex: 9999,
                    background: toast.type === 'ok' ? '#ECFDF5' : toast.type === 'warn' ? '#FFFBEB' : '#FEF2F2',
                    border: `1px solid ${toast.type === 'ok' ? '#A7F3D0' : toast.type === 'warn' ? '#FDE68A' : '#FECACA'}`,
                    color: toast.type === 'ok' ? '#059669' : toast.type === 'warn' ? '#D97706' : '#DC2626',
                    borderRadius: 12, padding: '12px 20px', fontWeight: 500, fontSize: '0.85rem',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxWidth: 420, whiteSpace: 'pre-line',
                }}>
                    {toast.type === 'ok' ? '✅' : toast.type === 'warn' ? '⚠️' : '❌'} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, borderBottom: '2px solid var(--border)', paddingBottom: 16 }}>
                <div>
                    <h1 className="page-title">🧪 สูตรแปรรูป</h1>
                    <p className="page-subtitle">Prep Recipe — วัตถุดิบดิบ → สินค้ากึ่งสำเร็จ (PREP)</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditRecipe(null); setShowForm(true) }}>
                    + สร้างสูตรใหม่
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <RecipeFormModal
                    recipe={editRecipe}
                    products={products}
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
                <div style={{ textAlign: 'center', paddingTop: 64, color: 'var(--text-secondary)' }}>โหลด...</div>
            ) : recipes.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 64, color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>🧪</div>
                    <p>ยังไม่มีสูตรแปรรูป — กด <b>+ สร้างสูตรใหม่</b> ได้เลย</p>
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
                                    {/* Ingredient preview */}
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                                        {r.lines.map(l => l.product?.name || '').filter(Boolean).join(' + ')}
                                    </p>
                                    {/* Stock badges */}
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
                                    <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                                        onClick={() => setProduceModal(r)}>
                                        + บันทึกการผลิต
                                    </button>
                                    <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                                        onClick={() => { setEditRecipe(r); setShowForm(true) }}>✏️</button>
                                    <button className="btn" style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                                        onClick={() => deleteRecipe(r)}>🗑️</button>
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem' }}
                                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                                        {expandedId === r.id ? '▲' : '▼'}
                                    </button>
                                </div>
                            </div>

                            {/* ── Expanded Detail ── */}
                            {expandedId === r.id && (
                                <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                    {/* Ingredients table */}
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

                                    {/* Production history */}
                                    <div>
                                        <h4 style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.88rem' }}>📋 ประวัติการผลิต</h4>
                                        {r.productions.length === 0 ? (
                                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>ยังไม่มีประวัติ</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                                {r.productions.map(p => (
                                                    <div key={p.id} style={{ display: 'flex', gap: 10, fontSize: '0.75rem', padding: '5px 10px', background: 'var(--surface)', borderRadius: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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

// ─── Recipe Form Modal ───────────────────────────────────────────
function RecipeFormModal({ recipe, products, onClose, onSaved, showToast }: {
    recipe: PrepRecipe | null; products: Product[]
    onClose: () => void; onSaved: () => void
    showToast: (m: string, t: 'ok' | 'err' | 'warn') => void
}) {
    const [name, setName] = useState(recipe?.name || '')
    const [outputProductId, setOutputProductId] = useState(recipe?.outputProduct.id || '')
    const [yieldQty, setYieldQty] = useState(recipe?.yieldQty || 1)
    const [yieldUnit, setYieldUnit] = useState(recipe?.yieldUnit || 'กรัม')
    const [note, setNote] = useState(recipe?.note || '')
    const [lines, setLines] = useState<RecipeLine[]>(
        recipe?.lines.map(l => ({ productId: l.productId || l.product?.id || '', quantity: l.quantity, unit: l.unit }))
        || [{ ...EMPTY_LINE }]
    )
    const [saving, setSaving] = useState(false)

    function addLine() { setLines(p => [...p, { ...EMPTY_LINE }]) }
    function removeLine(i: number) { setLines(p => p.filter((_, idx) => idx !== i)) }
    function updateLine(i: number, field: keyof RecipeLine, val: any) {
        setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
    }

    async function save() {
        if (!name || !outputProductId || lines.length === 0) { showToast('กรอกข้อมูลให้ครบ', 'err'); return }
        if (lines.some(l => !l.productId || l.quantity <= 0)) { showToast('ส่วนผสมไม่ครบ', 'err'); return }
        setSaving(true)
        try {
            const payload = { name, outputProductId, yieldQty, yieldUnit, note: note || undefined, lines }
            const url = recipe ? `/api/prep-recipes/${recipe.id}` : '/api/prep-recipes'
            const method = recipe ? 'PATCH' : 'POST'
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            const j = await res.json()
            if (j.success) { showToast(recipe ? '✏️ แก้ไขสูตรแล้ว' : '✅ สร้างสูตรแล้ว', 'ok'); onSaved() }
            else showToast(j.error || 'เกิดข้อผิดพลาด', 'err')
        } catch { showToast('เกิดข้อผิดพลาด', 'err') }
        finally { setSaving(false) }
    }

    // Filter PREP products for output
    const prepProducts = products.filter(p => (p as any).productType === 'PREP' || true) // show all, server validates

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--card)', borderRadius: 18, padding: '1.5rem', width: '100%', maxWidth: 700, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{recipe ? '✏️ แก้ไขสูตรแปรรูป' : '🧪 สร้างสูตรแปรรูปใหม่'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ชื่อสูตร *</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="เช่น น้ำซุปหมู, หมูหมัก, ซอสพริก" />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>สินค้าผลผลิต (PREP) *</label>
                        <select value={outputProductId} onChange={e => setOutputProductId(e.target.value)} className="input">
                            <option value="">-- เลือกสินค้า --</option>
                            {prepProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </select>
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
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>หมายเหตุ</label>
                        <textarea value={note} onChange={e => setNote(e.target.value)} className="input" rows={2} placeholder="วิธีทำ, ข้อควรระวัง..." style={{ resize: 'vertical' }} />
                    </div>
                </div>

                {/* Lines */}
                <div style={{ borderTop: '2px solid var(--border)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>🧂 ส่วนผสม (ต่อ {yieldQty} {yieldUnit})</h3>
                        <button onClick={addLine} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 12px' }}>+ เพิ่ม</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {lines.map((l, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 32px', gap: 8, alignItems: 'center' }}>
                                <select value={l.productId} onChange={e => updateLine(i, 'productId', e.target.value)} className="input" style={{ fontSize: '0.8rem' }}>
                                    <option value="">-- วัตถุดิบ --</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <input type="number" min={0.01} step={0.01} value={l.quantity}
                                    onChange={e => updateLine(i, 'quantity', +e.target.value)}
                                    className="input" style={{ textAlign: 'center', fontSize: '0.8rem' }} />
                                <input value={l.unit} onChange={e => updateLine(i, 'unit', e.target.value)}
                                    className="input" style={{ fontSize: '0.8rem' }} placeholder="หน่วย" />
                                <button onClick={() => removeLine(i)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '4px 0' }}>✕</button>
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
