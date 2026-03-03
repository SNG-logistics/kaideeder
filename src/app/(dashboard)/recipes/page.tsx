'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'

interface Recipe { id: string; menuName: string; posMenuCode?: string; bom: { id: string; quantity: number; unit: string; product: { name: string; sku: string } }[] }
interface Product { id: string; sku: string; name: string; unit: string }
interface Location { id: string; code: string; name: string }
interface BOMItem { productId: string; locationId: string; quantity: number; unit: string; _search?: string }

// ---- Ingredient Search Combobox Component ----
function ProductCombobox({ products, value, onChange }: {
    products: Product[]
    value: string
    onChange: (productId: string, unit: string) => void
}) {
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    const selected = products.find(p => p.id === value)

    // Show name of selected or current query
    const displayValue = open ? query : (selected ? selected.name : '')

    const filtered = query.length === 0
        ? products.slice(0, 40)
        : products.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.sku.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 30)

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
                setQuery('')
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <input
                type="text"
                className="input"
                placeholder="🔍 พิมพ์ชื่อวัตถุดิบ..."
                value={displayValue}
                style={{ fontSize: '0.82rem', width: '100%' }}
                onFocus={() => { setOpen(true); setQuery('') }}
                onChange={e => { setQuery(e.target.value); setOpen(true) }}
            />
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--white)', border: '1px solid var(--border)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    maxHeight: 220, overflowY: 'auto', marginTop: 4,
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>ไม่พบวัตถุดิบ</div>
                    ) : filtered.map(p => (
                        <div
                            key={p.id}
                            onMouseDown={() => { onChange(p.id, p.unit); setOpen(false); setQuery('') }}
                            style={{
                                padding: '0.5rem 0.875rem', cursor: 'pointer', fontSize: '0.82rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: p.id === value ? 'var(--accent-bg)' : 'transparent',
                                borderBottom: '1px solid var(--border-light)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                            onMouseLeave={e => (e.currentTarget.style.background = p.id === value ? 'var(--accent-bg)' : 'transparent')}
                        >
                            <span style={{ fontWeight: p.id === value ? 700 : 400, color: 'var(--text)' }}>{p.name}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 8 }}>{p.unit}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ---- Main Page ----
export default function RecipesPage() {
    useRoleGuard(['owner', 'manager', 'warehouse'])
    const [recipes, setRecipes] = useState<Recipe[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)  // null = create, string = edit
    const [menuName, setMenuName] = useState('')
    const [posMenuCode, setPosMenuCode] = useState('')
    const [bom, setBom] = useState<BOMItem[]>([])
    const [saving, setSaving] = useState(false)
    const [aiLoading, setAiLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [aiQuestion, setAiQuestion] = useState<string | null>(null)
    const [aiClarification, setAiClarification] = useState('')
    const [missingIngredients, setMissingIngredients] = useState<{ name: string; quantity: number; unit: string; location: string }[]>([])
    const [deletingId, setDeletingId] = useState<string | null>(null)


    useEffect(() => {
        fetchRecipes()
        fetch('/api/products?limit=500').then(r => r.json()).then(j => j.success && setProducts(j.data.products))
        fetch('/api/locations').then(r => r.json()).then(j => j.success && setLocations(j.data))
    }, [])

    async function fetchRecipes() {
        setLoading(true)
        const res = await fetch('/api/recipes')
        const json = await res.json()
        if (json.success) setRecipes(json.data)
        setLoading(false)
    }

    function addBomItem() {
        if (locations.length === 0) return
        const kitLoc = locations.find(l => l.code === 'KIT_STOCK') || locations[0]
        // แทนที่จะใช้ products[0] → เพิ่ม row ว่าง ให้ user search เอง
        setBom([...bom, { productId: '', locationId: kitLoc.id, quantity: 1, unit: '' }])
    }

    // ✨ AI แนะนำ BOM
    async function handleAiSuggest(clarification?: string) {
        if (!menuName.trim()) return toast.error('กรุณากรอกชื่อเมนูก่อน')
        setAiLoading(true)
        setMissingIngredients([])
        try {
            const res = await fetch('/api/ai/suggest-bom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menuName, clarification })
            })
            const json = await res.json()
            if (!json.success) return toast.error(json.error || 'AI ไม่สามารถแนะนำได้')
            const d = json.data

            // AI ถามกลับ
            if (d.type === 'question') {
                setAiQuestion(d.question)
                setAiClarification('')
                toast('🤔 AI มีคำถามเพิ่มเติม', { icon: '💬' })
                return
            }

            setAiQuestion(null)
            setAiClarification('')
            const { suggestions, missingIngredients: missing } = d

            // set missing ingredients สำหรับแสดง inline card
            if (missing && missing.length > 0) {
                setMissingIngredients(missing)
            }

            if (!suggestions || suggestions.length === 0) {
                if (missing && missing.length > 0) {
                    toast.error(`❌ ไม่มีวัตถุดิบในระบบเลย — ดูรายการที่ต้องเพิ่มด้านล่าง`, { duration: 6000 })
                } else {
                    toast.error('AI ไม่พบวัตถุดิบที่ตรงกัน — ลองระบุชื่อเมนูให้ละเอียดขึ้น')
                }
                return
            }

            setBom(suggestions.map((s: { productId: string; locationId: string; quantity: number; unit: string }) => ({
                productId: s.productId,
                locationId: s.locationId,
                quantity: s.quantity,
                unit: s.unit,
            })))

            if (missing && missing.length > 0) {
                toast.success(`✨ พบ ${suggestions.length} วัตถุดิบ · ⚠️ ขาด ${missing.length} รายการ (ดูด้านล่าง)`, { duration: 5000 })
            } else {
                toast.success(`✨ AI แนะนำ BOM ${suggestions.length} รายการ — ตรวจสอบและปรับได้เลย`)
            }
        } catch {
            toast.error('เชื่อมต่อ AI ไม่ได้')
        } finally {
            setAiLoading(false)
        }
    }

    // ส่งคำตอบ clarification กลับ AI
    async function handleAiAnswer() {
        if (!aiClarification.trim()) return
        setAiQuestion(null)
        await handleAiSuggest(aiClarification)
    }

    function handleEdit(r: Recipe) {
        setEditId(r.id)
        setMenuName(r.menuName)
        setPosMenuCode(r.posMenuCode || '')
        const kitLoc = locations.find(l => l.code === 'KIT_STOCK') || locations[0]
        setBom(r.bom.map(b => ({
            productId: b.product ? products.find(p => p.name === b.product.name)?.id || '' : '',
            locationId: kitLoc?.id || '',
            quantity: b.quantity,
            unit: b.unit,
        })))
        setMissingIngredients([])
        setAiQuestion(null)
        setShowForm(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function closeForm() {
        setShowForm(false); setEditId(null)
        setMenuName(''); setPosMenuCode(''); setBom([])
        setMissingIngredients([]); setAiQuestion(null)
    }

    async function handleDelete(id: string, name: string) {
        if (!confirm(`ลบสูตร "${name}" ใช่ไหม?\nการลบจะไม่กระทบยอดขายหรือสต็อคที่ผ่านมา`)) return
        setDeletingId(id)
        try {
            const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
            const json = await res.json()
            if (json.success) { toast.success('ลบสูตรแล้ว'); fetchRecipes() }
            else toast.error(json.error)
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setDeletingId(null) }
    }

    async function handleSave() {
        if (!menuName) return toast.error('กรุณากรอกชื่อเมนู')
        const validBom = bom.filter(b => b.productId)
        if (validBom.length === 0) return toast.error('กรุณาเพิ่มวัตถุดิบอย่างน้อย 1 รายการ')
        setSaving(true)
        try {
            const url = editId ? `/api/recipes/${editId}` : '/api/recipes'
            const method = editId ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menuName, posMenuCode, bom: validBom })
            })
            const json = await res.json()
            if (json.success) {
                toast.success(editId ? '✅ แก้ไขสูตรเรียบร้อย' : '✅ บันทึกสูตรเรียบร้อย')
                closeForm(); fetchRecipes()
            } else toast.error(json.error)
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    const filtered = recipes.filter(r => r.menuName.toLowerCase().includes(search.toLowerCase()))
    const kitLocId = locations.find(l => l.code === 'KIT_STOCK')?.id || locations[0]?.id || ''

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">📋 สูตรอาหาร (Recipe / BOM)</h1>
                    <p className="page-subtitle">
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{recipes.length}</span> สูตร — match กับยอดขาย POS เพื่อตัดสต็อคอัตโนมัติ
                    </p>
                </div>
                <button onClick={() => showForm ? closeForm() : setShowForm(true)}
                    className={showForm ? 'btn-secondary' : 'btn-primary'}>
                    {showForm ? '✕ ปิด' : '➕ เพิ่มสูตรใหม่'}
                </button>
            </div>

            {/* Add Form */}
            {showForm && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                            {editId ? '✏️ แก้ไขสูตร' : '🆕 สร้างสูตรใหม่'}
                        </h3>
                        {/* AI Suggest Button */}
                        <button
                            onClick={() => handleAiSuggest()}
                            disabled={aiLoading || !menuName.trim()}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
                                background: aiLoading ? '#e5e7eb' : 'linear-gradient(135deg, #7C3AED, #A855F7)',
                                color: aiLoading ? '#9ca3af' : 'white',
                                fontWeight: 600, fontSize: '0.85rem', cursor: aiLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s', boxShadow: aiLoading ? 'none' : '0 2px 8px rgba(124,58,237,0.3)'
                            }}
                        >
                            {aiLoading ? '⏳ กำลังคิด...' : '✨ AI แนะนำ BOM'}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                        <div>
                            <label className="label">ชื่อเมนู (ตรงกับ POS) *</label>
                            <input value={menuName} onChange={e => setMenuName(e.target.value)} className="input"
                                placeholder="เช่น Heineken (ขวดใหญ่), เสือร้องไห้ ย่าง" />
                        </div>
                        <div>
                            <label className="label">รหัส POS (ถ้ามี)</label>
                            <input value={posMenuCode} onChange={e => setPosMenuCode(e.target.value)} className="input" placeholder="dvip09" />
                        </div>
                    </div>

                    {/* AI hint */}
                    {menuName.trim() && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(124,58,237,0.05), rgba(168,85,247,0.05))',
                            border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8,
                            padding: '0.6rem 1rem', marginBottom: 12, fontSize: '0.8rem', color: '#7C3AED'
                        }}>
                            💡 กด <strong>✨ AI แนะนำ BOM</strong> ให้ AI คำนวณวัตถุดิบสำหรับ &ldquo;{menuName}&rdquo; อัตโนมัติ
                        </div>
                    )}

                    {/* AI clarification question */}
                    {aiQuestion && (
                        <div style={{
                            background: 'rgba(124,58,237,0.06)', border: '1.5px solid rgba(124,58,237,0.25)',
                            borderRadius: 10, padding: '0.75rem 1rem', marginBottom: 12
                        }}>
                            <p style={{ fontSize: '0.82rem', color: '#7C3AED', fontWeight: 600, marginBottom: 8 }}>💬 {aiQuestion}</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    className="input" style={{ fontSize: '0.82rem', flex: 1 }}
                                    placeholder="ตอบที่นี่..."
                                    value={aiClarification}
                                    onChange={e => setAiClarification(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAiAnswer()}
                                    autoFocus
                                />
                                <button onClick={handleAiAnswer} disabled={!aiClarification.trim() || aiLoading}
                                    style={{
                                        padding: '0 1rem', borderRadius: 8, border: 'none',
                                        background: '#7C3AED', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem'
                                    }}>
                                    ส่ง
                                </button>
                                <button onClick={() => setAiQuestion(null)}
                                    style={{ padding: '0 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* BOM Column Headers */}
                    {bom.length > 0 && (
                        <div style={{
                            display: 'grid', gridTemplateColumns: '4fr 3fr 2fr 2fr auto',
                            gap: 8, padding: '0 0.625rem', marginBottom: 4
                        }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>วัตถุดิบ</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>คลัง</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ปริมาณ</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>หน่วย</span>
                            <span />
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: bom.length > 0 ? 6 : 10 }}>
                        <h4 style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            🥩 วัตถุดิบ (ต่อ 1 เมนู) — {bom.filter(b => b.productId).length} รายการ
                        </h4>
                        <button onClick={addBomItem} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.875rem' }}>
                            ➕ เพิ่มเอง
                        </button>
                    </div>

                    {bom.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                            {bom.map((item, i) => (
                                <div key={i} style={{
                                    display: 'grid', gridTemplateColumns: '4fr 3fr 2fr 2fr auto',
                                    gap: 8, alignItems: 'center',
                                    background: 'var(--bg)', borderRadius: 10, padding: '0.625rem',
                                    border: '1px solid var(--border)'
                                }}>
                                    {/* ✅ Typeahead search แทน dropdown */}
                                    <ProductCombobox
                                        products={products}
                                        value={item.productId}
                                        onChange={(productId, unit) => {
                                            const nb = [...bom]
                                            nb[i].productId = productId
                                            nb[i].unit = unit
                                            setBom(nb)
                                        }}
                                    />
                                    <select value={item.locationId} onChange={e => { const nb = [...bom]; nb[i].locationId = e.target.value; setBom(nb) }}
                                        className="input" style={{ fontSize: '0.82rem' }}>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                    <input type="number" value={item.quantity}
                                        onChange={e => { const nb = [...bom]; nb[i].quantity = parseFloat(e.target.value) || 0; setBom(nb) }}
                                        className="input" placeholder="ปริมาณ" min={0.001} step={0.001} style={{ fontSize: '0.82rem' }} />
                                    <input value={item.unit}
                                        onChange={e => { const nb = [...bom]; nb[i].unit = e.target.value; setBom(nb) }}
                                        className="input" placeholder="หน่วย" style={{ fontSize: '0.82rem' }} />
                                    <button onClick={() => setBom(bom.filter((_, idx) => idx !== i))}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {bom.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg)', borderRadius: 10, border: '1px dashed var(--border)', marginBottom: 12 }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                ยังไม่มีวัตถุดิบ — กด ✨ AI แนะนำ หรือ ➕ เพิ่มเอง
                            </p>
                        </div>
                    )}

                    {/* ── Missing Ingredients Card (inline) ── */}
                    {missingIngredients.length > 0 && (
                        <div style={{
                            background: 'rgba(245,158,11,0.06)', border: '1.5px solid rgba(245,158,11,0.35)',
                            borderRadius: 12, padding: '1rem', marginBottom: 12,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    🚧 วัตถุดิบที่ AI ต้องการแต่ยังไม่มีในระบบ
                                    <span style={{ background: '#d97706', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '1px 7px', borderRadius: 20 }}>
                                        {missingIngredients.length} รายการ
                                    </span>
                                </p>
                                <button onClick={() => setMissingIngredients([])}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}>✕</button>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#92400e', marginBottom: 10, lineHeight: 1.5 }}>
                                ⬇️ ไปเพิ่มสินค้าเหล่านี้ที่หน้า <strong>📦 สินค้า</strong> ก่อน แล้วกด AI แนะนำใหม่ เพื่อให้ BOM ครบสมบูรณ์
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                                {missingIngredients.map((m, i) => (
                                    <div key={i} style={{
                                        background: 'rgba(245,158,11,0.08)', borderRadius: 8,
                                        padding: '0.5rem 0.75rem', border: '1px solid rgba(245,158,11,0.25)',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                    }}>
                                        <span style={{ fontSize: '1rem' }}>⚠️</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</p>
                                            <p style={{ fontSize: '0.7rem', color: '#a16207' }}>{m.quantity} {m.unit} · {m.location}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <button onClick={handleSave} disabled={saving || !menuName || bom.filter(b => b.productId).length === 0}
                            className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                            {saving ? '⏳...' : '✅ บันทึกสูตร'}
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div style={{ marginBottom: 14 }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 ค้นหาเมนู..." className="input" style={{ width: 280 }} />
            </div>

            {/* Recipes list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--accent)' }}>⏳ กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: 8 }}>ยังไม่มีสูตรอาหาร</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>เพิ่มสูตรเพื่อให้ระบบตัดสต็อคอัตโนมัติเมื่อ import ยอดขาย</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                    {filtered.map(r => (
                        <div key={r.id} className="card" style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <h3 style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>{r.menuName}</h3>
                                    {r.posMenuCode && (
                                        <span style={{
                                            fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)',
                                            background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)'
                                        }}>
                                            {r.posMenuCode}
                                        </span>
                                    )}
                                </div>
                                {/* Edit / Delete buttons */}
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        onClick={() => handleEdit(r)}
                                        title="แก้ไขสูตร"
                                        style={{
                                            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                                            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                                            fontSize: '0.78rem', color: '#3B82F6', fontWeight: 600, fontFamily: 'inherit',
                                        }}
                                    >
                                        ✏️ แก้ไข
                                    </button>
                                    <button
                                        onClick={() => handleDelete(r.id, r.menuName)}
                                        disabled={deletingId === r.id}
                                        title="ลบสูตร"
                                        style={{
                                            background: 'rgba(232,54,78,0.06)', border: '1px solid rgba(232,54,78,0.2)',
                                            borderRadius: 8, padding: '4px 10px', cursor: deletingId === r.id ? 'not-allowed' : 'pointer',
                                            fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, fontFamily: 'inherit',
                                            opacity: deletingId === r.id ? 0.5 : 1,
                                        }}
                                    >
                                        {deletingId === r.id ? '⏳' : '🗑️ ลบ'}
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {r.bom.map(b => (
                                    <span key={b.id} style={{
                                        background: 'var(--accent-bg)', color: 'var(--accent)',
                                        fontSize: '0.75rem', padding: '4px 10px', borderRadius: 8,
                                        border: '1px solid rgba(232,54,78,0.2)',
                                    }}>
                                        {b.product.name} × {b.quantity} {b.unit}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
