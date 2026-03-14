'use client'

import { useCurrency } from '@/context/TenantContext';
import { useEffect, useState, useCallback, useRef, type ChangeEvent, type DragEvent } from 'react'

import toast from 'react-hot-toast'

interface Product {
    id: string; sku: string; name: string; unit: string
    costPrice: number; salePrice: number
    productType: string; note?: string; imageUrl?: string
    category: { id: string; code: string; name: string; icon: string; color: string }
}
interface Category { id: string; code: string; name: string; icon: string; color: string; _count: { products: number } }

const FOOD_CODES = ['FOOD_GRILL', 'FOOD_FRY', 'FOOD_RICE', 'FOOD_NOODLE', 'FOOD_SEA', 'FOOD_VEG', 'FOOD_LAAB', 'SET']
const DRINK_CODES = ['BEER', 'BEER_DRAFT', 'WINE', 'COCKTAIL', 'DRINK', 'WATER', 'KARAOKE', 'ENTERTAIN']
type TabKey = 'food' | 'drink' | 'all'

export default function MenuPage() {
    const { fmt } = useCurrency();

    const [products, setProducts] = useState<Product[]>([])
    const [allCategories, setAllCategories] = useState<Category[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedCat, setSelectedCat] = useState('')
    const [activeTab, setActiveTab] = useState<TabKey>('food')
    const [showForm, setShowForm] = useState(false)
    const [editProduct, setEditProduct] = useState<Product | null>(null)
    const [photoProduct, setPhotoProduct] = useState<Product | null>(null)
    const [isMobile, setIsMobile] = useState(false)
    const [showImport, setShowImport] = useState(false)

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check(); window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (selectedCat) params.set('categoryId', selectedCat)
        params.set('limit', '300')
        const res = await fetch(`/api/products?${params}`)
        const json = await res.json()
        if (json.success) { setProducts(json.data.products); setTotal(json.data.total) }
        setLoading(false)
    }, [search, selectedCat])

    useEffect(() => { fetchProducts() }, [fetchProducts])
    useEffect(() => {
        fetch('/api/categories').then(r => r.json()).then(j => {
            if (j.success) setAllCategories(j.data)
        })
    }, [])

    useEffect(() => {
        const isCustom = (code: string) => code.startsWith('CUSTOM_')
        if (activeTab === 'food') setCategories(allCategories.filter(c => FOOD_CODES.includes(c.code) || isCustom(c.code)))
        else if (activeTab === 'drink') setCategories(allCategories.filter(c => DRINK_CODES.includes(c.code) || isCustom(c.code)))
        else setCategories(allCategories.filter(c => [...FOOD_CODES, ...DRINK_CODES].includes(c.code) || isCustom(c.code)))
        setSelectedCat('')
    }, [activeTab, allCategories])

    // เมนูขาย = SALE_ITEM + ENTERTAIN เท่านั้น
    const menuProducts = products
        .filter(p => ['SALE_ITEM', 'ENTERTAIN'].includes(p.productType))
        .filter(p => {
            if (activeTab === 'food') return FOOD_CODES.includes(p.category?.code) || p.category?.code?.startsWith('CUSTOM_')
            if (activeTab === 'drink') return DRINK_CODES.includes(p.category?.code) || p.category?.code?.startsWith('CUSTOM_')
            return true
        })
        .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
        .filter(p => !selectedCat || p.category?.id === selectedCat)

    const tabs = [
        { key: 'food' as TabKey, label: 'อาหาร', icon: '🍽️' },
        { key: 'drink' as TabKey, label: 'เครื่องดื่ม', icon: '🍺' },
        { key: 'all' as TabKey, label: 'ทั้งหมด', icon: '📋' },
    ]

    const totalMenuCount = products.filter(p => ['SALE_ITEM', 'ENTERTAIN'].includes(p.productType)).length

    return (
        <div className="page-container" suppressHydrationWarning style={{ maxWidth: 1400 }}>
            {/* Header */}
            <div style={{
                display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between', gap: 12,
                marginBottom: '1.25rem', paddingBottom: '1rem',
                borderBottom: '2px solid #D1FAE5',
            }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: isMobile ? '1.2rem' : undefined, color: '#065F46' }}>
                        🍽️ เมนูร้าน
                    </h1>
                    <p className="page-subtitle">
                        รายการอาหาร-เครื่องดื่มที่ขายหน้าร้าน •{' '}
                        <span style={{ color: '#059669', fontWeight: 700 }}>{totalMenuCount}</span> เมนู
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
                    {/* Import Button */}
                    <button
                        onClick={() => setShowImport(true)}
                        style={{
                            minHeight: 44, whiteSpace: 'nowrap', gap: 8, display: 'flex', alignItems: 'center',
                            padding: '0 1.25rem', borderRadius: 12, cursor: 'pointer',
                            background: '#fff',
                            border: '1.5px solid #10B981',
                            color: '#059669', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'inherit',
                            transition: 'all 0.18s ease',
                            flex: isMobile ? 1 : undefined,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ECFDF5' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
                    >
                        📂 Import Excel
                    </button>
                    {/* Add Menu Button */}
                    <button
                        onClick={() => { setEditProduct(null); setShowForm(true) }}
                        style={{
                            minHeight: 44, whiteSpace: 'nowrap', gap: 8, display: 'flex', alignItems: 'center',
                            padding: '0 1.25rem', borderRadius: 12, border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(135deg, #059669, #10B981)',
                            color: '#fff', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'inherit',
                            boxShadow: '0 4px 14px rgba(5,150,105,0.4)',
                            transition: 'all 0.18s ease',
                            flex: isMobile ? 1 : undefined,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#047857,#059669)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#059669,#10B981)'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                        ➕ เพิ่มเมนูใหม่
                    </button>
                </div>
            </div>

            {/* Tabs - Green theme */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 14,
                background: '#F0FDF4', borderRadius: 12, padding: 4,
                border: '1px solid #BBF7D0', width: isMobile ? '100%' : 'fit-content',
            }}>
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                        padding: isMobile ? '8px 12px' : '8px 22px',
                        borderRadius: 10, fontSize: '0.82rem',
                        fontWeight: activeTab === tab.key ? 700 : 500,
                        cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                        background: activeTab === tab.key
                            ? 'linear-gradient(135deg, #059669, #10B981)'
                            : 'transparent',
                        color: activeTab === tab.key ? '#fff' : '#059669',
                        transition: 'all 0.18s ease',
                        boxShadow: activeTab === tab.key ? '0 2px 8px rgba(5,150,105,0.35)' : 'none',
                        flex: isMobile ? 1 : undefined,
                    }}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Category chips - green */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                <button onClick={() => setSelectedCat('')} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600,
                    cursor: 'pointer', border: !selectedCat ? 'none' : '1px solid #BBF7D0',
                    background: !selectedCat ? 'linear-gradient(135deg,#059669,#10B981)' : '#F0FDF4',
                    color: !selectedCat ? '#fff' : '#059669', minHeight: 32,
                    boxShadow: !selectedCat ? '0 2px 6px rgba(5,150,105,0.3)' : 'none',
                    transition: 'all 0.15s',
                }}>ทั้งหมด</button>
                {categories.map(c => (
                    <button key={c.id} onClick={() => setSelectedCat(selectedCat === c.id ? '' : c.id)} style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600,
                        cursor: 'pointer',
                        border: selectedCat === c.id ? 'none' : '1px solid #BBF7D0',
                        background: selectedCat === c.id
                            ? 'linear-gradient(135deg,#059669,#10B981)'
                            : '#F0FDF4',
                        color: selectedCat === c.id ? '#fff' : '#059669',
                        transition: 'all 0.15s', minHeight: 32,
                        boxShadow: selectedCat === c.id ? '0 2px 6px rgba(5,150,105,0.3)' : 'none',
                    }}>{c.icon} {c.name} ({c._count.products})</button>
                ))}
            </div>

            {/* Search - green */}
            <div style={{
                padding: '0.75rem 1rem', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center',
                background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
                borderRadius: 14, border: '1px solid #BBF7D0',
            }}>
                <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 ค้นหาชื่อเมนู, SKU..."
                    className="input" style={{ width: isMobile ? '100%' : 260, minHeight: 40, border: '1px solid #BBF7D0', background: '#fff' }}
                />
                <button onClick={() => { setSearch(''); setSelectedCat('') }}
                    style={{
                        fontSize: '0.8rem', minHeight: 40, padding: '0 14px',
                        borderRadius: 10, border: '1px solid #BBF7D0',
                        background: '#fff', cursor: 'pointer', color: '#059669', fontWeight: 600, fontFamily: 'inherit',
                    }}>🔄 รีเซ็ต</button>
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#059669', fontWeight: 700 }}>
                    {menuProducts.length} รายการ
                </span>
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', gap: 12 }}>
                    <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>กำลังโหลดเมนู...</span>
                </div>
            ) : menuProducts.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', gap: 10 }}>
                    <span style={{ fontSize: '3rem' }}>🍽️</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600 }}>ยังไม่มีเมนูในหมวดนี้</span>
                    <button onClick={() => { setEditProduct(null); setShowForm(true) }} className="btn-primary" style={{ marginTop: 8 }}>
                        ➕ เพิ่มเมนูแรก
                    </button>
                </div>
            ) : (
                /* Card Grid */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile
                        ? 'repeat(2, 1fr)'
                        : 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 14,
                }}>
                    {menuProducts.map(p => (
                        <MenuCard
                            key={p.id}
                            product={p}
                            onEdit={() => { setEditProduct(p); setShowForm(true) }}
                            onPhoto={() => setPhotoProduct(p)}
                        />
                    ))}
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
                <MenuProductModal
                    product={editProduct}
                    allProducts={products}
                    categories={allCategories}
                    defaultTab={activeTab}
                    onClose={() => { setShowForm(false); setEditProduct(null) }}
                    onSaved={() => { setShowForm(false); setEditProduct(null); fetchProducts() }}
                />
            )}

            {showImport && (
                <ImportMenuModal
                    onClose={() => setShowImport(false)}
                    onDone={() => { setShowImport(false); fetchProducts() }}
                />
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .menu-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; }
            `}</style>
        </div>
    )
}

// ─── Menu Card (Green Premium) ───────────────────────────────────
function MenuCard({ product: p, onEdit, onPhoto }: {
    product: Product; onEdit: () => void; onPhoto: () => void
}) {
    const { fmt } = useCurrency();
    return (
        <div
            className="menu-card"
            style={{
                padding: 0, overflow: 'hidden', cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                border: '1.5px solid #BBF7D0',
                borderRadius: 16,
                background: 'var(--white)',
                boxShadow: '0 2px 8px rgba(5,150,105,0.08)',
            }}
            onClick={onEdit}
        >
            {/* รูปสินค้า */}
            <div
                onClick={e => { e.stopPropagation(); onPhoto() }}
                style={{
                    height: 155, position: 'relative', overflow: 'hidden',
                    background: `linear-gradient(135deg, #D1FAE5, #A7F3D0)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >
                {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                    <span style={{ fontSize: '4rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.12))' }}>
                        {p.category.icon}
                    </span>
                )}
                {/* Camera hover overlay */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0)', transition: 'background 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.6rem',
                }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
                >
                </div>
                {/* Category badge — green pill */}
                <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'linear-gradient(135deg,#059669,#10B981)',
                    color: '#fff', fontSize: '0.62rem', fontWeight: 700,
                    padding: '3px 9px', borderRadius: 20,
                    boxShadow: '0 2px 6px rgba(5,150,105,0.4)',
                }}>
                    {p.category.icon} {p.category.name}
                </div>
                {/* Photo icon badge */}
                <div style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'rgba(255,255,255,0.85)',
                    borderRadius: 8, width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', backdropFilter: 'blur(4px)',
                }}>📷</div>
            </div>

            {/* Info */}
            <div style={{ padding: '0.7rem 0.8rem 0.8rem' }}>
                <div style={{
                    fontWeight: 700, fontSize: '0.88rem',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: '#1A1D26', marginBottom: 2,
                }}>
                    {p.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#9CA3AF', marginBottom: 8, fontFamily: 'monospace' }}>
                    {p.sku}
                </div>
                {/* Price row */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(135deg,#F0FDF4,#ECFDF5)',
                    borderRadius: 10, padding: '6px 10px',
                    border: '1px solid #D1FAE5',
                }}>
                    <span style={{
                        fontWeight: 800, fontSize: '0.95rem',
                        color: '#059669',
                        letterSpacing: '-0.02em',
                    }}>
                        {fmt(p.salePrice)}
                    </span>
                    <span style={{
                        fontSize: '0.65rem', background: '#D1FAE5',
                        color: '#065f46', padding: '2px 8px', borderRadius: 6, fontWeight: 700,
                    }}>
                        / {p.unit}
                    </span>
                </div>
            </div>
        </div>
    )
}

// ─── Modal สำหรับเพิ่ม/แก้ไข เมนู ──────────────────────────────
function MenuProductModal({ product, allProducts, categories, defaultTab, onClose, onSaved }: {
    product: Product | null
    allProducts: Product[]
    categories: { id: string; code: string; name: string; icon: string }[]
    defaultTab?: TabKey
    onClose: () => void; onSaved: () => void
}) {
    const isEdit = !!product
    const MENU_CATS = [...FOOD_CODES, ...DRINK_CODES]
    const menuCategories = categories.filter(c => MENU_CATS.includes(c.code) || c.code.startsWith('CUSTOM_'))

    // Keyword Auto-Categorization Dictionary
    const categoryKeywords: Record<string, string[]> = {
        'DRY_GOODS': ['เครื่องปรุง', 'ซอส', 'เกลือ', 'น้ำตาล', 'ผงชูรส', 'พริกไทย', 'น้ำปลา', 'ซีอิ๊ว', 'กะทิ', 'พริกป่น', 'ข้าวคั่ว', 'น้ำมัน'],
        'RAW_MEAT': ['เนื้อวัว', 'เสือร้องไห้', 'น่องลาย', 'เศษเนื้อ'],
        'RAW_PORK': ['หมู', 'สามชั้น', 'ซี่โครง', 'สันคอ', 'หมูสับ', 'เบคอน', 'กากหมู'],
        'RAW_POULTRY': ['เป็ด', 'ห่าน'],
        'RAW_CHICKEN': ['ไก่', 'ปีกไก่', 'น่องไก่', 'อกไก่', 'ตีนไก่', 'น่องไก่ติดสะโพก', 'ปีกบน', 'ปีกล่าง', 'ปีกกลาง', 'สันในไก่', 'โครงไก่', 'เครื่องในไก่', 'กึ๋นไก่', 'ตับไก่', 'หัวใจไก่', 'สะโพกไก่', 'น่องติดสะโพก', 'เศษเนื้อไก่', 'หนังไก่', 'ตูดไก่', 'ข้อไก่'],
        'RAW_SEA': ['กุ้ง', 'หมึก', 'ปลา', 'หอย', 'ปู', 'แซลมอน', 'ดอลลี่', 'แมงกะพรุน'],
        'RAW_VEG': ['ผัก', 'พริก', 'กระเทียม', 'หอม', 'มะนาว', 'กะหล่ำ', 'เห็ด', 'แตงกวา', 'มะเขือ', 'ผักชี', 'ใบมะกรูด'],
        'EGG': ['ไข่', 'ไข่ไก่', 'ไข่เป็ด', 'ไข่นกกระทา'],
        'DAIRY': ['นม', 'เนย', 'วิปครีม', 'ชีส'],
        'BOX_BAG': ['กล่อง', 'ถุง', 'ถุงพลาสติก', 'ถุงหูหิ้ว', 'ถุงขยะ'],
        'TISSUE_CLEAN': ['ทิชชู่', 'น้ำยาล้างจาน', 'ฟองน้ำ', 'สบู่', 'ผงซักฟอก'],
        'DISPOSABLE': ['แก้ว', 'ช้อน', 'ส้อม', 'ตะเกียบ', 'หลอด', 'ไม้เสียบ'],
        'WATER': ['น้ำเปล่า', 'โซดา', 'น้ำแข็ง'],
        'SOFT_DRINK': ['โค้ก', 'เป๊ปซี่', 'สไปรท์', 'น้ำส้ม', 'น้ำแดง', 'แฟนต้า'],
        'BEER': ['เบียร์', 'ลีโอ', 'ช้าง', 'สิงห์', 'ไฮเนเก้น', 'โฮการ์เด้น'],
        'WINE': ['ไวน์'],
    }

    // Smart default: อาหาร when tab=food, เครื่องดื่ม when tab=drink
    const FOOD_PREF = ['FOOD_GRILL', 'FOOD_FRY', 'FOOD_RICE', 'FOOD_BOIL', 'FOOD_STIR', 'FOOD_SNACK', 'FOOD_SALAD', 'FOOD_SEA', 'FOOD_NOODLE', 'SET']
    const DRINK_PREF = ['BEER', 'BEER_DRAFT', 'SOFT_DRINK', 'WATER', 'COFFEE', 'TEA', 'SMOOTHIE', 'WINE', 'SOJU', 'COCKTAIL', 'DRINK']
    const preferredCodes = defaultTab === 'drink' ? DRINK_PREF : FOOD_PREF
    const defaultCat = product?.category?.id
        || menuCategories.find(c => preferredCodes.includes(c.code))?.id
        || menuCategories[0]?.id || ''
    const defaultCatName = product?.category?.name
        || menuCategories.find(c => c.id === defaultCat)?.name || ''

    const [form, setForm] = useState({
        id: product?.id || '',
        sku: product?.sku || '',
        name: product?.name || '',
        categoryId: defaultCat,
        productType: product?.productType || 'SALE_ITEM',
        unit: product?.unit || 'จาน',
        costPrice: product?.costPrice || 0,
        salePrice: product?.salePrice || 0,
        note: product?.note || '',
        reorderPoint: 0,
        minQty: 0,
    })
    const [saving, setSaving] = useState(false)
    const [skuLoading, setSkuLoading] = useState(false)

    // ── Combobox state for category ──────────────────────────────────
    const [catSearch, setCatSearch] = useState(
        () => defaultCatName
    )
    const [catOpen, setCatOpen] = useState(false)
    const [creatingCat, setCreatingCat] = useState(false)
    const catRef = useRef<HTMLDivElement>(null)

    const filteredCats = menuCategories.filter(c =>
        c.name.toLowerCase().includes(catSearch.toLowerCase()) ||
        c.code.toLowerCase().includes(catSearch.toLowerCase())
    )
    const isNewCat = catSearch.trim() !== '' &&
        !menuCategories.some(c => c.name.toLowerCase() === catSearch.trim().toLowerCase())

    // ── Combobox state for SKU (Stock items) ─────────────────────────
    const [skuSearch, setSkuSearch] = useState(() => product?.sku || '')
    const [skuOpen, setSkuOpen] = useState(false)
    const skuRef = useRef<HTMLDivElement>(null)

    const filteredStockProducts = allProducts.filter(p => !['SALE_ITEM', 'ENTERTAIN'].includes(p.productType))
        .filter(p => p.sku.toLowerCase().includes(skuSearch.toLowerCase()) || p.name.toLowerCase().includes(skuSearch.toLowerCase()))

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false)
            if (skuRef.current && !skuRef.current.contains(e.target as Node)) setSkuOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    async function handleCreateCategory(name: string) {
        if (!name.trim() || creatingCat) return
        setCreatingCat(true)
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), type: 'MENU', icon: '🍽️', color: '#059669' }),
            })
            const j = await res.json()
            if (j.success || j.data) {
                const cat = j.data
                setForm(f => ({ ...f, categoryId: cat.id }))
                setCatSearch(cat.name)
                setCatOpen(false)
                toast.success(`✅ สร้างหมวด "${cat.name}" แล้ว`)
            } else {
                toast.error(j.error || 'สร้างหมวดไม่สำเร็จ')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        } finally {
            setCreatingCat(false)
        }
    }
    // ────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (isEdit || !form.categoryId) return
        setSkuLoading(true)
        fetch(`/api/products/next-sku?categoryId=${form.categoryId}`)
            .then(r => r.json()).then(j => { if (j.success) setForm(f => ({ ...f, sku: j.data.nextSku })) })
            .finally(() => setSkuLoading(false))
    }, [form.categoryId, isEdit])

    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newName = e.target.value
        setForm(f => ({ ...f, name: newName }))

        if (!isEdit && newName.trim().length > 1) {
            let matchedCategoryCode: string | null = null
            for (const [code, keywords] of Object.entries(categoryKeywords)) {
                if (keywords.some(k => newName.toLowerCase().includes(k.toLowerCase()))) {
                    matchedCategoryCode = code
                    break
                }
            }
            if (matchedCategoryCode) {
                const targetCat = menuCategories.find(c => c.code === matchedCategoryCode)
                if (targetCat && form.categoryId !== targetCat.id) {
                    setForm(f => ({ ...f, categoryId: targetCat.id }))
                    setCatSearch(targetCat.name)
                }
            }
        }
    }

    async function handleSave() {
        if (!form.name.trim()) { toast.error('กรุณากรอกชื่อเมนู'); return }
        if (!form.categoryId) { toast.error('กรุณาเลือกหมวดเมนู'); return }
        setSaving(true)
        try {
            const url = (isEdit || form.id) ? `/api/products/${product?.id || form.id}` : '/api/products'
            const method = (isEdit || form.id) ? 'PATCH' : 'POST'
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, costPrice: Number(form.costPrice), salePrice: Number(form.salePrice) }),
            })
            const json = await res.json()
            if (json.success) { toast.success(isEdit ? '✅ แก้ไขเรียบร้อย' : '✅ เพิ่มเมนูเรียบร้อย'); onSaved() }
            else toast.error(json.error || 'บันทึกไม่สำเร็จ')
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    const handleDelete = async () => {
        if (!product?.id) return
        if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบเมนู "${product.name}"?`)) return
        setSaving(true)
        try {
            const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE' })
            const json = await res.json()
            if (json.success || json.deleted) {
                toast.success('🗑️ ลบเมนูเรียบร้อย')
                onSaved()
            } else {
                toast.error(json.error || 'ลบไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาดในการลบ') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
            <div style={{
                background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 500,
                padding: '1.5rem', boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
                maxHeight: '90vh', overflowY: 'auto', position: 'relative',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent)', borderRadius: '20px 20px 0 0' }} />

                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16, paddingTop: 8 }}>
                    {isEdit ? '✏️ แก้ไขเมนู' : '➕ เพิ่มเมนูใหม่'}
                </h2>

                {/* Info banner */}
                <div style={{
                    background: 'rgba(5,150,105,0.08)', borderRadius: 10,
                    padding: '8px 12px', marginBottom: 14,
                    fontSize: '0.77rem', color: '#065f46', fontWeight: 500,
                    borderLeft: '3px solid #059669',
                }}>
                    🍽️ เมนูร้าน — สินค้าที่ขายให้ลูกค้าโดยตรง (ไม่ใช่วัตถุดิบสต็อค)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div ref={skuRef} style={{ position: 'relative' }}>
                            <label className="label">SKU {!isEdit && '(ตั้งใหม่ หรือค้นหาสต็อก)'}</label>
                            <input
                                value={skuLoading ? '...' : (isEdit ? form.sku : skuSearch)}
                                readOnly={isEdit}
                                onChange={e => {
                                    setSkuSearch(e.target.value)
                                    setForm(f => ({ ...f, sku: e.target.value, id: '' }))
                                    setSkuOpen(true)
                                }}
                                onFocus={() => !isEdit && setSkuOpen(true)}
                                className="input" style={{ minHeight: 40, background: isEdit ? undefined : '#F3F4F6', fontWeight: 700, color: 'var(--accent)' }}
                                placeholder="ค้นหา รหัส, ชื่อวัตถุดิบ..."
                            />
                            {!isEdit && skuOpen && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                    background: '#fff', border: '1px solid var(--border)',
                                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    zIndex: 100, maxHeight: 200, overflowY: 'auto',
                                }}>
                                    {filteredStockProducts.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => {
                                                setForm(f => ({
                                                    ...f,
                                                    id: p.id,
                                                    sku: p.sku,
                                                    name: p.name,
                                                    categoryId: p.category?.id || f.categoryId,
                                                    unit: p.unit,
                                                    costPrice: p.costPrice,
                                                    salePrice: p.salePrice || f.salePrice,
                                                }))
                                                setSkuSearch(p.sku)
                                                setCatSearch(p.category?.name || catSearch)
                                                setSkuOpen(false)
                                            }}
                                            style={{
                                                padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                                                display: 'flex', flexDirection: 'column', gap: 2,
                                                background: form.id === p.id ? '#F0FDF4' : 'transparent',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                                            onMouseLeave={e => (e.currentTarget.style.background = form.id === p.id ? '#F0FDF4' : 'transparent')}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#059669' }}>{p.sku}</span>
                                                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{p.category.name}</span>
                                            </div>
                                            <span style={{ fontSize: '0.85rem' }}>{p.name}</span>
                                        </div>
                                    ))}
                                    {filteredStockProducts.length === 0 && skuSearch.trim() && (
                                        <div style={{ padding: '12px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.82rem' }}>เพิ่มใหม่รหัส: {skuSearch}</div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="label">ชื่อเมนู *</label>
                            <input value={form.name} onChange={handleNameChange}
                                className="input" style={{ minHeight: 40 }} placeholder="เช่น ไก่ผัดเม็ดมะม่วง" />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div ref={catRef} style={{ position: 'relative' }}>
                            <label className="label">หมวดเมนู</label>
                            <div
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    border: '1px solid var(--border)', borderRadius: 8,
                                    background: 'var(--white)', padding: '0 8px',
                                    minHeight: 40, cursor: 'text',
                                }}
                                onClick={() => setCatOpen(true)}
                            >
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>
                                    {menuCategories.find(c => c.id === form.categoryId)?.icon || '🏷️'}
                                </span>
                                <input
                                    value={catSearch}
                                    onChange={e => { setCatSearch(e.target.value); setCatOpen(true) }}
                                    onFocus={() => setCatOpen(true)}
                                    placeholder="ค้นหา หรือพิมพ์ชื่อหมวดใหม่..."
                                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.875rem', fontFamily: 'inherit' }}
                                    onKeyDown={e => {
                                        if (e.key === 'Escape') setCatOpen(false)
                                        if (e.key === 'Enter' && isNewCat) {
                                            e.preventDefault()
                                            handleCreateCategory(catSearch.trim())
                                        }
                                    }}
                                />
                                <span style={{ color: '#9CA3AF', fontSize: '0.65rem', flexShrink: 0 }}>▼</span>
                            </div>
                            {catOpen && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                    background: '#fff', border: '1px solid var(--border)',
                                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    zIndex: 100, maxHeight: 200, overflowY: 'auto',
                                }}>
                                    {filteredCats.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => { setForm(f => ({ ...f, categoryId: c.id })); setCatSearch(c.name); setCatOpen(false) }}
                                            style={{
                                                padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                                                background: form.categoryId === c.id ? '#F0FDF4' : 'transparent',
                                                fontWeight: form.categoryId === c.id ? 700 : 400, fontSize: '0.85rem',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                                            onMouseLeave={e => (e.currentTarget.style.background = form.categoryId === c.id ? '#F0FDF4' : 'transparent')}
                                        >
                                            <span>{c.icon || '🏷️'}</span>
                                            <span>{c.name}</span>
                                            {form.categoryId === c.id && <span style={{ marginLeft: 'auto', color: '#059669' }}>✓</span>}
                                        </div>
                                    ))}
                                    {isNewCat && (
                                        <div
                                            onClick={() => handleCreateCategory(catSearch.trim())}
                                            style={{
                                                padding: '9px 12px', cursor: creatingCat ? 'wait' : 'pointer',
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                borderTop: '1px dashed #D1FAE5', color: '#059669',
                                                fontWeight: 700, fontSize: '0.85rem',
                                            }}
                                        >
                                            {creatingCat ? '⏳' : '✅'} สร้างหมวดใหม่: &ldquo;{catSearch.trim()}&rdquo;
                                        </div>
                                    )}
                                    {filteredCats.length === 0 && !isNewCat && (
                                        <div style={{ padding: '12px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.82rem' }}>ไม่พบหมวด</div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="label">ประเภท</label>
                            <select value={form.productType} onChange={e => setForm(f => ({ ...f, productType: e.target.value }))}
                                className="input" style={{ minHeight: 40 }}>
                                <option value="SALE_ITEM">🏷️ สินค้าขาย</option>
                                <option value="ENTERTAIN">🎭 Entertain</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <div>
                            <label className="label">หน่วย</label>
                            <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                                className="input" style={{ minHeight: 40 }} placeholder="จาน / แก้ว" />
                        </div>
                        <div>
                            <label className="label">ต้นทุน (LAK)</label>
                            <input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: parseFloat(e.target.value) || 0 }))}
                                className="input" style={{ minHeight: 40 }} />
                        </div>
                        <div>
                            <label className="label">ราคาขาย (LAK)</label>
                            <input type="number" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: parseFloat(e.target.value) || 0 }))}
                                className="input" style={{ minHeight: 40 }} />
                        </div>
                    </div>
                    <div>
                        <label className="label">หมายเหตุ</label>
                        <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                            className="input" style={{ minHeight: 40 }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    {isEdit && (
                        <button onClick={handleDelete} disabled={saving} className="btn-secondary" style={{ flex: 1, minHeight: 44, background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5' }}>🗑️ ลบ</button>
                    )}
                    <button onClick={onClose} className="btn-secondary" style={{ flex: 1, minHeight: 44 }}>ยกเลิก</button>
                    <button onClick={handleSave} disabled={saving || !form.name} className="btn-success" style={{ flex: 2, minHeight: 44 }}>
                        {saving ? '⏳ กำลังบันทึก...' : isEdit ? '✅ บันทึก' : '➕ เพิ่มเมนู'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Photo Capture Modal ─────────────────────────────────────────
function PhotoCaptureModal({ product, onClose, onDone }: {
    product: Product; onClose: () => void; onDone: () => void
}) {
    const [mode, setMode] = useState<'choose' | 'camera' | 'preview'>('choose')
    const [imageData, setImageData] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
            streamRef.current = stream
            if (videoRef.current) videoRef.current.srcObject = stream
            setMode('camera')
        } catch { toast.error('ไม่สามารถเปิดกล้องได้') }
    }, [])

    const stopCamera = useCallback(() => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }, [])
    useEffect(() => () => stopCamera(), [stopCamera])

    const capture = () => {
        const video = videoRef.current; if (!video) return
        const size = Math.min(video.videoWidth, video.videoHeight)
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, size, size)
        setImageData(canvas.toDataURL('image/jpeg', 0.9)); stopCamera(); setMode('preview')
    }

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return
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
            const formData = new FormData(); formData.append('image', file)
            const apiRes = await fetch(`/api/products/${product.id}/image`, { method: 'POST', body: formData })
            const json = await apiRes.json()
            if (json.success) { toast.success(`✅ อัปโหลดรูป ${product.name} สำเร็จ`); onDone() }
            else toast.error(json.error || 'อัปโหลดไม่สำเร็จ')
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setUploading(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '0.75rem', backdropFilter: 'blur(6px)' }}
            onClick={() => { stopCamera(); onClose() }}>
            <div style={{ background: 'var(--white)', borderRadius: 18, width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>📷 รูปเมนู</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{product.name}</div>
                    </div>
                    <button onClick={() => { stopCamera(); onClose() }} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                </div>
                <div style={{ padding: '1.1rem' }}>
                    {mode === 'choose' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                {[
                                    { icon: '📷', label: 'ถ่ายรูป', action: startCamera, color: 'var(--accent)' },
                                    { icon: '🖼️', label: 'อัปโหลด', action: () => fileInputRef.current?.click(), color: '#2563EB' },
                                ].map(btn => (
                                    <button key={btn.label} onClick={btn.action} style={{
                                        padding: '1.75rem 0.75rem', borderRadius: 14, border: '2px dashed var(--border)',
                                        background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.18s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = btn.color; e.currentTarget.style.background = btn.color + '08' }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}>
                                        <span style={{ fontSize: '1.8rem' }}>{btn.icon}</span>
                                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{btn.label}</span>
                                    </button>
                                ))}
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
                            </div>
                        </div>
                    )}
                    {mode === 'camera' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: '100%', borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '1/1' }}>
                                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                                <button onClick={() => { stopCamera(); setMode('choose') }} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>← กลับ</button>
                                <button onClick={capture} style={{ flex: 2, padding: '0.6rem', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>📸 ถ่ายรูป</button>
                            </div>
                        </div>
                    )}
                    {mode === 'preview' && imageData && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <img src={imageData} alt="preview" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 12 }} />
                            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                                <button onClick={() => { setImageData(null); setMode('choose') }} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>🔄 ใหม่</button>
                                <button onClick={upload} disabled={uploading} style={{ flex: 2, padding: '0.6rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff', fontWeight: 700, cursor: uploading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: uploading ? 0.7 : 1 }}>
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

// ─── Import Menu Modal ───────────────────────────────────────────
type ImportResult = { row: number; status: 'created' | 'skipped' | 'error'; name: string; category?: string; guessed?: boolean; recipeCreated?: boolean; reason?: string }
type ImportSummary = { created: number; skipped: number; errors: number; autoMatched: number; recipesCreated: number; total: number; results: ImportResult[] }

function ImportMenuModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [dragging, setDragging] = useState(false)
    const [importing, setImporting] = useState(false)
    const [summary, setSummary] = useState<ImportSummary | null>(null)
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
            const res = await fetch('/api/products/import', { method: 'POST', body: fd })
            const json = await res.json()
            if (json.success) { setSummary(json.data); toast.success(`✅ Import สำเร็จ ${json.data.created} รายการ`) }
            else setImportError(json.error || 'Import ไม่สำเร็จ')
        } catch { setImportError('เกิดข้อผิดพลาดในการอัปโหลด') }
        finally { setImporting(false) }
    }

    const downloadTemplate = () => {
        const rows = [
            ['ชื่อเมนู', 'ราคาขาย', 'ต้นทุน', 'หน่วย', 'หมายเหตุ'],
            ['Johny Walker Red', 700000, 400000, 'ขวด', ''],
            ['เบียร์ลาวสด (1แก้ว)', 10000, 5000, 'แก้ว', ''],
            ['วาย Anastasia', 699000, 350000, 'ขวด', ''],
            ['อเมริกาโน (ปั๊น)', 35000, 15000, 'แก้ว', ''],
            ['ไก่ย่าง', 90000, 45000, 'จาน', ''],
            ['ก๋วยเตี๋ยวน้ำใส', 35000, 15000, 'จาน', ''],
            ['ส้มตำ', 40000, 18000, 'จาน', ''],
            ['ปลาหมึกย่าง', 120000, 60000, 'จาน', ''],
        ]
        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
        a.download = 'template-menu-import.csv'; a.click()
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
                <div style={{ height: 4, background: 'linear-gradient(135deg,#059669,#10B981)', borderRadius: '20px 20px 0 0' }} />

                {/* Header */}
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#065F46' }}>📂 Import เมนูจาก Excel</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>นำเข้าเมนูหลายรายการพร้อมกัน</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }}>✕</button>
                </div>

                <div style={{ padding: '1.25rem' }}>
                    {/* Template download */}
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

                    {/* Column info */}
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                        <strong style={{ color: 'var(--text)' }}>คอลัมน์ที่รองรับ:</strong>{' '}
                        <span style={{ color: '#DC2626' }}>ชื่อเมนู*</span>{' (บังคับ), '}
                        ราคาขาย, ต้นทุน, หน่วย, หมายเหตุ
                        <br />
                        <span style={{ color: '#059669' }}>✨ ไม่ต้องใส่หมวดหมู่ — ระบบวิเคราะห์ชื่อเมนูให้อัตโนมัติ</span>
                    </div>

                    {/* Drop zone */}
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
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{file ? '📊' : '📂'}</div>
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

                    {/* Error */}
                    {importError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: '0.82rem', fontWeight: 500, marginBottom: 12 }}>❌ {importError}</div>
                    )}

                    {/* Summary */}
                    {summary && (
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                                {[
                                    { label: 'เพิ่มแล้ว', value: summary.created, color: '#059669', bg: '#F0FDF4', border: '#A7F3D0' },
                                    { label: '🤖 Auto-detect', value: summary.autoMatched, color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
                                    { label: '📋 สูตรบอม', value: summary.recipesCreated, color: '#0891B2', bg: '#F0F9FF', border: '#BAE6FD' },
                                    { label: 'ข้าม/ผิดพลาด', value: summary.skipped + summary.errors, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
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
                                        <span style={{ fontSize: '0.82rem' }}>{statusIcon(r.status)}</span>
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
                                        {r.recipeCreated && (
                                            <span style={{
                                                fontSize: '0.65rem', flexShrink: 0,
                                                background: '#F0F9FF', color: '#0891B2',
                                                border: '1px solid #BAE6FD',
                                                borderRadius: 6, padding: '2px 6px', fontWeight: 700,
                                            }}>📋 สูตร</span>
                                        )}
                                        {r.reason && <span style={{ fontSize: '0.68rem', color: statusColor(r.status), flexShrink: 0, maxWidth: 130, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={summary ? onDone : onClose} style={{
                            flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid var(--border)',
                            background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit',
                            fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)',
                        }}>ปิด</button>
                        {!summary && (
                            <button onClick={doImport} disabled={!file || importing} style={{
                                flex: 2, minHeight: 44, borderRadius: 12, border: 'none',
                                background: !file || importing ? '#9CA3AF' : 'linear-gradient(135deg,#059669,#10B981)',
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
