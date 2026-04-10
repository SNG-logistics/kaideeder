'use client'
import { useEffect, useState, useCallback } from 'react'
import { useCurrency } from '@/context/TenantContext'

// ─── Types ───────────────────────────────────────────────────────
interface Product { id: string; name: string; sku: string; unit: string }
interface Location { id: string; code: string; name: string }
interface Ingredient {
    id?: string
    productId: string
    product?: Product
    quantity: number
    unit: string
    locationId: string
    location?: Location
}
interface PrepRecipe {
    id: string
    name: string
    outputProduct: Product
    outputQty: number
    outputUnit: string
    outputLocation: Location
    note?: string
    isActive: boolean
    ingredients: Ingredient[]
    batches: { id: string; batchQty: number; outputTotal: number; status: string; note?: string; createdAt: string }[]
}

const EMPTY_ING: Ingredient = { productId: '', quantity: 1, unit: 'กรัม', locationId: '' }

// ─── Main Page ──────────────────────────────────────────────────
export default function PrepRecipePage() {
    const { fmt } = useCurrency()
    const [recipes, setRecipes] = useState<PrepRecipe[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editRecipe, setEditRecipe] = useState<PrepRecipe | null>(null)
    const [executing, setExecuting] = useState<string | null>(null)
    const [execQty, setExecQty] = useState<Record<string, number>>({})
    const [execNote, setExecNote] = useState<Record<string, string>>({})
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | 'warn' } | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    // ─── Fetch ───────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true)
        try {
            const [rRes, pRes, lRes] = await Promise.all([
                fetch('/api/prep-recipes'),
                fetch('/api/products'),
                fetch('/api/locations'),
            ])
            const [rJson, pJson, lJson] = await Promise.all([rRes.json(), pRes.json(), lRes.json()])
            if (rJson.success) setRecipes(rJson.data)
            if (pJson.success) setProducts(pJson.data)
            if (lJson.success) setLocations(lJson.data)
        } catch { showToast('โหลดข้อมูลไม่ได้', 'err') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    function showToast(msg: string, type: 'ok' | 'err' | 'warn') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 4500)
    }

    // ─── Execute batch ───────────────────────────────────────────
    async function executeBatch(recipe: PrepRecipe) {
        const qty = execQty[recipe.id] || 1
        setExecuting(recipe.id)
        try {
            const res = await fetch(`/api/prep-recipes/${recipe.id}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batchQty: qty, note: execNote[recipe.id] }),
            })
            const json = await res.json()
            if (json.success) {
                showToast(json.data.message, json.data.warnings ? 'warn' : 'ok')
                await fetchAll()
                setExecQty(prev => ({ ...prev, [recipe.id]: 1 }))
                setExecNote(prev => ({ ...prev, [recipe.id]: '' }))
            } else {
                showToast(json.error || 'เกิดข้อผิดพลาด', 'err')
            }
        } catch { showToast('เกิดข้อผิดพลาด', 'err') }
        finally { setExecuting(null) }
    }

    // ─── Delete ──────────────────────────────────────────────────
    async function deleteRecipe(recipe: PrepRecipe) {
        if (!confirm(`ลบสูตร "${recipe.name}" ใช่ไหม?`)) return
        const res = await fetch(`/api/prep-recipes/${recipe.id}`, { method: 'DELETE' })
        const json = await res.json()
        if (json.success) { showToast('ลบสูตรแล้ว', 'ok'); fetchAll() }
        else showToast(json.error, 'err')
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
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxWidth: 380, whiteSpace: 'pre-line',
                }}>
                    {toast.type === 'ok' ? '✅' : toast.type === 'warn' ? '⚠️' : '❌'} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, borderBottom: '2px solid var(--border)', paddingBottom: 16 }}>
                <div>
                    <h1 className="page-title">🧪 สูตรแปรรูป</h1>
                    <p className="page-subtitle">Prep Recipe — แปลงวัตถุดิบดิบ → ของกึ่งสำเร็จ</p>
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
                    locations={locations}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { setShowForm(false); fetchAll() }}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {recipes.map(r => (
                        <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            {/* Header row */}
                            <div
                                style={{ padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, borderBottom: expandedId === r.id ? '1px solid var(--border)' : 'none' }}
                                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{r.name}</span>
                                        <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                                            ✅ ผลผลิต {r.outputQty} {r.outputUnit}
                                        </span>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            → {r.outputProduct.name}
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                            | {r.ingredients.length} ส่วนผสม
                                        </span>
                                    </div>
                                    {r.note && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{r.note}</p>}
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                    <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                        onClick={e => { e.stopPropagation(); setEditRecipe(r); setShowForm(true) }}>✏️</button>
                                    <button className="btn" style={{ fontSize: '0.75rem', padding: '4px 10px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                                        onClick={e => { e.stopPropagation(); deleteRecipe(r) }}>🗑️</button>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                                        {expandedId === r.id ? '▲' : '▼'}
                                    </span>
                                </div>
                            </div>

                            {/* Expanded detail */}
                            {expandedId === r.id && (
                                <div style={{ padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                    {/* Left: Ingredients */}
                                    <div>
                                        <h4 style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.85rem' }}>🧂 ส่วนผสม (ต่อ 1 batch)</h4>
                                        <table style={{ width: '100%', fontSize: '0.82rem' }}>
                                            <thead>
                                                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                                                    <th style={{ textAlign: 'left', paddingBottom: 6 }}>วัตถุดิบ</th>
                                                    <th style={{ textAlign: 'right', paddingBottom: 6 }}>ปริมาณ</th>
                                                    <th style={{ textAlign: 'left', paddingBottom: 6, paddingLeft: 8 }}>คลัง</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {r.ingredients.map((ing, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '5px 0' }}>{ing.product?.name}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{ing.quantity} {ing.unit}</td>
                                                        <td style={{ paddingLeft: 8, color: 'var(--text-secondary)' }}>{ing.location?.code}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {/* Output */}
                                        <div style={{ marginTop: 10, padding: '8px 12px', background: '#ECFDF5', borderRadius: 8, fontSize: '0.82rem' }}>
                                            ✅ ได้ <b>{r.outputQty} {r.outputUnit}</b> {r.outputProduct.name} → คลัง {r.outputLocation?.code ?? '?'}
                                        </div>
                                    </div>

                                    {/* Right: Execute + History */}
                                    <div>
                                        <h4 style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.85rem' }}>▶️ รัน Batch</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>จำนวน batch:</label>
                                                <input
                                                    type="number" min={0.1} step={0.5}
                                                    value={execQty[r.id] ?? 1}
                                                    onChange={e => setExecQty(prev => ({ ...prev, [r.id]: +e.target.value }))}
                                                    className="input" style={{ width: 80, textAlign: 'center' }}
                                                />
                                                <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>
                                                    → {((execQty[r.id] ?? 1) * r.outputQty).toFixed(1)} {r.outputUnit}
                                                </span>
                                            </div>
                                            <input
                                                placeholder="หมายเหตุ (ไม่บังคับ)"
                                                value={execNote[r.id] ?? ''}
                                                onChange={e => setExecNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                                                className="input" style={{ fontSize: '0.82rem' }}
                                            />
                                            <button
                                                className="btn btn-primary"
                                                disabled={executing === r.id}
                                                onClick={() => executeBatch(r)}
                                                style={{ fontWeight: 700 }}
                                            >
                                                {executing === r.id ? '⏳ กำลังรัน...' : '▶️ รันแปรรูป'}
                                            </button>
                                        </div>

                                        {/* Batch history */}
                                        {r.batches.length > 0 && (
                                            <div style={{ marginTop: 14 }}>
                                                <h4 style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>ประวัติ (5 ครั้งล่าสุด)</h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {r.batches.map(b => (
                                                        <div key={b.id} style={{ display: 'flex', gap: 8, fontSize: '0.75rem', padding: '4px 8px', background: 'var(--surface)', borderRadius: 6 }}>
                                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                                {new Date(b.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            <span>× {b.batchQty} batch</span>
                                                            <span style={{ fontWeight: 600, color: '#059669' }}>= {b.outputTotal} {r.outputUnit}</span>
                                                            {b.note && <span style={{ color: 'var(--text-secondary)' }}>| {b.note}</span>}
                                                        </div>
                                                    ))}
                                                </div>
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
function RecipeFormModal({ recipe, products, locations, onClose, onSaved, showToast }: {
    recipe: PrepRecipe | null
    products: Product[]
    locations: Location[]
    onClose: () => void
    onSaved: () => void
    showToast: (msg: string, type: 'ok' | 'err' | 'warn') => void
}) {
    const [name, setName] = useState(recipe?.name || '')
    const [outputProductId, setOutputProductId] = useState(recipe?.outputProduct.id || '')
    const [outputQty, setOutputQty] = useState(recipe?.outputQty || 1)
    const [outputUnit, setOutputUnit] = useState(recipe?.outputUnit || 'กรัม')
    const [outputLocationId, setOutputLocationId] = useState(recipe?.outputLocation.id || '')
    const [note, setNote] = useState(recipe?.note || '')
    const [ingredients, setIngredients] = useState<Ingredient[]>(
        recipe?.ingredients.map(i => ({
            productId: i.productId || i.product?.id || '',
            quantity: i.quantity,
            unit: i.unit,
            locationId: i.locationId || i.location?.id || '',
        })) || [{ ...EMPTY_ING }]
    )
    const [saving, setSaving] = useState(false)

    function addIngredient() { setIngredients(prev => [...prev, { ...EMPTY_ING }]) }
    function removeIngredient(i: number) { setIngredients(prev => prev.filter((_, idx) => idx !== i)) }
    function updateIngredient(index: number, field: keyof Ingredient, value: any) {
        setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, [field]: value } : ing))
    }

    async function save() {
        if (!name || !outputProductId || !outputLocationId || ingredients.length === 0) {
            showToast('กรอกข้อมูลให้ครบ', 'err'); return
        }
        if (ingredients.some(i => !i.productId || !i.locationId || i.quantity <= 0)) {
            showToast('ส่วนผสมข้อมูลไม่ครบ', 'err'); return
        }
        setSaving(true)
        try {
            const payload = { name, outputProductId, outputQty, outputUnit, outputLocationId, note: note || undefined, ingredients }
            const url = recipe ? `/api/prep-recipes/${recipe.id}` : '/api/prep-recipes'
            const method = recipe ? 'PUT' : 'POST'
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            const json = await res.json()
            if (json.success) { showToast(recipe ? 'แก้ไขสูตรแล้ว' : 'สร้างสูตรแล้ว', 'ok'); onSaved() }
            else showToast(json.error || 'เกิดข้อผิดพลาด', 'err')
        } catch { showToast('เกิดข้อผิดพลาด', 'err') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{recipe ? '✏️ แก้ไขสูตร' : '🧪 สร้างสูตรแปรรูปใหม่'}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                </div>

                {/* Basic info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ชื่อสูตร *</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="เช่น ไก่หมัก, น้ำซุปต้ม" />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>สินค้าที่ได้ (Output) *</label>
                        <select value={outputProductId} onChange={e => setOutputProductId(e.target.value)} className="input">
                            <option value="">-- เลือกสินค้า --</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>คลังเก็บผลผลิต *</label>
                        <select value={outputLocationId} onChange={e => setOutputLocationId(e.target.value)} className="input">
                            <option value="">-- เลือกคลัง --</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ปริมาณได้รับต่อ batch *</label>
                        <input type="number" min={0.01} step={0.01} value={outputQty} onChange={e => setOutputQty(+e.target.value)} className="input" />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>หน่วยผลผลิต *</label>
                        <input value={outputUnit} onChange={e => setOutputUnit(e.target.value)} className="input" placeholder="เช่น กรัม, ลิตร, ชิ้น" />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>หมายเหตุ</label>
                        <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="รายละเอียดเพิ่มเติม..." />
                    </div>
                </div>

                {/* Ingredients section */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>🧂 ส่วนผสม (ต่อ 1 batch)</h3>
                        <button onClick={addIngredient} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 12px' }}>+ เพิ่ม</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ingredients.map((ing, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 36px', gap: 8, alignItems: 'center' }}>
                                <select value={ing.productId} onChange={e => updateIngredient(idx, 'productId', e.target.value)} className="input" style={{ fontSize: '0.8rem' }}>
                                    <option value="">-- วัตถุดิบ --</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <input type="number" min={0.01} step={0.01} value={ing.quantity}
                                    onChange={e => updateIngredient(idx, 'quantity', +e.target.value)}
                                    className="input" style={{ textAlign: 'center', fontSize: '0.8rem' }} placeholder="qty" />
                                <input value={ing.unit}
                                    onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                                    className="input" style={{ fontSize: '0.8rem' }} placeholder="หน่วย" />
                                <select value={ing.locationId} onChange={e => updateIngredient(idx, 'locationId', e.target.value)} className="input" style={{ fontSize: '0.8rem' }}>
                                    <option value="">-- คลัง --</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
                                </select>
                                <button onClick={() => removeIngredient(idx)}
                                    style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', padding: '4px 0', lineHeight: 1 }}>✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <button onClick={onClose} className="btn btn-secondary">ยกเลิก</button>
                    <button onClick={save} className="btn btn-primary" disabled={saving}>
                        {saving ? '⏳ กำลังบันทึก...' : recipe ? '✏️ บันทึกการแก้ไข' : '✅ สร้างสูตร'}
                    </button>
                </div>
            </div>
        </div>
    )
}
