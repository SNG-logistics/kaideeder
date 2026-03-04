'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useCallback, useRef, type ChangeEvent, type DragEvent } from 'react'
import { formatLAK, formatNumber } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Product {
    id: string; sku: string; name: string; unit: string; unitAlt?: string
    convFactor?: number; costPrice: number; salePrice: number
    productType: string; reorderPoint: number; minQty: number; note?: string
    imageUrl?: string
    category: { id: string; code: string; name: string; icon: string; color: string }
    inventory?: { quantity: number; avgCost: number; location: { code: string; name: string } }[]
}
interface Category { id: string; code: string; name: string; icon: string; color: string; _count: { products: number } }

const typeLabels: Record<string, string> = {
    SALE_ITEM: '🏷️ สินค้าขาย', RAW_MATERIAL: '🥩 วัตถุดิบ',
    PACKAGING: '📦 บรรจุภัณฑ์', ENTERTAIN: '🎭 Entertain',
}

const DRINK_CODES = ['BEER', 'BEER_DRAFT', 'WINE', 'COCKTAIL', 'DRINK', 'WATER', 'KARAOKE', 'ENTERTAIN', 'SET']
const MEAT_CODES = ['RAW_MEAT', 'RAW_PORK', 'RAW_SEA', 'EGG']
const VEG_CODES = ['RAW_VEG', 'DRY_GOODS', 'OTHER', 'DAIRY', 'CHEESE', 'FLOUR_DOUGH']
const PKG_CODES = ['PACKAGING']
const RAW_CATEGORY_CODES = [...MEAT_CODES, ...VEG_CODES, ...PKG_CODES, ...DRINK_CODES]
const STOCK_TYPES = ['RAW_MATERIAL', 'PACKAGING']

type TabKey = 'meat' | 'veg' | 'pkg' | 'drink' | 'all'

export default function ProductsPage() {
    useRoleGuard(['owner', 'manager', 'cashier', 'warehouse'])
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [allCategories, setAllCategories] = useState<Category[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedCat, setSelectedCat] = useState('')
    const [selectedType, setSelectedType] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editProduct, setEditProduct] = useState<Product | null>(null)
    const [showExportMenu, setShowExportMenu] = useState(false)
    const [activeTab, setActiveTab] = useState<TabKey>('meat')
    const [isMobile, setIsMobile] = useState(false)
    const [photoProduct, setPhotoProduct] = useState<Product | null>(null)
    const [showImportRaw, setShowImportRaw] = useState(false)

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (selectedCat) params.set('categoryId', selectedCat)
        if (selectedType) params.set('productType', selectedType)
        params.set('limit', '200')
        const res = await fetch(`/api/products?${params}`)
        const json = await res.json()
        if (json.success) { setProducts(json.data.products); setTotal(json.data.total) }
        setLoading(false)
    }, [search, selectedCat, selectedType])

    useEffect(() => { fetchProducts() }, [fetchProducts])
    useEffect(() => {
        fetch('/api/categories').then(r => r.json()).then(j => {
            if (j.success) setAllCategories(j.data)
        })
    }, [])

    useEffect(() => {
        if (activeTab === 'meat') {
            setCategories(allCategories.filter(c => MEAT_CODES.includes(c.code)))
        } else if (activeTab === 'veg') {
            setCategories(allCategories.filter(c => VEG_CODES.includes(c.code)))
        } else if (activeTab === 'pkg') {
            setCategories(allCategories.filter(c => PKG_CODES.includes(c.code)))
        } else if (activeTab === 'drink') {
            setCategories(allCategories.filter(c => DRINK_CODES.includes(c.code)))
        } else {
            setCategories(allCategories.filter(c => RAW_CATEGORY_CODES.includes(c.code)))
        }
        setSelectedCat('')
    }, [activeTab, allCategories])

    const filteredProducts = products.filter(p => {
        // Drink tab: show all regardless of productType (beer/wine/drinks are SALE_ITEM but physically stocked)
        if (activeTab === 'drink') return DRINK_CODES.includes(p.category?.code)
        // Other tabs: only raw materials and packaging
        if (!STOCK_TYPES.includes(p.productType)) return false
        if (activeTab === 'meat') return MEAT_CODES.includes(p.category?.code)
        if (activeTab === 'veg') return VEG_CODES.includes(p.category?.code)
        if (activeTab === 'pkg') return PKG_CODES.includes(p.category?.code)
        return true
    })

    const tabs: { key: TabKey; label: string; icon: string }[] = [
        { key: 'meat', label: 'เนื้อ / โปรตีน', icon: '🥩' },
        { key: 'veg', label: 'ผัก / ของแห้ง', icon: '🥬' },
        { key: 'drink', label: 'เครื่องดื่ม', icon: '🍺' },
        { key: 'pkg', label: 'บรรจุภัณฑ์', icon: '📦' },
        { key: 'all', label: 'ทั้งหมด', icon: '📋' },
    ]

    return (
        <div className="page-container" style={{ maxWidth: 1280 }}>
            {/* Header */}
            <div style={{
                display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'flex-start',
                justifyContent: 'space-between',
                gap: 12, marginBottom: '1.25rem', paddingBottom: '1rem',
                borderBottom: '2px solid var(--border)',
            }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: isMobile ? '1.2rem' : undefined }}>🥩 วัตถุดิบ / คลังสต็อค</h1>
                    <p className="page-subtitle">วัตถุดิบ เนื้อสัตว์ ผัก บรรจุภัณฑ์ — <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{total}</span> รายการ</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowExportMenu(prev => !prev)}
                            className="btn-secondary"
                            style={{ minHeight: 44, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}
                        >
                            📥 Export Excel
                        </button>
                        {showExportMenu && (
                            <div style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                                background: 'var(--white)', border: '1px solid var(--border)',
                                borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                zIndex: 30, minWidth: 200, overflow: 'hidden',
                            }}>
                                {[
                                    { label: '📦 ทั้งหมด', type: 'all' },
                                    { label: '🥩 วัตถุดิบ (นับสต็อค)', type: 'raw' },
                                    { label: '🛒 สินค้าขาย', type: 'sale' },
                                ].map(opt => (
                                    <button
                                        key={opt.type}
                                        onClick={() => {
                                            window.open(`/api/products/export?type=${opt.type}`, '_blank')
                                            setShowExportMenu(false)
                                        }}
                                        style={{
                                            display: 'block', width: '100%', textAlign: 'left',
                                            padding: '0.7rem 1rem', border: 'none',
                                            background: 'transparent', cursor: 'pointer',
                                            fontSize: '0.85rem', fontFamily: 'inherit',
                                            borderBottom: '1px solid var(--border-light)',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#F8F9FC')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Import Button */}
                    <button
                        onClick={() => setShowImportRaw(true)}
                        style={{
                            minHeight: 44, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                            padding: '0.5rem 1rem', borderRadius: 10, cursor: 'pointer',
                            background: '#fff', border: '1.5px solid var(--accent)',
                            color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F0FDF4')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >
                        📂 Import Excel
                    </button>
                    <button onClick={() => { setEditProduct(null); setShowForm(true) }} className="btn-primary" style={{ minHeight: 44, whiteSpace: 'nowrap' }}>➕ เพิ่มวัตถุดิบ</button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 14, background: 'var(--white)',
                borderRadius: 12, padding: 4, border: '1px solid var(--border)',
                width: isMobile ? '100%' : 'fit-content',
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: isMobile ? '8px 12px' : '8px 20px',
                            borderRadius: 10, fontSize: '0.82rem',
                            fontWeight: activeTab === tab.key ? 700 : 500,
                            cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                            background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
                            color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                            transition: 'all 0.18s ease',
                            boxShadow: activeTab === tab.key ? '0 2px 8px rgba(232,54,78,0.25)' : 'none',
                            flex: isMobile ? 1 : undefined,
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Category chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                <button onClick={() => setSelectedCat('')}
                    style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                        background: !selectedCat ? 'var(--accent)' : 'var(--white)',
                        color: !selectedCat ? 'white' : 'var(--text-secondary)',
                        border: !selectedCat ? 'none' : '1px solid var(--border)',
                        transition: 'all 0.15s', minHeight: 32,
                    }}>ทั้งหมด</button>
                {categories.map(c => (
                    <button key={c.id} onClick={() => setSelectedCat(selectedCat === c.id ? '' : c.id)}
                        style={{
                            padding: '6px 14px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                            background: selectedCat === c.id ? (c.color || 'var(--accent)') : 'var(--white)',
                            color: selectedCat === c.id ? 'white' : 'var(--text-secondary)',
                            border: selectedCat === c.id ? 'none' : '1px solid var(--border)',
                            transition: 'all 0.15s', minHeight: 32,
                        }}>{c.icon} {c.name} ({c._count.products})</button>
                ))}
            </div>

            {/* Filter bar */}
            <div className="card" style={{
                padding: '0.75rem 1rem', marginBottom: 14,
                display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
            }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 ค้นหาชื่อ, SKU..." className="input"
                    style={{ width: isMobile ? '100%' : 200, minHeight: 40 }} />
                {!isMobile && (
                    <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="input" style={{ width: 180, minHeight: 40 }}>
                        <option value="">ทุกประเภท</option>
                        {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                )}
                <button onClick={() => { setSearch(''); setSelectedCat(''); setSelectedType('') }} className="btn-secondary" style={{ fontSize: '0.8rem', minHeight: 40 }}>🔄 รีเซ็ต</button>
            </div>

            {/* Content: Table on desktop, Cards on mobile */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: 10 }}>
                    <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>กำลังโหลด...</span>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: 8 }}>
                    <span style={{ fontSize: '2.5rem' }}>📭</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>ไม่พบสินค้า</span>
                </div>
            ) : isMobile ? (
                /* Mobile: Card list */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredProducts.map(p => {
                        const totalQty = p.inventory?.reduce((s, i) => s + i.quantity, 0) || 0
                        const isLow = totalQty <= p.minQty && p.minQty > 0
                        return (
                            <div key={p.id} className="card" style={{ padding: '0.75rem', display: 'flex', gap: 10, alignItems: 'center' }}
                                onClick={() => { setEditProduct(p); setShowForm(true) }}
                            >
                                {/* Image — tap to change photo */}
                                <div style={{ position: 'relative', flexShrink: 0 }}
                                    onClick={e => { e.stopPropagation(); setPhotoProduct(p) }}
                                >
                                    {p.imageUrl ? (
                                        <img src={p.imageUrl} alt={p.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                                    ) : (
                                        <div style={{
                                            width: 48, height: 48, borderRadius: 10,
                                            background: (p.category.color || '#E8364E') + '15',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.4rem',
                                        }}>
                                            {p.category.icon}
                                        </div>
                                    )}
                                    <div style={{
                                        position: 'absolute', inset: 0, borderRadius: 10,
                                        background: 'rgba(0,0,0,0.45)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1rem', opacity: 0.85,
                                    }}>📷</div>
                                </div>
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                    <div style={{ display: 'flex', gap: 8, fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                        <span style={{ fontFamily: 'monospace' }}>{p.sku}</span>
                                        <span>{p.category.name}</span>
                                    </div>
                                </div>
                                {/* Right */}
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>{formatLAK(p.salePrice)}</div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: isLow ? '#EF4444' : 'var(--text-secondary)', marginTop: 2 }}>
                                        {formatNumber(totalQty, 1)} {p.unit}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* Desktop: Table */
                <div className="table-container">
                    <table style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: 56 }}>รูป</th>
                                <th>SKU</th><th>ชื่อสินค้า</th><th>หมวด</th><th>ประเภท</th>
                                <th>หน่วย</th><th style={{ textAlign: 'right' }}>ต้นทุน</th><th style={{ textAlign: 'right' }}>ขาย</th>
                                <th style={{ textAlign: 'right' }}>สต็อครวม</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(p => {
                                const totalQty = p.inventory?.reduce((s, i) => s + i.quantity, 0) || 0
                                const isLow = totalQty <= p.minQty && p.minQty > 0
                                return (
                                    <tr key={p.id}>
                                        <td style={{ padding: '6px 8px' }}>
                                            <div style={{ position: 'relative', width: 40, height: 40, cursor: 'pointer' }}
                                                onClick={() => setPhotoProduct(p)}
                                                title="คลิกเพื่อเปลี่ยนรูปสินค้า"
                                            >
                                                {p.imageUrl ? (
                                                    <img src={p.imageUrl} alt={p.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                                                ) : (
                                                    <div style={{
                                                        width: 40, height: 40, borderRadius: 8,
                                                        background: (p.category.color || '#E8364E') + '15',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '1.2rem',
                                                    }}>
                                                        {p.category.icon}
                                                    </div>
                                                )}
                                                <div style={{
                                                    position: 'absolute', inset: 0, borderRadius: 8,
                                                    background: 'rgba(0,0,0,0)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.9rem', transition: 'background 0.15s',
                                                }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.45)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
                                                >📷</div>
                                            </div>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{p.sku}</td>
                                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                                        <td><span style={{
                                            background: (p.category.color || '#E8364E') + '12',
                                            color: p.category.color || 'var(--accent)',
                                            fontSize: '0.72rem', fontWeight: 600,
                                            padding: '3px 10px', borderRadius: 10,
                                        }}>{p.category.icon} {p.category.name}</span></td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{typeLabels[p.productType]}</td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{p.unit}{p.unitAlt ? ` / ${p.unitAlt}` : ''}</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem' }}>{formatLAK(p.costPrice)}</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: '#059669' }}>{formatLAK(p.salePrice)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: isLow ? '#EF4444' : 'var(--accent)' }}>
                                            {formatNumber(totalQty, 1)} {p.unit}
                                        </td>
                                        <td>
                                            <button onClick={() => { setEditProduct(p); setShowForm(true) }}
                                                style={{
                                                    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                                                    borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                                                    fontSize: '0.78rem', color: '#3B82F6', fontWeight: 600, fontFamily: 'inherit',
                                                    whiteSpace: 'nowrap', transition: 'all 0.15s',
                                                }}>✏️ แก้ไข</button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {photoProduct && (
                <PhotoCaptureModal
                    product={photoProduct}
                    onClose={() => setPhotoProduct(null)}
                    onDone={() => { setPhotoProduct(null); fetchProducts() }}
                />
            )}

            {showForm && (
                <ProductModal
                    product={editProduct}
                    categories={allCategories}
                    onClose={() => { setShowForm(false); setEditProduct(null) }}
                    onSaved={() => { setShowForm(false); setEditProduct(null); fetchProducts() }}
                />
            )}

            {showImportRaw && (
                <ImportRawModal
                    onClose={() => setShowImportRaw(false)}
                    onDone={() => { setShowImportRaw(false); fetchProducts() }}
                />
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

function ProductModal({ product, categories, onClose, onSaved }: {
    product: Product | null; categories: { id: string; name: string; icon: string }[]
    onClose: () => void; onSaved: () => void
}) {
    const isEdit = !!product
    const [form, setForm] = useState({
        sku: product?.sku || '', name: product?.name || '',
        categoryId: product?.category?.id || categories[0]?.id || '',
        productType: product?.productType || 'RAW_MATERIAL',
        unit: product?.unit || 'ขวด', unitAlt: product?.unitAlt || '',
        convFactor: product?.convFactor || 0,
        costPrice: product?.costPrice || 0, salePrice: product?.salePrice || 0,
        reorderPoint: product?.reorderPoint || 0, minQty: product?.minQty || 0,
        note: product?.note || '',
    })
    const [saving, setSaving] = useState(false)
    const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl || null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [skuLoading, setSkuLoading] = useState(false)

    // Auto-fetch next SKU when category changes (only for new products)
    useEffect(() => {
        if (isEdit || !form.categoryId) return
        setSkuLoading(true)
        fetch(`/api/products/next-sku?categoryId=${form.categoryId}`)
            .then(r => r.json())
            .then(json => {
                if (json.success) {
                    setForm(f => ({ ...f, sku: json.data.nextSku }))
                }
            })
            .catch(() => { })
            .finally(() => setSkuLoading(false))
    }, [form.categoryId, isEdit])

    async function handleSave() {
        if (!form.name.trim()) { toast.error('กรุณากรอกชื่อสินค้า'); return }
        setSaving(true)
        try {
            const url = isEdit ? `/api/products/${product.id}` : '/api/products'
            const method = isEdit ? 'PATCH' : 'POST'
            const payload = {
                ...form,
                sku: form.sku.trim() || `AUTO-${Date.now()}`,
                costPrice: Number(form.costPrice) || 0,
                salePrice: Number(form.salePrice) || 0,
                convFactor: Number(form.convFactor) || 0,
                reorderPoint: Number(form.reorderPoint) || 0,
                minQty: Number(form.minQty) || 0,
            }
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            const json = await res.json()
            if (json.success) { toast.success(isEdit ? 'แก้ไขเรียบร้อย' : 'เพิ่มสินค้าเรียบร้อย'); onSaved() }
            else toast.error(json.error || 'บันทึกไม่สำเร็จ')
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !isEdit || !product) return
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('image', file)
            const res = await fetch(`/api/products/${product.id}/image`, { method: 'POST', body: formData })
            const json = await res.json()
            if (json.success) {
                setImagePreview(json.data.imageUrl)
                toast.success('อัปโหลดรูปภาพสำเร็จ')
            } else {
                toast.error(json.error || 'อัปโหลดไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาดในการอัปโหลด')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }} onClick={onClose}>
            <div style={{
                background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 540,
                padding: '1.5rem', boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
                border: '1px solid var(--border)', maxHeight: '92vh', overflowY: 'auto',
                position: 'relative',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent)', borderRadius: '20px 20px 0 0' }} />

                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginBottom: 16, paddingTop: 8 }}>
                    {isEdit ? '✏️ แก้ไขสินค้า' : '➕ เพิ่มสินค้าใหม่'}
                </h2>

                {/* Image Upload Section */}
                {isEdit && (
                    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div>
                            {imagePreview ? (
                                <img src={imagePreview} alt="Product" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--border)' }} />
                            ) : (
                                <div style={{
                                    width: 72, height: 72, borderRadius: 12,
                                    background: '#F3F4F6', border: '2px dashed var(--border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.8rem', color: 'var(--text-secondary)',
                                }}>📷</div>
                            )}
                        </div>
                        <div>
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                style={{
                                    padding: '7px 14px', borderRadius: 8,
                                    border: '1px solid var(--border)',
                                    background: 'var(--white)', cursor: uploading ? 'wait' : 'pointer',
                                    fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit',
                                    color: 'var(--text-secondary)', transition: 'all 0.15s', minHeight: 36,
                                }}
                            >
                                {uploading ? '⏳ อัปโหลด...' : '📸 เปลี่ยนรูป'}
                            </button>
                            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 4 }}>JPEG, PNG, WebP • ไม่เกิน 5MB</p>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <label className="label">SKU <span style={{ color: '#059669', fontWeight: 500 }}>{!isEdit && form.sku ? '✓ อัตโนมัติ' : ''}</span></label>
                            <input
                                value={skuLoading ? '...' : form.sku}
                                readOnly={!isEdit}
                                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                                className="input"
                                style={{
                                    minHeight: 40,
                                    background: isEdit ? 'var(--white)' : '#F3F4F6',
                                    fontWeight: 700,
                                    letterSpacing: '0.05em',
                                    color: form.sku ? 'var(--accent)' : '#9CA3AF',
                                }}
                            />
                        </div>
                        <div><label className="label">ชื่อสินค้า</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" style={{ minHeight: 40 }} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><label className="label">หมวดหมู่</label>
                            <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className="input" style={{ minHeight: 40 }}>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                            </select></div>
                        <div><label className="label">ประเภท</label>
                            <select value={form.productType} onChange={e => setForm(f => ({ ...f, productType: e.target.value }))} className="input" style={{ minHeight: 40 }}>
                                <option value="SALE_ITEM">สินค้าขาย</option>
                                <option value="RAW_MATERIAL">วัตถุดิบ</option>
                                <option value="PACKAGING">บรรจุภัณฑ์</option>
                                <option value="ENTERTAIN">Entertain</option>
                            </select></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <div><label className="label">หน่วยหลัก</label><input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="input" style={{ minHeight: 40 }} /></div>
                        <div><label className="label">หน่วยรอง</label><input value={form.unitAlt} onChange={e => setForm(f => ({ ...f, unitAlt: e.target.value }))} className="input" placeholder="เช่น ตัว" style={{ minHeight: 40 }} /></div>
                        <div><label className="label">อัตราแปลง</label><input type="number" value={form.convFactor} onChange={e => setForm(f => ({ ...f, convFactor: parseFloat(e.target.value) || 0 }))} className="input" style={{ minHeight: 40 }} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><label className="label">ต้นทุน (LAK)</label><input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: parseFloat(e.target.value) || 0 }))} className="input" style={{ minHeight: 40 }} /></div>
                        <div><label className="label">ราคาขาย (LAK)</label><input type="number" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: parseFloat(e.target.value) || 0 }))} className="input" style={{ minHeight: 40 }} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><label className="label">จุดสั่งซื้อใหม่</label><input type="number" value={form.reorderPoint} onChange={e => setForm(f => ({ ...f, reorderPoint: parseFloat(e.target.value) || 0 }))} className="input" style={{ minHeight: 40 }} /></div>
                        <div><label className="label">สต็อคขั้นต่ำ</label><input type="number" value={form.minQty} onChange={e => setForm(f => ({ ...f, minQty: parseFloat(e.target.value) || 0 }))} className="input" style={{ minHeight: 40 }} /></div>
                    </div>
                    <div><label className="label">หมายเหตุ</label><input value={form.note || ''} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="input" style={{ minHeight: 40 }} /></div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    <button onClick={onClose} className="btn-secondary" style={{ flex: 1, minHeight: 44 }}>ยกเลิก</button>
                    <button onClick={handleSave} disabled={saving || !form.name} className="btn-success" style={{ flex: 1, minHeight: 44 }}>
                        {saving ? '⏳ กำลังบันทึก...' : isEdit ? '✅ บันทึก' : '➕ เพิ่ม'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ════════════════════════════════════════════════════════
// PHOTO CAPTURE MODAL — quick camera/upload for product photo
// ════════════════════════════════════════════════════════
function PhotoCaptureModal({ product, onClose, onDone }: {
    product: Product
    onClose: () => void
    onDone: () => void
}) {
    const [mode, setMode] = useState<'choose' | 'camera' | 'preview'>('choose')
    const [imageData, setImageData] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }
            })
            streamRef.current = stream
            if (videoRef.current) videoRef.current.srcObject = stream
            setMode('camera')
        } catch {
            toast.error('ไม่สามารถเปิดกล้องได้ กรุณาเปิดสิทธิ์กล้อง')
        }
    }, [])

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
    }, [])

    useEffect(() => () => stopCamera(), [stopCamera])

    const capture = () => {
        const video = videoRef.current
        if (!video) return
        const size = Math.min(video.videoWidth, video.videoHeight)
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, size, size)
        setImageData(canvas.toDataURL('image/jpeg', 0.9))
        stopCamera()
        setMode('preview')
    }

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = ev => { setImageData(ev.target?.result as string); setMode('preview') }
        reader.readAsDataURL(file)
    }

    const upload = async () => {
        if (!imageData) return
        setUploading(true)
        try {
            const res = await fetch(imageData)
            const blob = await res.blob()
            const file = new File([blob], `${product.id}.jpg`, { type: 'image/jpeg' })
            const formData = new FormData()
            formData.append('image', file)
            const apiRes = await fetch(`/api/products/${product.id}/image`, { method: 'POST', body: formData })
            const json = await apiRes.json()
            if (json.success) { toast.success(`✅ อัปโหลดรูป ${product.name} สำเร็จ`); onDone() }
            else toast.error(json.error || 'อัปโหลดไม่สำเร็จ')
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setUploading(false) }
    }

    const reset = () => { setImageData(null); setMode('choose'); stopCamera() }

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: '0.75rem', backdropFilter: 'blur(6px)',
        }} onClick={() => { stopCamera(); onClose() }}>
            <div style={{
                background: 'var(--white)', borderRadius: 18, width: '100%', maxWidth: 400,
                boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden',
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>📷 รูปสินค้า</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{product.name}</div>
                    </div>
                    <button onClick={() => { stopCamera(); onClose() }}
                        style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)' }}>✕</button>
                </div>

                <div style={{ padding: '1.1rem' }}>
                    {mode === 'choose' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <button onClick={startCamera} style={{
                                    padding: '1.75rem 0.75rem', borderRadius: 14, border: '2px dashed var(--border)',
                                    background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.18s',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(232,54,78,0.04)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}>
                                    <span style={{ fontSize: '1.8rem' }}>📷</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>ถ่ายรูป</span>
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} style={{
                                    padding: '1.75rem 0.75rem', borderRadius: 14, border: '2px dashed var(--border)',
                                    background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.18s',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = 'rgba(37,99,235,0.04)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}>
                                    <span style={{ fontSize: '1.8rem' }}>🖼️</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>อัปโหลด</span>
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
                            </div>
                            {product.imageUrl && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem', background: 'var(--bg)', borderRadius: 10 }}>
                                    <img src={product.imageUrl} alt={product.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>รูปปัจจุบัน — เลือกถ่ายหรืออัปโหลดเพื่อเปลี่ยน</div>
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'camera' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: '100%', borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '1/1' }}>
                                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                                <button onClick={reset} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>← กลับ</button>
                                <button onClick={capture} style={{ flex: 2, padding: '0.6rem', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer', fontFamily: 'inherit' }}>📸 ถ่ายรูป</button>
                            </div>
                        </div>
                    )}

                    {mode === 'preview' && imageData && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <img src={imageData} alt="preview" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
                            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                                <button onClick={reset} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>🔄 ใหม่</button>
                                <button onClick={upload} disabled={uploading} style={{ flex: 2, padding: '0.6rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff', fontWeight: 700, fontSize: '0.92rem', cursor: uploading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: uploading ? 0.7 : 1 }}>
                                    {uploading ? '⏳ กำลังอัปโหลด...' : '✅ ใช้รูปนี้'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Import Raw Materials Modal ───────────────────────────────────
type RawImportResult = { row: number; status: 'created' | 'skipped' | 'error'; name: string; category?: string; guessed?: boolean; reason?: string }
type RawImportSummary = { created: number; skipped: number; errors: number; autoMatched: number; total: number; results: RawImportResult[] }

function ImportRawModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [dragging, setDragging] = useState(false)
    const [importing, setImporting] = useState(false)
    const [summary, setSummary] = useState<RawImportSummary | null>(null)
    const [importError, setImportError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = (f: File) => {
        if (!f.name.match(/\.(xlsx|xls)$/i)) { setImportError('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls)'); return }
        setFile(f); setImportError(null); setSummary(null)
    }
    const onFilePick = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }
    const onDropFile = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); setDragging(false)
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
    }

    const doImport = async () => {
        if (!file) return
        setImporting(true); setImportError(null)
        const fd = new FormData(); fd.append('file', file)
        try {
            const res = await fetch('/api/products/import-raw', { method: 'POST', body: fd })
            const json = await res.json()
            if (json.success) { setSummary(json.data); toast.success(`✅ Import สำเร็จ ${json.data.created} รายการ`) }
            else setImportError(json.error || 'Import ไม่สำเร็จ')
        } catch { setImportError('เกิดข้อผิดพลาดในการอัปโหลด') }
        finally { setImporting(false) }
    }

    const downloadTemplate = () => {
        const rows = [
            ['ชื่อวัตถุดิบ', 'หน่วย', 'ต้นทุน', 'หน่วยรอง', 'อัตราแปลง', 'หมายเหตุ'],
            ['หมูสามชั้น', 'กก.', 85000, '', '', ''],
            ['อกไก่', 'กก.', 60000, '', '', ''],
            ['กุ้งขาว', 'กก.', 120000, '', '', ''],
            ['น้ำมันพืช', 'ลิตร', 30000, '', '', ''],
            ['ถุงซิป 500g', 'ถุง', 1500, '', '', ''],
        ]
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
        a.download = 'template-rawmaterial-import.csv'; a.click()
    }

    const statusIcon = (s: string) => s === 'created' ? '✅' : s === 'skipped' ? '⏭️' : '❌'
    const statusColor = (s: string) => s === 'created' ? '#059669' : s === 'skipped' ? '#D97706' : '#DC2626'

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: '1rem', backdropFilter: 'blur(5px)',
        }} onClick={onClose}>
            <div style={{
                background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 560,
                maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ height: 4, background: 'linear-gradient(135deg,var(--accent),#10B981)', borderRadius: '20px 20px 0 0' }} />

                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent)' }}>📂 Import วัตถุดิบจาก Excel</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>สต็อคเริ่มต้นที่ 0 — นับจริงในหน้า Stock Count</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }}>✕</button>
                </div>

                <div style={{ padding: '1.25rem' }}>
                    <div style={{
                        background: '#F0FDF4', borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        border: '1px solid #BBF7D0',
                    }}>
                        <span style={{ fontSize: '0.78rem', color: '#065F46', fontWeight: 500 }}>📋 ดาวน์โหลด template ก่อนกรอกข้อมูล</span>
                        <button onClick={downloadTemplate} style={{
                            padding: '5px 12px', borderRadius: 8, border: '1px solid #10B981', flexShrink: 0,
                            background: '#fff', color: '#059669', fontWeight: 700,
                            fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}>⬇ Template</button>
                    </div>

                    <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                        <strong style={{ color: 'var(--text)' }}>คอลัมน์:</strong>{' '}
                        <span style={{ color: '#DC2626' }}>ชื่อวัตถุดิบ*</span>, หน่วย, ต้นทุน, หน่วยรอง, อัตราแปลง, หมายเหตุ
                        <br />
                        <span style={{ color: '#059669' }}>✨ หมวดหมู่อัตโนมัติ จากชื่อวัตถุดิบ</span>
                    </div>

                    {!summary && (
                        <div
                            onDragOver={e => { e.preventDefault(); setDragging(true) }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={onDropFile}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: `2.5px dashed ${dragging ? '#10B981' : file ? '#10B981' : '#BBF7D0'}`,
                                borderRadius: 16, padding: '2rem 1.25rem', textAlign: 'center',
                                background: dragging || file ? '#F0FDF4' : 'var(--bg)',
                                cursor: 'pointer', transition: 'all 0.18s', marginBottom: 12,
                            }}
                        >
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFilePick} />
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{file ? '📊' : '📦'}</div>
                            {file ? (
                                <>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#059669' }}>{file.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB — คลิกเพื่อเปลี่ยนไฟล์</div>
                                </>
                            ) : (
                                <>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>รองรับ .xlsx และ .xls</div>
                                </>
                            )}
                        </div>
                    )}

                    {importError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: '0.82rem', fontWeight: 500, marginBottom: 12 }}>❌ {importError}</div>
                    )}

                    {summary && (
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                                {[
                                    { label: 'เพิ่มแล้ว', value: summary.created, color: '#059669', bg: '#F0FDF4', border: '#A7F3D0' },
                                    { label: '🤖 Auto', value: summary.autoMatched, color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
                                    { label: 'ข้าม (ซ้ำ)', value: summary.skipped, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                                    { label: 'ผิดพลาด', value: summary.errors, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                                ].map(s => (
                                    <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '8px 0', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                                        <div style={{ fontSize: '0.62rem', color: s.color, fontWeight: 600, padding: '0 4px' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                                {summary.results.map((r, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
                                        borderBottom: '1px solid var(--border-light)',
                                        background: i % 2 === 0 ? 'var(--white)' : 'var(--bg)',
                                    }}>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 28, flexShrink: 0 }}>#{r.row}</span>
                                        <span>{statusIcon(r.status)}</span>
                                        <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                        {r.status === 'created' && r.category && (
                                            <span style={{
                                                fontSize: '0.65rem', flexShrink: 0,
                                                background: r.guessed ? '#EEF2FF' : '#F0FDF4',
                                                color: r.guessed ? '#6366F1' : '#059669',
                                                border: `1px solid ${r.guessed ? '#C7D2FE' : '#A7F3D0'}`,
                                                borderRadius: 6, padding: '2px 6px', fontWeight: 700,
                                                maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>{r.guessed ? '🤖 ' : ''}{r.category}</span>
                                        )}
                                        {r.reason && <span style={{ fontSize: '0.68rem', color: statusColor(r.status), flexShrink: 0, maxWidth: 130, textAlign: 'right' }}>{r.reason}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={summary ? onDone : onClose} style={{
                            flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid var(--border)',
                            background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit',
                            fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)',
                        }}>ปิด</button>
                        {!summary && (
                            <button onClick={doImport} disabled={!file || importing} style={{
                                flex: 2, minHeight: 44, borderRadius: 12, border: 'none',
                                background: !file || importing ? '#9CA3AF' : 'linear-gradient(135deg,var(--accent),#10B981)',
                                color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                                cursor: !file || importing ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                                boxShadow: !file || importing ? 'none' : '0 4px 14px rgba(5,150,105,0.35)',
                            }}>
                                {importing ? '⏳ กำลัง Import...' : '📂 เริ่ม Import'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
