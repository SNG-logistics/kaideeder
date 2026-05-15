'use client'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface RawMaterial { id: string; name: string; sku: string; unit: string }
interface Location { id: string; name: string; code: string }

interface IngredientLine {
    rawMaterialId: string
    rawMaterialName: string
    rawMaterialSku: string
    rawMaterialUnit: string
    quantity: number
    unit: string
    locationId: string
    locationName: string
}
interface ToppingConfig {
    id: string
    name: string
    price: number
    isActive: boolean
    recipeId?: string | null
    ingredients: IngredientLine[]
}
interface SetupData {
    product: { id: string; name: string; sku: string }
    baseRecipeId: string | null
    baseIngredients: IngredientLine[]
    toppings: ToppingConfig[]
}
interface MenuProduct { id: string; name: string; sku: string; category: { name: string; icon: string } }

// ─── Ingredient Row Editor ─────────────────────────────────────────────────────
function IngredientEditor({
    ingredients, onChange, rawMaterials, locations
}: {
    ingredients: IngredientLine[]
    onChange: (v: IngredientLine[]) => void
    rawMaterials: RawMaterial[]
    locations: Location[]
}) {
    const [matSearch, setMatSearch] = useState('')
    const [showDrop, setShowDrop] = useState(false)

    function add(mat: RawMaterial) {
        const loc = locations[0]
        onChange([...ingredients, {
            rawMaterialId: mat.id,
            rawMaterialName: mat.name,
            rawMaterialSku: mat.sku,
            rawMaterialUnit: mat.unit,
            quantity: 1,
            unit: mat.unit,
            locationId: loc?.id || '',
            locationName: loc?.name || '',
        }])
        setMatSearch(''); setShowDrop(false)
    }
    function remove(idx: number) { onChange(ingredients.filter((_, i) => i !== idx)) }
    function update(idx: number, key: keyof IngredientLine, val: any) {
        onChange(ingredients.map((ing, i) => i === idx ? { ...ing, [key]: val } : ing))
    }

    const filtered = rawMaterials.filter(m =>
        m.name.toLowerCase().includes(matSearch.toLowerCase()) ||
        m.sku.toLowerCase().includes(matSearch.toLowerCase())
    ).slice(0, 12)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ingredients.map((ing, idx) => (
                <div key={idx} style={{
                    display: 'grid', gridTemplateColumns: '1fr 80px 80px 1fr 32px',
                    gap: 6, alignItems: 'center',
                    background: '#F0FDF4', borderRadius: 8, padding: '6px 10px',
                    border: '1px solid #BBF7D0',
                }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#065f46' }}>
                        {ing.rawMaterialName}
                        <span style={{ color: '#9CA3AF', fontWeight: 400, marginLeft: 4, fontSize: '0.7rem' }}>({ing.rawMaterialSku})</span>
                    </span>
                    <input type="number" value={ing.quantity} min={0.001} step={0.001}
                        onChange={e => update(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        style={{ padding: '4px 6px', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'inherit', textAlign: 'right', background: '#fff' }} />
                    <input value={ing.unit}
                        onChange={e => update(idx, 'unit', e.target.value)}
                        style={{ padding: '4px 6px', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'inherit', background: '#fff' }} />
                    <select value={ing.locationId} onChange={e => {
                        const loc = locations.find(l => l.id === e.target.value)
                        update(idx, 'locationId', e.target.value)
                        if (loc) update(idx, 'locationName', loc.name)
                    }} style={{ padding: '4px 6px', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', background: '#fff' }}>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <button onClick={() => remove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '1rem', padding: 0 }}>✕</button>
                </div>
            ))}
            <div style={{ position: 'relative' }}>
                <input value={matSearch}
                    onChange={e => { setMatSearch(e.target.value); setShowDrop(true) }}
                    onFocus={() => setShowDrop(true)}
                    onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                    placeholder="🔍 ค้นหาวัตถุดิบ เช่น ข้าวสวย หมูสับ..."
                    style={{ width: '100%', padding: '7px 12px', border: '1.5px dashed #10B981', borderRadius: 8, fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                {showDrop && filtered.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #BBF7D0', borderRadius: 8, zIndex: 100, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                        {filtered.map(m => (
                            <div key={m.id} onMouseDown={() => add(m)}
                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid #F3F4F6' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#F0FDF4')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <span style={{ fontWeight: 700, color: '#059669' }}>{m.sku}</span> — {m.name}
                                <span style={{ color: '#9CA3AF', fontSize: '0.7rem', marginLeft: 6 }}>({m.unit})</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StockSetupPage() {
    const [menus, setMenus] = useState<MenuProduct[]>([])
    const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [setup, setSetup] = useState<SetupData | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')

    // Load menus + raw materials + locations
    useEffect(() => {
        // โหลดเมนูขาย (SALE_ITEM)
        fetch('/api/products?limit=500&productType=SALE_ITEM').then(r => r.json()).then(j => {
            if (j.success) setMenus(j.data.products)
        })
        // โหลดวัตถุดิบ (RAW_MATERIAL + PACKAGING)
        Promise.all([
            fetch('/api/products?limit=500&productType=RAW_MATERIAL').then(r => r.json()),
            fetch('/api/products?limit=500&productType=PACKAGING').then(r => r.json()),
        ]).then(([rm, pkg]) => {
            const combined = [
                ...(rm.success ? rm.data.products : []),
                ...(pkg.success ? pkg.data.products : []),
            ]
            setRawMaterials(combined)
        })
        fetch('/api/locations').then(r => r.json()).then(j => {
            if (j.success) setLocations(j.data)
        })
    }, [])

    const loadSetup = useCallback(async (productId: string) => {
        setLoading(true)
        setSetup(null)
        try {
            const res = await fetch(`/api/stock-setup/${productId}`)
            const j = await res.json()
            if (j.success) setSetup(j.data)
            else toast.error(j.error || 'โหลดข้อมูลไม่สำเร็จ')
        } finally { setLoading(false) }
    }, [])

    function selectMenu(id: string) {
        setSelectedId(id)
        loadSetup(id)
    }

    async function handleSave() {
        if (!setup || !selectedId) return
        setSaving(true)
        try {
            const res = await fetch(`/api/stock-setup/${selectedId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseIngredients: setup.baseIngredients,
                    toppings: setup.toppings,
                }),
            })
            const j = await res.json()
            if (j.success) { toast.success('✅ บันทึกสูตรเรียบร้อย'); loadSetup(selectedId) }
            else toast.error(j.error || 'บันทึกไม่สำเร็จ')
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    function addTopping() {
        if (!setup) return
        setSetup({
            ...setup,
            toppings: [...setup.toppings, {
                id: Date.now().toString(36),
                name: '',
                price: 0,
                isActive: true,
                ingredients: [],
            }],
        })
    }
    function removeTopping(idx: number) {
        if (!setup) return
        setSetup({ ...setup, toppings: setup.toppings.filter((_, i) => i !== idx) })
    }
    function updateTopping(idx: number, key: keyof ToppingConfig, val: any) {
        if (!setup) return
        setSetup({ ...setup, toppings: setup.toppings.map((t, i) => i === idx ? { ...t, [key]: val } : t) })
    }

    const filteredMenus = menus.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.sku.toLowerCase().includes(search.toLowerCase())
    )

    const selectedMenu = menus.find(m => m.id === selectedId)

    return (
        <div className="page-container" style={{ maxWidth: 1400, padding: 0 }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '2px solid #D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h1 className="page-title" style={{ color: '#065F46' }}>🧾 ตั้งสูตรตัดสต็อค</h1>
                    <p className="page-subtitle">เลือกเมนู → กำหนดวัตถุดิบหลัก + ท็อปปิ้งแต่ละตัว</p>
                </div>
            </div>

            <div style={{ display: 'flex', height: 'calc(100vh - 130px)' }}>
                {/* ── Left: Menu List ─────────────────────────────── */}
                <div style={{ width: 280, minWidth: 280, borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB' }}>
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="🔍 ค้นหาเมนู..."
                            style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1FAE5', borderRadius: 8, fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {filteredMenus.map(m => {
                            const active = m.id === selectedId
                            return (
                                <div key={m.id} onClick={() => selectMenu(m.id)}
                                    style={{
                                        padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                                        background: active ? '#ECFDF5' : 'transparent',
                                        borderLeft: active ? '3px solid #059669' : '3px solid transparent',
                                        transition: 'all 0.12s',
                                    }}
                                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: active ? 700 : 500, color: active ? '#065f46' : '#1A1D26' }}>
                                        {m.category?.icon} {m.name}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: '#9CA3AF', fontFamily: 'monospace' }}>{m.sku}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* ── Right: Setup Editor ──────────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                    {!selectedId && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: '#9CA3AF' }}>
                            <span style={{ fontSize: '4rem' }}>🍽️</span>
                            <span style={{ fontSize: '1rem', fontWeight: 600 }}>เลือกเมนูทางซ้ายเพื่อตั้งสูตร</span>
                        </div>
                    )}
                    {selectedId && loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2rem', color: '#9CA3AF' }}>
                            <div style={{ width: 24, height: 24, border: '3px solid #E5E7EB', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            กำลังโหลดสูตร...
                        </div>
                    )}
                    {selectedId && !loading && setup && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
                            {/* Menu name header */}
                            <div style={{ background: 'linear-gradient(135deg,#059669,#10B981)', borderRadius: 14, padding: '14px 18px', color: '#fff' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{selectedMenu?.category?.icon} {setup.product.name}</div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: 2 }}>SKU: {setup.product.sku}</div>
                            </div>

                            {/* ── วัตถุดิบหลัก ── */}
                            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #BBF7D0', overflow: 'hidden' }}>
                                <div style={{ background: '#F0FDF4', padding: '12px 16px', borderBottom: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '1.1rem' }}>🍚</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#065f46' }}>วัตถุดิบหลัก (Base Recipe)</div>
                                        <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>วัตถุดิบที่ตัดทุกครั้งที่ขายเมนูนี้</div>
                                    </div>
                                </div>
                                <div style={{ padding: '14px 16px' }}>
                                    {/* Column headers */}
                                    {setup.baseIngredients.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 1fr 32px', gap: 6, marginBottom: 4, paddingLeft: 10 }}>
                                            {['วัตถุดิบ', 'ปริมาณ', 'หน่วย', 'คลัง', ''].map(h => (
                                                <span key={h} style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>{h}</span>
                                            ))}
                                        </div>
                                    )}
                                    <IngredientEditor
                                        ingredients={setup.baseIngredients}
                                        onChange={v => setSetup({ ...setup, baseIngredients: v })}
                                        rawMaterials={rawMaterials}
                                        locations={locations}
                                    />
                                    {setup.baseIngredients.length === 0 && (
                                        <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '0.8rem', padding: '12px 0', border: '1.5px dashed #BBF7D0', borderRadius: 8 }}>
                                            ยังไม่มีวัตถุดิบหลัก — ค้นหาด้านล่างเพื่อเพิ่ม
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── ท็อปปิ้ง ── */}
                            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #FDE68A', overflow: 'hidden' }}>
                                <div style={{ background: '#FFFBEB', padding: '12px 16px', borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '1.1rem' }}>🌶️</span>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#92400E' }}>ท็อปปิ้ง / โปรตีน</div>
                                            <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>แต่ละตัวมีวัตถุดิบตัดสต็อคของตัวเอง</div>
                                        </div>
                                    </div>
                                    <button onClick={addTopping} style={{
                                        padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                        background: '#F59E0B', color: '#fff', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'inherit',
                                    }}>+ เพิ่มท็อปปิ้ง</button>
                                </div>
                                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {setup.toppings.length === 0 && (
                                        <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '0.8rem', padding: '12px 0', border: '1.5px dashed #FDE68A', borderRadius: 8 }}>
                                            ยังไม่มีท็อปปิ้ง — กดปุ่ม "+ เพิ่มท็อปปิ้ง" ด้านบน
                                        </div>
                                    )}
                                    {setup.toppings.map((top, idx) => (
                                        <div key={top.id} style={{ border: '1px solid #FDE68A', borderRadius: 10, overflow: 'hidden' }}>
                                            {/* Topping header row */}
                                            <div style={{ background: '#FFFBEB', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <button onClick={() => updateTopping(idx, 'isActive', !top.isActive)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>
                                                    {top.isActive ? '🟡' : '⚫'}
                                                </button>
                                                <input value={top.name} onChange={e => updateTopping(idx, 'name', e.target.value)}
                                                    placeholder="ชื่อท็อปปิ้ง เช่น หมู ไก่ กุ้ง ไข่ดาว"
                                                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #FDE68A', borderRadius: 6, fontSize: '0.88rem', fontWeight: 700, fontFamily: 'inherit', background: '#fff', color: '#92400E' }} />
                                                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>ราคา +</span>
                                                <input type="number" value={top.price} onChange={e => updateTopping(idx, 'price', parseFloat(e.target.value) || 0)}
                                                    style={{ width: 80, padding: '5px 8px', border: '1px solid #FDE68A', borderRadius: 6, fontSize: '0.82rem', fontFamily: 'inherit', textAlign: 'right', background: '#fff' }} />
                                                <button onClick={() => removeTopping(idx)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '1rem', padding: 0 }}>✕</button>
                                            </div>
                                            {/* Topping ingredients */}
                                            <div style={{ padding: '10px 12px', background: '#fff' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: 6, fontWeight: 600 }}>↳ วัตถุดิบที่ตัดเมื่อเลือกท็อปปิ้งนี้:</div>
                                                {top.ingredients.length > 0 && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 1fr 32px', gap: 6, marginBottom: 4, paddingLeft: 10 }}>
                                                        {['วัตถุดิบ', 'ปริมาณ', 'หน่วย', 'คลัง', ''].map(h => (
                                                            <span key={h} style={{ fontSize: '0.65rem', color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>{h}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                <IngredientEditor
                                                    ingredients={top.ingredients}
                                                    onChange={v => updateTopping(idx, 'ingredients', v)}
                                                    rawMaterials={rawMaterials}
                                                    locations={locations}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Summary preview */}
                            {(setup.baseIngredients.length > 0 || setup.toppings.some(t => t.ingredients.length > 0)) && (
                                <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '12px 16px', border: '1px solid #BBF7D0' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#065f46', marginBottom: 8 }}>📋 สรุปการตัดสต็อค</div>
                                    {setup.baseIngredients.length > 0 && (
                                        <div style={{ fontSize: '0.78rem', color: '#374151', marginBottom: 6 }}>
                                            <span style={{ fontWeight: 600 }}>เมนูหลัก:</span>{' '}
                                            {setup.baseIngredients.map(i => `${i.rawMaterialName} ${i.quantity}${i.unit}`).join(' + ')}
                                        </div>
                                    )}
                                    {setup.toppings.filter(t => t.name && t.ingredients.length > 0).map(t => (
                                        <div key={t.id} style={{ fontSize: '0.78rem', color: '#374151' }}>
                                            <span style={{ fontWeight: 600 }}>+ เลือก {t.name}:</span>{' '}
                                            {t.ingredients.map(i => `${i.rawMaterialName} ${i.quantity}${i.unit}`).join(' + ')}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Save button */}
                            <button onClick={handleSave} disabled={saving}
                                style={{
                                    padding: '12px 24px', borderRadius: 12, border: 'none', cursor: saving ? 'wait' : 'pointer',
                                    background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff',
                                    fontWeight: 800, fontSize: '1rem', fontFamily: 'inherit',
                                    boxShadow: '0 4px 14px rgba(5,150,105,0.4)',
                                    transition: 'all 0.18s',
                                }}>
                                {saving ? '⏳ กำลังบันทึก...' : '✅ บันทึกสูตร'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
