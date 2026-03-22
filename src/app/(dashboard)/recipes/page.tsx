'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'

interface Recipe { id: string; menuName: string; posMenuCode?: string; bomStatus: 'OK' | 'INCOMPLETE' | 'MISSING'; bom: { id: string; quantity: number; unit: string; product: { name: string; sku: string } }[] }
interface Product { id: string; sku: string; name: string; unit: string }
interface Location { id: string; code: string; name: string }
interface BOMItem { productId: string; locationId: string; quantity: number; unit: string; _search?: string }
interface MissingIng { name: string; quantity: number; unit: string; location: string }

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
                placeholder="ðŸ” à¸žà¸´à¸¡à¸žà¹Œà¸Šà¸·à¹ˆà¸­à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š..."
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
                        <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>à¹„à¸¡à¹ˆà¸žà¸šà¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š</div>
                    ) : filtered.map(p => {
                        const isDuplicate = usedIds.includes(p.id) && p.id !== value
                        return (
                            <div
                                key={p.id}
                                onMouseDown={() => {
                                    if (isDuplicate) return  // block selection
                                    onChange(p.id, p.unit); setOpen(false); setQuery('')
                                }}
                                style={{
                                    padding: '0.5rem 0.875rem', cursor: isDuplicate ? 'not-allowed' : 'pointer',
                                    fontSize: '0.82rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: isDuplicate ? '#FFF7ED' : (p.id === value ? 'var(--accent-bg)' : 'transparent'),
                                    borderBottom: '1px solid var(--border-light)',
                                    opacity: isDuplicate ? 0.7 : 1,
                                }}
                                onMouseEnter={e => { if (!isDuplicate) e.currentTarget.style.background = 'var(--bg)' }}
                                onMouseLeave={e => {
                                    if (!isDuplicate) e.currentTarget.style.background = p.id === value ? 'var(--accent-bg)' : 'transparent'
                                }}
                            >
                                <span style={{ fontWeight: p.id === value ? 700 : 400, color: isDuplicate ? '#D97706' : 'var(--text)' }}>
                                    {p.name}
                                </span>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    {isDuplicate && (
                                        <span style={{
                                            fontSize: '0.62rem', fontWeight: 800,
                                            background: '#FED7AA', color: '#C2410C',
                                            borderRadius: 20, padding: '1px 7px',
                                        }}>à¸‹à¹‰à¸³à¹à¸¥à¹‰à¸§</span>
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
            if (!json.success) { toast.error(json.error || 'à¹€à¸žà¸´à¹ˆà¸¡à¸ªà¸´à¸™à¸„à¹‰à¸²à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ'); return }
            toast.success(`âœ… à¹€à¸žà¸´à¹ˆà¸¡ "${json.data.name}" à¹à¸¥à¹‰à¸§ â€” à¸à¸” AI à¹à¸™à¸°à¸™à¸³à¹ƒà¸«à¸¡à¹ˆà¹„à¸”à¹‰à¹€à¸¥à¸¢`)
            onAdded(json.data.id, json.data.name)
            setOpen(false)
        } catch { toast.error('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 10, padding: '0.5rem 0.75rem', border: '1px solid rgba(245,158,11,0.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>âš ï¸</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ingredient.name}</p>
                    <p style={{ fontSize: '0.7rem', color: '#a16207' }}>{ingredient.quantity} {ingredient.unit} Â· {ingredient.location}</p>
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
                    {open ? 'âœ• à¸›à¸´à¸”' : 'âž• à¹€à¸žà¸´à¹ˆà¸¡'}
                </button>
            </div>
            {open && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 6, alignItems: 'end' }}>
                    <div>
                        <div style={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 600, marginBottom: 3 }}>à¸Šà¸·à¹ˆà¸­à¸ªà¸´à¸™à¸„à¹‰à¸²</div>
                        <input className="input" style={{ fontSize: '0.8rem' }} value={name} onChange={e => setName(e.target.value)} placeholder="à¸Šà¸·à¹ˆà¸­à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 600, marginBottom: 3 }}>à¸«à¸™à¹ˆà¸§à¸¢</div>
                        <input className="input" style={{ fontSize: '0.8rem' }} value={unit} onChange={e => setUnit(e.target.value)} placeholder="kg" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 600, marginBottom: 3 }}>à¸«à¸¡à¸§à¸”à¸«à¸¡à¸¹à¹ˆ</div>
                        <select className="input" style={{ fontSize: '0.8rem' }} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <button onClick={handleAdd} disabled={saving || !name.trim() || !categoryId}
                        style={{ background: saving ? '#d1d5db' : '#d97706', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'inherit' }}>
                        {saving ? 'â³' : 'à¸šà¸±à¸™à¸—à¸¶à¸'}
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
        // à¹à¸—à¸™à¸—à¸µà¹ˆà¸ˆà¸°à¹ƒà¸Šà¹‰ products[0] â†’ à¹€à¸žà¸´à¹ˆà¸¡ row à¸§à¹ˆà¸²à¸‡ à¹ƒà¸«à¹‰ user search à¹€à¸­à¸‡
        setBom([...bom, { productId: '', locationId: kitLoc.id, quantity: 1, unit: '' }])
    }

    // âœ¨ AI à¹à¸™à¸°à¸™à¸³ BOM
    async function handleAiSuggest(clarification?: string) {
        if (!menuName.trim()) return toast.error('à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸Šà¸·à¹ˆà¸­à¹€à¸¡à¸™à¸¹à¸à¹ˆà¸­à¸™')
        setAiLoading(true)
        setMissingIngredients([])
        try {
            const res = await fetch('/api/ai/suggest-bom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menuName, clarification })
            })
            const json = await res.json()
            if (!json.success) return toast.error(json.error || 'AI à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹à¸™à¸°à¸™à¸³à¹„à¸”à¹‰')
            const d = json.data

            // AI à¸–à¸²à¸¡à¸à¸¥à¸±à¸š
            if (d.type === 'question') {
                setAiQuestion(d.question)
                setAiClarification('')
                toast('ðŸ¤” AI à¸¡à¸µà¸„à¸³à¸–à¸²à¸¡à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡', { icon: 'ðŸ’¬' })
                return
            }

            setAiQuestion(null)
            setAiClarification('')
            const { suggestions, missingIngredients: missing } = d

            // set missing ingredients à¸ªà¸³à¸«à¸£à¸±à¸šà¹à¸ªà¸”à¸‡ inline card
            if (missing && missing.length > 0) {
                setMissingIngredients(missing)
            }

            if (!suggestions || suggestions.length === 0) {
                if (missing && missing.length > 0) {
                    toast.error(`âŒ à¹„à¸¡à¹ˆà¸¡à¸µà¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸šà¹ƒà¸™à¸£à¸°à¸šà¸šà¹€à¸¥à¸¢ â€” à¸”à¸¹à¸£à¸²à¸¢à¸à¸²à¸£à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¹€à¸žà¸´à¹ˆà¸¡à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡`, { duration: 6000 })
                } else {
                    toast.error('AI à¹„à¸¡à¹ˆà¸žà¸šà¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸šà¸—à¸µà¹ˆà¸•à¸£à¸‡à¸à¸±à¸™ â€” à¸¥à¸­à¸‡à¸£à¸°à¸šà¸¸à¸Šà¸·à¹ˆà¸­à¹€à¸¡à¸™à¸¹à¹ƒà¸«à¹‰à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸‚à¸¶à¹‰à¸™')
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
                toast.success(`âœ¨ à¸žà¸š ${suggestions.length} à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š Â· âš ï¸ à¸‚à¸²à¸” ${missing.length} à¸£à¸²à¸¢à¸à¸²à¸£ (à¸”à¸¹à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡)`, { duration: 5000 })
            } else {
                toast.success(`âœ¨ AI à¹à¸™à¸°à¸™à¸³ BOM ${suggestions.length} à¸£à¸²à¸¢à¸à¸²à¸£ â€” à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹à¸¥à¸°à¸›à¸£à¸±à¸šà¹„à¸”à¹‰à¹€à¸¥à¸¢`)
            }
        } catch {
            toast.error('à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸•à¹ˆà¸­ AI à¹„à¸¡à¹ˆà¹„à¸”à¹‰')
        } finally {
            setAiLoading(false)
        }
    }

    // à¸ªà¹ˆà¸‡à¸„à¸³à¸•à¸­à¸š clarification à¸à¸¥à¸±à¸š AI
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
        if (!confirm(`à¸¥à¸šà¸ªà¸¹à¸•à¸£ "${name}" à¹ƒà¸Šà¹ˆà¹„à¸«à¸¡?\nà¸à¸²à¸£à¸¥à¸šà¸ˆà¸°à¹„à¸¡à¹ˆà¸à¸£à¸°à¸—à¸šà¸¢à¸­à¸”à¸‚à¸²à¸¢à¸«à¸£à¸·à¸­à¸ªà¸•à¹‡à¸­à¸„à¸—à¸µà¹ˆà¸œà¹ˆà¸²à¸™à¸¡à¸²`)) return
        setDeletingId(id)
        try {
            const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
            const json = await res.json()
            if (json.success) { toast.success('à¸¥à¸šà¸ªà¸¹à¸•à¸£à¹à¸¥à¹‰à¸§'); fetchRecipes() }
            else toast.error(json.error)
        } catch { toast.error('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”') }
        finally { setDeletingId(null) }
    }

    async function handleSave() {
        if (!menuName) return toast.error('à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸Šà¸·à¹ˆà¸­à¹€à¸¡à¸™à¸¹')
        const validBom = bom.filter(b => b.productId)
        if (validBom.length === 0) return toast.error('à¸à¸£à¸¸à¸“à¸²à¹€à¸žà¸´à¹ˆà¸¡à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸šà¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ 1 à¸£à¸²à¸¢à¸à¸²à¸£')
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
                toast.success(editId ? 'âœ… à¹à¸à¹‰à¹„à¸‚à¸ªà¸¹à¸•à¸£à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢' : 'âœ… à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸¹à¸•à¸£à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢')
                closeForm(); fetchRecipes()
            } else toast.error(json.error)
        } catch { toast.error('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”') }
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
                    <h1 className="page-title">ðŸ“‹ à¸ªà¸¹à¸•à¸£à¸­à¸²à¸«à¸²à¸£ (Recipe / BOM)</h1>
                    <p className="page-subtitle">
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{recipes.length}</span> à¸ªà¸¹à¸•à¸£ â€” match à¸à¸±à¸šà¸¢à¸­à¸”à¸‚à¸²à¸¢ POS à¹€à¸žà¸·à¹ˆà¸­à¸•à¸±à¸”à¸ªà¸•à¹‡à¸­à¸„à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´
                    </p>
                </div>
                <button onClick={() => showForm ? closeForm() : setShowForm(true)}
                    className={showForm ? 'btn-secondary' : 'btn-primary'}>
                    {showForm ? 'âœ• à¸›à¸´à¸”' : 'âž• à¹€à¸žà¸´à¹ˆà¸¡à¸ªà¸¹à¸•à¸£à¹ƒà¸«à¸¡à¹ˆ'}
                </button>
            </div>

            {/* BOM Alert Banner */}
            {(missingCount > 0 || incompleteCount > 0) && (
                <div style={{
                    background: 'rgba(245,158,11,0.06)', border: '1.5px solid rgba(245,158,11,0.35)',
                    borderRadius: 12, padding: '0.75rem 1rem', marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                    <span style={{ fontSize: '1.2rem' }}>âš ï¸</span>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#d97706' }}>
                            à¸žà¸šà¹€à¸¡à¸™à¸¹à¸—à¸µà¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µ BOM â€” à¸£à¸°à¸šà¸šà¸ˆà¸°à¸•à¸±à¸”à¸ªà¸•à¹‡à¸­à¸„à¹„à¸¡à¹ˆà¹„à¸”à¹‰!
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 2 }}>
                            {missingCount > 0 && <span>âŒ à¹„à¸¡à¹ˆà¸¡à¸µ BOM à¹€à¸¥à¸¢: <strong>{missingCount} à¹€à¸¡à¸™à¸¹</strong>{'  '}</span>}
                            {incompleteCount > 0 && <span>âš ï¸ BOM à¹„à¸¡à¹ˆà¸„à¸£à¸š: <strong>{incompleteCount} à¹€à¸¡à¸™à¸¹</strong></span>}
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
                        {showMissingOnly ? 'âœ• à¸”à¸¹à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”' : 'ðŸ” à¹à¸ªà¸”à¸‡à¹€à¸‰à¸žà¸²à¸°à¸—à¸µà¹ˆà¸‚à¸²à¸”'}
                    </button>
                </div>
            )}

            {/* Add Form */}
            {showForm && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                            {editId ? 'âœï¸ à¹à¸à¹‰à¹„à¸‚à¸ªà¸¹à¸•à¸£' : 'ðŸ†• à¸ªà¸£à¹‰à¸²à¸‡à¸ªà¸¹à¸•à¸£à¹ƒà¸«à¸¡à¹ˆ'}
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
                            {aiLoading ? 'â³ à¸à¸³à¸¥à¸±à¸‡à¸„à¸´à¸”...' : 'âœ¨ AI à¹à¸™à¸°à¸™à¸³ BOM'}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                        <div>
                            <label className="label">à¸Šà¸·à¹ˆà¸­à¹€à¸¡à¸™à¸¹ (à¸•à¸£à¸‡à¸à¸±à¸š POS) *</label>
                            <input value={menuName} onChange={e => setMenuName(e.target.value)} className="input"
                                placeholder="à¹€à¸Šà¹ˆà¸™ Heineken (à¸‚à¸§à¸”à¹ƒà¸«à¸à¹ˆ), à¹€à¸ªà¸·à¸­à¸£à¹‰à¸­à¸‡à¹„à¸«à¹‰ à¸¢à¹ˆà¸²à¸‡" />
                        </div>
                        <div>
                            <label className="label">à¸£à¸«à¸±à¸ª POS (à¸–à¹‰à¸²à¸¡à¸µ)</label>
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
                            ðŸ’¡ à¸à¸” <strong>âœ¨ AI à¹à¸™à¸°à¸™à¸³ BOM</strong> à¹ƒà¸«à¹‰ AI à¸„à¸³à¸™à¸§à¸“à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸šà¸ªà¸³à¸«à¸£à¸±à¸š &ldquo;{menuName}&rdquo; à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´
                        </div>
                    )}

                    {/* AI clarification question */}
                    {aiQuestion && (
                        <div style={{
                            background: 'rgba(124,58,237,0.06)', border: '1.5px solid rgba(124,58,237,0.25)',
                            borderRadius: 10, padding: '0.75rem 1rem', marginBottom: 12
                        }}>
                            <p style={{ fontSize: '0.82rem', color: '#7C3AED', fontWeight: 600, marginBottom: 8 }}>ðŸ’¬ {aiQuestion}</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                    className="input" style={{ fontSize: '0.82rem', flex: 1 }}
                                    placeholder="à¸•à¸­à¸šà¸—à¸µà¹ˆà¸™à¸µà¹ˆ..."
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
                                    à¸ªà¹ˆà¸‡
                                </button>
                                <button onClick={() => setAiQuestion(null)}
                                    style={{ padding: '0 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    âœ•
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
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>à¸„à¸¥à¸±à¸‡</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>à¸›à¸£à¸´à¸¡à¸²à¸“</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>à¸«à¸™à¹ˆà¸§à¸¢</span>
                            <span />
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: bom.length > 0 ? 6 : 10 }}>
                        <h4 style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            ðŸ¥© à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š (à¸•à¹ˆà¸­ 1 à¹€à¸¡à¸™à¸¹) â€” {bom.filter(b => b.productId).length} à¸£à¸²à¸¢à¸à¸²à¸£
                        </h4>
                        <button onClick={addBomItem} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.875rem' }}>
                            âž• à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸­à¸‡
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
                                    <ProductCombobox
                                        products={products}
                                        value={item.productId}
                                        usedIds={bom.map(b => b.productId)}
                                        onChange={(productId, unit) => {
                                            // Duplicate check
                                            const isDup = bom.some((b, idx) => idx !== i && b.productId === productId)
                                            if (isDup) {
                                                const dupName = products.find(p => p.id === productId)?.name || productId
                                                toast.error(`âš ï¸ "ðš¹ðš®" à¸¡à¸µà¹ƒà¸™ BOM à¹à¸¥à¹‰à¸§ â€” à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹€à¸žà¸´à¹ˆà¸¡à¸‹à¹‰à¸³à¹„à¸”à¹‰`.replace('ðš¹ðš®', dupName), { duration: 3500 })
                                                return
                                            }
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
                                        className="input" placeholder="à¸›à¸£à¸´à¸¡à¸²à¸“" min={0.001} step={0.001} style={{ fontSize: '0.82rem' }} />
                                    <input value={item.unit}
                                        onChange={e => { const nb = [...bom]; nb[i].unit = e.target.value; setBom(nb) }}
                                        className="input" placeholder="à¸«à¸™à¹ˆà¸§à¸¢" style={{ fontSize: '0.82rem' }} />
                                    <button onClick={() => setBom(bom.filter((_, idx) => idx !== i))}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }}>âœ•</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {bom.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--bg)', borderRadius: 10, border: '1px dashed var(--border)', marginBottom: 12 }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š â€” à¸à¸” âœ¨ AI à¹à¸™à¸°à¸™à¸³ à¸«à¸£à¸·à¸­ âž• à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸­à¸‡
                            </p>
                        </div>
                    )}

                    {/* â”€â”€ Missing Ingredients Card â€” Quick-Add inline â”€â”€ */}
                    {missingIngredients.length > 0 && (
                        <div style={{
                            background: 'rgba(245,158,11,0.04)', border: '1.5px solid rgba(245,158,11,0.35)',
                            borderRadius: 12, padding: '1rem', marginBottom: 12,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    ðŸš§ à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸šà¸—à¸µà¹ˆà¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¹ƒà¸™à¸£à¸°à¸šà¸š
                                    <span style={{ background: '#d97706', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '1px 7px', borderRadius: 20 }}>
                                        {missingIngredients.length} à¸£à¸²à¸¢à¸à¸²à¸£
                                    </span>
                                </p>
                                <button onClick={() => setMissingIngredients([])}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}>âœ•</button>
                            </div>
                            <p style={{ fontSize: '0.73rem', color: '#92400e', marginBottom: 10, lineHeight: 1.5 }}>
                                à¸à¸” <strong>âž• à¹€à¸žà¸´à¹ˆà¸¡</strong> à¹€à¸žà¸·à¹ˆà¸­à¹€à¸žà¸´à¹ˆà¸¡à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸šà¹€à¸‚à¹‰à¸²à¸£à¸°à¸šà¸šà¸—à¸±à¸™à¸—à¸µ à¹à¸¥à¹‰à¸§à¸à¸” âœ¨ AI à¹à¸™à¸°à¸™à¸³à¹ƒà¸«à¸¡à¹ˆ
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
                                            toast(`ðŸ”„ à¸à¸” âœ¨ AI à¹à¸™à¸°à¸™à¸³ à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡à¹€à¸žà¸·à¹ˆà¸­à¸­à¸±à¸žà¹€à¸”à¸— BOM`, { icon: 'ðŸ’¡', duration: 4000 })
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <button onClick={handleSave} disabled={saving || !menuName || bom.filter(b => b.productId).length === 0}
                            className="btn-primary" style={{ padding: '0.6rem 1.5rem' }}>
                            {saving ? 'â³...' : 'âœ… à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸¹à¸•à¸£'}
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div style={{ marginBottom: 14 }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="ðŸ” à¸„à¹‰à¸™à¸«à¸²à¹€à¸¡à¸™à¸¹..." className="input" style={{ width: 280 }} />
            </div>

            {/* Recipes list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--accent)' }}>â³ à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”...</div>
            ) : filtered.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: 8 }}>à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸ªà¸¹à¸•à¸£à¸­à¸²à¸«à¸²à¸£</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>à¹€à¸žà¸´à¹ˆà¸¡à¸ªà¸¹à¸•à¸£à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰à¸£à¸°à¸šà¸šà¸•à¸±à¸”à¸ªà¸•à¹‡à¸­à¸„à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¹€à¸¡à¸·à¹ˆà¸­ import à¸¢à¸­à¸”à¸‚à¸²à¸¢</p>
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
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>âŒ à¹„à¸¡à¹ˆà¸¡à¸µ BOM</span>
                                    )}
                                    {r.bomStatus === 'INCOMPLETE' && (
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>âš ï¸ BOM à¹„à¸¡à¹ˆà¸„à¸£à¸š</span>
                                    )}
                                    {r.bomStatus === 'OK' && (
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>âœ… {r.bom.length} à¸§à¸±à¸•à¸–à¸¸à¸”à¸´à¸š</span>
                                    )}
                                </div>
                                {/* Edit / Delete buttons */}
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        onClick={() => handleEdit(r)}
                                        title="à¹à¸à¹‰à¹„à¸‚à¸ªà¸¹à¸•à¸£"
                                        style={{
                                            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                                            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                                            fontSize: '0.78rem', color: '#3B82F6', fontWeight: 600, fontFamily: 'inherit',
                                        }}
                                    >
                                        âœï¸ à¹à¸à¹‰à¹„à¸‚
                                    </button>
                                    <button
                                        onClick={() => handleDelete(r.id, r.menuName)}
                                        disabled={deletingId === r.id}
                                        title="à¸¥à¸šà¸ªà¸¹à¸•à¸£"
                                        style={{
                                            background: 'rgba(232,54,78,0.06)', border: '1px solid rgba(232,54,78,0.2)',
                                            borderRadius: 8, padding: '4px 10px', cursor: deletingId === r.id ? 'not-allowed' : 'pointer',
                                            fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, fontFamily: 'inherit',
                                            opacity: deletingId === r.id ? 0.5 : 1,
                                        }}
                                    >
                                        {deletingId === r.id ? 'â³' : 'ðŸ—‘ï¸ à¸¥à¸š'}
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
                                        {b.product.name} Ã— {b.quantity} {b.unit}
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
