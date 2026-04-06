'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'

interface Recipe { id: string; menuName: string; posMenuCode?: string; bomStatus: 'OK' | 'INCOMPLETE' | 'MISSING'; bom: { id: string; quantity: number; unit: string; product: { name: string; sku: string } }[] }
interface Product { id: string; sku: string; name: string; unit: string }
interface Location { id: string; code: string; name: string }
interface BOMItem { productId: string; locationId: string; quantity: number; unit: string; _search?: string }
interface MissingIng { name: string; quantity: number; unit: string; location: string }
interface CatalogItem {
    inventoryItemId: string; code: string; name: string;
    itemRole: string; baseUnit: string; purchaseUnit?: string; status: string;
    hasProduct: boolean; productId: string | null; productSku: string | null;
}

// ---- Ingredient Search Combobox Component ----
function ProductCombobox({ products, value, onChange, usedIds = [] }: {
    products: Product[]
    value: string
    onChange: (productId: string, unit: string) => void
    usedIds?: string[]
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
                    ) : filtered.map(p => {
                        const isDup = usedIds.includes(p.id) && p.id !== value
                        return (
                            <div
                                key={p.id}
                                onMouseDown={() => {
                                    if (isDup) return
                                    onChange(p.id, p.unit); setOpen(false); setQuery('')
                                }}
                                style={{
                                    padding: '0.5rem 0.875rem',
                                    cursor: isDup ? 'not-allowed' : 'pointer',
                                    fontSize: '0.82rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: isDup ? '#FFF7ED' : (p.id === value ? 'var(--accent-bg)' : 'transparent'),
                                    borderBottom: '1px solid var(--border-light)',
                                    opacity: isDup ? 0.7 : 1,
                                }}
                                onMouseEnter={e => { if (!isDup) e.currentTarget.style.background = 'var(--bg)' }}
                                onMouseLeave={e => {
                                    if (!isDup) e.currentTarget.style.background = p.id === value ? 'var(--accent-bg)' : 'transparent'
                                }}
                            >
                                <span style={{ fontWeight: p.id === value ? 700 : 400, color: isDup ? '#D97706' : 'var(--text)' }}>
                                    {p.name}
                                </span>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    {isDup && (
                                        <span style={{
                                            fontSize: '0.62rem', fontWeight: 800,
                                            background: '#FED7AA', color: '#C2410C',
                                            borderRadius: 20, padding: '1px 7px',
                                        }}>ซ้ำแล้ว</span>
                                    )}
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 2 }}>{p.unit}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ---- Catalog Search Combobox (BOM Bridge) ----
function CatalogCombobox({ value, onChange, usedProductIds = [], locationId }: {
    value: string  // productId currently selected
    onChange: (productId: string, unit: string) => void
    usedProductIds?: string[]
    locationId: string
}) {
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [results, setResults] = useState<CatalogItem[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedName, setSelectedName] = useState('')
    const ref = useRef<HTMLDivElement>(null)
    const debounceRef = useRef<any>(null)

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    function doSearch(q: string) {
        setLoading(true)
        fetch(`/api/items/search-for-bom?q=${encodeURIComponent(q)}&limit=20`)
            .then(r => r.json())
            .then(j => { if (j.success) setResults(j.data) })
            .catch(() => {})
            .finally(() => setLoading(false))
    }

    function handleQueryChange(q: string) {
        setQuery(q)
        setOpen(true)
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => doSearch(q), 250)
    }

    async function handleSelect(item: CatalogItem) {
        // If already has a Product → use it directly
        if (item.hasProduct && item.productId) {
            onChange(item.productId, item.baseUnit)
            setSelectedName(item.name)
            setOpen(false)
            return
        }
        // Auto-provision a Product from the Catalog item
        try {
            const res = await fetch('/api/items/provision-product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inventoryItemId: item.inventoryItemId, locationId }),
            })
            const j = await res.json()
            if (j.success) {
                onChange(j.data.id, j.data.unit)
                setSelectedName(item.name)
                toast.success(`✅ สร้าง Product "${item.name}" อัตโนมัติแล้ว`)
            } else {
                toast.error(j.error || 'ไม่สามารถสร้าง Product ได้')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาดในการเชื่อม Catalog → Product')
        }
        setOpen(false)
    }

    const displayValue = open ? query : selectedName

    const ROLE_COLORS: Record<string, string> = {
        RAW: '#10B981', PREP: '#8B5CF6', SUPPLY: '#F59E0B', SERVICE: '#6B7280',
    }

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <input
                type="text"
                className="input"
                placeholder="🧺 ค้นหาจาก Catalog..."
                value={displayValue}
                style={{ fontSize: '0.82rem', width: '100%', borderColor: '#8B5CF6', borderWidth: '1.5px' }}
                onFocus={() => { setOpen(true); setQuery(''); doSearch('') }}
                onChange={e => handleQueryChange(e.target.value)}
            />
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--white)', border: '1.5px solid #8B5CF6',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(139,92,246,0.15)',
                    maxHeight: 260, overflowY: 'auto', marginTop: 4,
                }}>
                    {loading ? (
                        <div style={{ padding: '0.75rem 1rem', color: '#8B5CF6', fontSize: '0.82rem' }}>⏳ กำลังค้นหา...</div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>ไม่พบรายการใน Catalog</div>
                    ) : results.map(item => {
                        const isDup = item.productId ? usedProductIds.includes(item.productId) && item.productId !== value : false
                        return (
                            <div
                                key={item.inventoryItemId}
                                onMouseDown={() => !isDup && handleSelect(item)}
                                style={{
                                    padding: '0.5rem 0.875rem',
                                    cursor: isDup ? 'not-allowed' : 'pointer',
                                    fontSize: '0.82rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: isDup ? '#FFF7ED' : 'transparent',
                                    borderBottom: '1px solid var(--border-light)',
                                    opacity: isDup ? 0.6 : 1,
                                }}
                                onMouseEnter={e => { if (!isDup) e.currentTarget.style.background = '#F5F3FF' }}
                                onMouseLeave={e => { if (!isDup) e.currentTarget.style.background = 'transparent' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                                        background: `${ROLE_COLORS[item.itemRole] || '#6B7280'}18`,
                                        color: ROLE_COLORS[item.itemRole] || '#6B7280',
                                    }}>{item.itemRole}</span>
                                    <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.name}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                    {isDup && <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#FED7AA', color: '#C2410C', borderRadius: 20, padding: '1px 7px' }}>ซ้ำแล้ว</span>}
                                    {item.hasProduct
                                        ? <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#059669' }}>✅ มี Product</span>
                                        : <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#D97706' }}>⚡ สร้างอัตโนมัติ</span>
                                    }
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.baseUnit}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ---- Quick-Add Inline Product ----
function QuickAddProduct({ ingredient, onAdded, categories }: {
    ingredient: MissingIng
    onAdded: (newProductId: string, name: string) => void
    categories: { id: string; name: string; code: string }[]
}) {
    const [open, setOpen] = useState(false)
    const [name, setName] = useState(ingredient.name)
    const [unit, setUnit] = useState(ingredient.unit || 'g')
    const [categoryId, setCategoryId] = useState('')
    const [saving, setSaving] = useState(false)

    // pick a sensible default category
    useEffect(() => {
        if (categories.length > 0 && !categoryId) {
            const raw = categories.find(c => c.code.startsWith('RAW') || c.code === 'DRY_GOODS')
            setCategoryId(raw?.id || categories[0].id)
        }
    }, [categories, categoryId])

    async function handleAdd() {
        if (!name.trim() || !categoryId) return
        setSaving(true)
        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), unit, categoryId, productType: 'RAW_MATERIAL', costPrice: 0, salePrice: 0 }),
            })
            const json = await res.json()
            if (!json.success) { toast.error(json.error || 'เพิ่มสินค้าไม่สำเร็จ'); return }
            toast.success(`✅ เพิ่ม "${json.data.name}" แล้ว — กด AI แนะนำใหม่ได้เลย`)
            onAdded(json.data.id, json.data.name)
            setOpen(false)
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 10, padding: '0.5rem 0.75rem', border: '1px solid rgba(245,158,11,0.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>⚠️</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ingredient.name}</p>
                    <p style={{ fontSize: '0.7rem', color: '#a16207' }}>{ingredient.quantity} {ingredient.unit} · {ingredient.location}</p>
                </div>
                <button
                    onClick={() => setOpen(o => !o)}
                    style={{
                        background: open ? '#d97706' : 'rgba(245,158,11,0.15)',
                        border: '1px solid rgba(245,158,11,0.4)', borderRadius: 7,
                        padding: '3px 10px', cursor: 'pointer', fontSize: '0.75rem',
                        fontWeight: 700, color: open ? '#fff' : '#92400e', flexShrink: 0,
                    }}
                >
                    {open ? '✕ ปิด' : '➕ เพิ่ม'}
                </button>
            </div>
            {open && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 6, alignItems: 'end' }}>
                    <div>
                        <div style={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 600, marginBottom: 3 }}>ชื่อสินค้า</div>
                        <input className="input" style={{ fontSize: '0.8rem' }} value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อวัตถุดิบ" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 600, marginBottom: 3 }}>หน่วย</div>
                        <input className="input" style={{ fontSize: '0.8rem' }} value={unit} onChange={e => setUnit(e.target.value)} placeholder="kg" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 600, marginBottom: 3 }}>หมวดหมู่</div>
                        <select className="input" style={{ fontSize: '0.8rem' }} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <button onClick={handleAdd} disabled={saving || !name.trim() || !categoryId}
                        style={{ background: saving ? '#d1d5db' : '#d97706', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'inherit' }}>
                        {saving ? '⏳' : 'บันทึก'}
                    </button>
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
    const [categories, setCategories] = useState<{ id: string; name: string; code: string }[]>([])
    const [showMissingOnly, setShowMissingOnly] = useState(false)
    const [useCatalog, setUseCatalog] = useState(true)

    const refreshProducts = () => fetch('/api/products?limit=500').then(r => r.json()).then(j => j.success && setProducts(j.data.products))

    useEffect(() => {
        fetchRecipes()
        refreshProducts()
        fetch('/api/locations').then(r => r.json()).then(j => j.success && setLocations(j.data))
        fetch('/api/categories').then(r => r.json()).then(j => j.success && setCategories(j.data || []))
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

    const filtered = recipes
        .filter(r => r.menuName.toLowerCase().includes(search.toLowerCase()))
        .filter(r => !showMissingOnly || r.bomStatus !== 'OK')
    const missingCount = recipes.filter(r => r.bomStatus === 'MISSING').length
    const incompleteCount = recipes.filter(r => r.bomStatus === 'INCOMPLETE').length
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

            {/* BOM Alert Banner */}
            {(missingCount > 0 || incompleteCount > 0) && (
                <div style={{
                    background: 'rgba(245,158,11,0.06)', border: '1.5px solid rgba(245,158,11,0.35)',
                    borderRadius: 12, padding: '0.75rem 1rem', marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#d97706' }}>
                            พบเมนูที่ยังไม่มี BOM — ระบบจะตัดสต็อคไม่ได้!
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 2 }}>
                            {missingCount > 0 && <span>❌ ไม่มี BOM เลย: <strong>{missingCount} เมนู</strong>{'  '}</span>}
                            {incompleteCount > 0 && <span>⚠️ BOM ไม่ครบ: <strong>{incompleteCount} เมนู</strong></span>}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowMissingOnly(v => !v)}
                        style={{
                            padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                            border: showMissingOnly ? 'none' : '1.5px solid #d97706',
                            background: showMissingOnly ? '#d97706' : 'transparent',
                            color: showMissingOnly ? '#fff' : '#d97706',
                            fontFamily: 'inherit',
                        }}
                    >
                        {showMissingOnly ? '✕ ดูทั้งหมด' : '🔍 แสดงเฉพาะที่ขาด'}
                    </button>
                </div>
            )}

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

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: bom.length > 0 ? 6 : 10, flexWrap: 'wrap', gap: 8 }}>
                        <h4 style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            🥩 วัตถุดิบ (ต่อ 1 เมนู) — {bom.filter(b => b.productId).length} รายการ
                        </h4>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {/* Toggle: Catalog vs Legacy */}
                            <div style={{
                                display: 'flex', borderRadius: 8, overflow: 'hidden',
                                border: '1.5px solid #E2E8F0', fontSize: '0.75rem', fontWeight: 600,
                            }}>
                                <button onClick={() => setUseCatalog(true)} style={{
                                    padding: '5px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                    background: useCatalog ? '#7C3AED' : 'transparent',
                                    color: useCatalog ? '#fff' : '#6B7280',
                                    transition: 'all 0.15s',
                                }}>🧺 Catalog</button>
                                <button onClick={() => setUseCatalog(false)} style={{
                                    padding: '5px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                    background: !useCatalog ? '#6B7280' : 'transparent',
                                    color: !useCatalog ? '#fff' : '#6B7280',
                                    transition: 'all 0.15s',
                                }}>📦 Product เดิม</button>
                            </div>
                            <button onClick={addBomItem} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.875rem' }}>
                                ➕ เพิ่มเอง
                            </button>
                        </div>
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
                                    {/* ✅ Typeahead search — Catalog mode or Legacy mode */}
                                    {useCatalog ? (
                                        <CatalogCombobox
                                            value={item.productId}
                                            usedProductIds={bom.map(b => b.productId)}
                                            locationId={item.locationId}
                                            onChange={(productId, unit) => {
                                                const isDup = bom.some((b, idx) => idx !== i && b.productId === productId)
                                                if (isDup) {
                                                    toast.error('⚠️ วัตถุดิบนี้มีใน BOM แล้ว', { duration: 3500 })
                                                    return
                                                }
                                                const nb = [...bom]
                                                nb[i].productId = productId
                                                nb[i].unit = unit
                                                setBom(nb)
                                            }}
                                        />
                                    ) : (
                                        <ProductCombobox
                                            products={products}
                                            value={item.productId}
                                            usedIds={bom.map(b => b.productId)}
                                            onChange={(productId, unit) => {
                                                const isDup = bom.some((b, idx) => idx !== i && b.productId === productId)
                                                if (isDup) {
                                                    const dupName = products.find(p => p.id === productId)?.name || productId
                                                    toast.error(`⚠️ "${dupName}" มีใน BOM แล้ว — ไม่สามารถเพิ่มซ้ำได้`, { duration: 3500 })
                                                    return
                                                }
                                                const nb = [...bom]
                                                nb[i].productId = productId
                                                nb[i].unit = unit
                                                setBom(nb)
                                            }}
                                        />
                                    )}
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

                    {/* ── Missing Ingredients Card — Quick-Add inline ── */}
                    {missingIngredients.length > 0 && (
                        <div style={{
                            background: 'rgba(245,158,11,0.04)', border: '1.5px solid rgba(245,158,11,0.35)',
                            borderRadius: 12, padding: '1rem', marginBottom: 12,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    🚧 วัตถุดิบที่ยังไม่มีในระบบ
                                    <span style={{ background: '#d97706', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '1px 7px', borderRadius: 20 }}>
                                        {missingIngredients.length} รายการ
                                    </span>
                                </p>
                                <button onClick={() => setMissingIngredients([])}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}>✕</button>
                            </div>
                            <p style={{ fontSize: '0.73rem', color: '#92400e', marginBottom: 10, lineHeight: 1.5 }}>
                                กด <strong>➕ เพิ่ม</strong> เพื่อเพิ่มวัตถุดิบเข้าระบบทันที แล้วกด ✨ AI แนะนำใหม่
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {missingIngredients.map((m, i) => (
                                    <QuickAddProduct
                                        key={i}
                                        ingredient={m}
                                        categories={categories}
                                        onAdded={async (newId, newName) => {
                                            // refresh products then re-run AI
                                            await refreshProducts()
                                            setMissingIngredients(prev => prev.filter((_, idx) => idx !== i))
                                            toast(`🔄 กด ✨ AI แนะนำ อีกครั้งเพื่ออัพเดท BOM`, { icon: '💡', duration: 4000 })
                                        }}
                                    />
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
                                    {/* BOM Status Badge */}
                                    {r.bomStatus === 'MISSING' && (
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>❌ ไม่มี BOM</span>
                                    )}
                                    {r.bomStatus === 'INCOMPLETE' && (
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>⚠️ BOM ไม่ครบ</span>
                                    )}
                                    {r.bomStatus === 'OK' && (
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>✅ {r.bom.length} วัตถุดิบ</span>
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
