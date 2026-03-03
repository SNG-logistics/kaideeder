'use client'
import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'

// ─── Types ───────────────────────────────────────────────────
interface Category { id: string; code: string; name: string; icon: string | null; color: string | null }
interface Product { id: string; sku: string; name: string; salePrice: number; unit: string; categoryId: string; category?: Category; productType: string; imageUrl?: string }
interface DiningTable { id: string; number: number; name: string; zone: string; seats: number; status: string; orders?: Order[] }
interface OrderItemData { id?: string; productId: string; product?: Product; quantity: number; unitPrice: number; note?: string; isCancelled?: boolean; kitchenStatus?: string }
interface Order { id: string; orderNumber: string; tableId: string; table?: DiningTable; status: string; subtotal: number; discount: number; discountType: string; serviceCharge: number; vat: number; totalAmount: number; note?: string; items: OrderItemData[]; payments?: Payment[] }
interface Payment { id: string; method: string; amount: number; receivedAmount: number; changeAmount: number }

// ─── Format LAK ──────────────────────────────────────────────
function formatLAK(n: number): string {
    return new Intl.NumberFormat('lo-LA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' ₭'
}

// ─── Raw category codes to exclude ──────────────────────────
const RAW_CATEGORY_CODES = ['RAW_MEAT', 'RAW_PORK', 'RAW_SEA', 'RAW_VEG', 'DRY_GOODS', 'PACKAGING', 'OTHER']

// ─── Toast notification ─────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'error' | 'success' | 'warning'; onClose: () => void }) {
    useEffect(() => {
        const t = setTimeout(onClose, 5000)
        return () => clearTimeout(t)
    }, [onClose])

    const bg = type === 'error' ? '#FEF2F2' : type === 'success' ? '#ECFDF5' : '#FFFBEB'
    const border = type === 'error' ? '#FECACA' : type === 'success' ? '#A7F3D0' : '#FDE68A'
    const color = type === 'error' ? '#DC2626' : type === 'success' ? '#059669' : '#D97706'
    const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : '⚠️'

    return (
        <div style={{
            position: 'fixed', top: 16, right: 16, zIndex: 9999,
            background: bg, border: `1px solid ${border}`, borderRadius: 12,
            padding: '12px 20px', color, fontSize: '0.85rem', fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            display: 'flex', alignItems: 'center', gap: 8, maxWidth: 400,
            animation: 'slideIn 0.3s ease',
        }}>
            <span>{icon}</span>
            <span style={{ flex: 1 }}>{message}</span>
            <button onClick={onClose} style={{
                background: 'none', border: 'none', color, cursor: 'pointer', fontSize: 16, padding: 0,
            }}>✕</button>
        </div>
    )
}

// ─── Main POS Component ─────────────────────────────────────
export default function POSPage() {
    const [tables, setTables] = useState<DiningTable[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null)
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
    const [orderItems, setOrderItems] = useState<OrderItemData[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [showTableModal, setShowTableModal] = useState(true)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [loading, setLoading] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<string>('CASH')
    const [receivedAmount, setReceivedAmount] = useState<string>('')
    const [discount, setDiscount] = useState(0)
    const [discountType, setDiscountType] = useState<string>('AMOUNT')
    const [paymentLoading, setPaymentLoading] = useState(false)
    const [closeResult, setCloseResult] = useState<{ changeAmount: number; orderId?: string; stockWarnings?: string[] } | null>(null)
    const [isMobile, setIsMobile] = useState(false)
    const [showOrderPanel, setShowOrderPanel] = useState(true)
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'warning' } | null>(null)
    const [showReceiptPreview, setShowReceiptPreview] = useState(false)
    const [proteinPendingProduct, setProteinPendingProduct] = useState<Product | null>(null)
    const [sentItems, setSentItems] = useState<{ kitchen: OrderItemData[], bar: OrderItemData[], orderId: string, tableCode: string } | null>(null)
    const [authChecked, setAuthChecked] = useState(false)
    const [selectedZone, setSelectedZone] = useState<string>('ALL')  // Zone tab
    const [orderStartTime, setOrderStartTime] = useState<Date | null>(null)  // เวลาเริ่มออเดอร์
    const [nowString, setNowString] = useState<string>('')  // hydration-safe clock
    const [showMenuOverlay, setShowMenuOverlay] = useState(false)  // full-screen menu overlay
    const [noKitchen, setNoKitchen] = useState(false)  // ไม่ส่งครัว checkbox
    const [showMoveModal, setShowMoveModal] = useState(false)  // ย้ายโต๊ะ modal
    const searchRef = useRef<HTMLInputElement>(null)

    // ─── Auth Check ───────────────────────────────────────────
    useEffect(() => {
        // Clock — client-only to avoid SSR hydration mismatch
        const fmt = () => new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
        setNowString(fmt())
        const id = setInterval(() => setNowString(fmt()), 60000)
        return () => clearInterval(id)
    }, [])

    useEffect(() => {
        async function checkAuth() {
            try {
                const res = await fetch('/api/pos/tables')
                if (res.status === 401 || res.status === 403) {
                    window.location.href = '/login?redirect=/pos'
                    return
                }
                setAuthChecked(true)
            } catch {
                setToast({ message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', type: 'error' })
                setAuthChecked(true)
            }
        }
        checkAuth()
    }, [])

    useEffect(() => {
        const check = () => {
            const mobile = window.innerWidth < 768
            setIsMobile(mobile)
            setShowOrderPanel(!mobile)
        }
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    // ─── Helper: handle API errors ─────────────────────────────
    const handleApiError = useCallback((res: Response, context: string) => {
        if (res.status === 401) {
            window.location.href = '/login?redirect=/pos'
            return true
        }
        if (res.status === 403) {
            setToast({ message: `ไม่มีสิทธิ์: ${context}`, type: 'error' })
            return true
        }
        return false
    }, [])

    // ─── Data Loading ─────────────────────────────────────────
    const fetchTables = useCallback(async () => {
        try {
            const res = await fetch('/api/pos/tables')
            if (handleApiError(res, 'โหลดข้อมูลโต๊ะ')) return
            const json = await res.json()
            if (json.success) setTables(json.data)
        } catch (e) {
            console.error('Fetch tables error:', e)
            setToast({ message: 'ไม่สามารถโหลดข้อมูลโต๊ะได้', type: 'error' })
        }
    }, [handleApiError])

    const fetchProducts = useCallback(async () => {
        try {
            const res = await fetch('/api/categories')
            if (handleApiError(res, 'โหลดหมวดหมู่')) return
            const catJson = await res.json()
            if (catJson.success) {
                const saleCategories = (catJson.data as Category[]).filter(c =>
                    !RAW_CATEGORY_CODES.includes(c.code)
                )
                setCategories(saleCategories)
            }

            const pRes = await fetch('/api/products?limit=500')
            if (handleApiError(pRes, 'โหลดสินค้า')) return
            const pJson = await pRes.json()
            if (pJson.success) {
                const allProducts = (pJson.data.products ?? pJson.data) as Product[]
                const saleProducts = allProducts.filter(p => p.productType === 'SALE_ITEM' || p.productType === 'ENTERTAIN')
                setProducts(saleProducts)
            }
        } catch (e) {
            console.error('Fetch products error:', e)
            setToast({ message: 'ไม่สามารถโหลดข้อมูลสินค้าได้', type: 'error' })
        }
    }, [handleApiError])

    useEffect(() => {
        if (!authChecked) return
        fetchTables()
        fetchProducts()
    }, [fetchTables, fetchProducts, authChecked])

    // ─── Table Selection ──────────────────────────────────────
    const selectTable = async (table: DiningTable) => {
        setSelectedTable(table)

        if (table.orders && table.orders.length > 0) {
            const existingOrder = table.orders[0]
            try {
                const res = await fetch(`/api/pos/orders/${existingOrder.id}`)
                if (handleApiError(res, 'โหลดออเดอร์')) return
                const json = await res.json()
                if (json.success) {
                    setCurrentOrder(json.data)
                    setOrderItems(json.data.items.filter((i: OrderItemData) => !i.isCancelled))
                    setDiscount(json.data.discount)
                    setDiscountType(json.data.discountType)
                    // เวลาเริ่มออเดอร์เดิม
                    setOrderStartTime(json.data.createdAt ? new Date(json.data.createdAt) : new Date())
                } else {
                    setToast({ message: json.error || 'ไม่สามารถโหลดออเดอร์ได้', type: 'error' })
                }
            } catch (e) {
                console.error('Load order error:', e)
                setToast({ message: 'เกิดข้อผิดพลาดในการโหลดออเดอร์', type: 'error' })
            }
        } else {
            setCurrentOrder(null)
            setOrderItems([])
            setDiscount(0)
            setDiscountType('AMOUNT')
            setOrderStartTime(new Date())  // เริ่มจับเวลาใหม่
        }
    }

    // ─── Protein / Topping selection ────────────────────────────
    const PROTEIN_OPTIONS = [
        { label: '🐷 หมู', value: 'หมู', color: '#FCA5A5' },
        { label: '🐔 ไก่', value: 'ไก่', color: '#FCD34D' },
        { label: '🐄 เนื้อวัว', value: 'เนื้อวัว', color: '#D97706' },
        { label: '🦐 ทะเล', value: 'ทะเล', color: '#60A5FA' },
    ]

    // Match categories that require protein selection
    // ← Add more category names/codes here if needed
    const requiresProteinSelection = (product: Product): boolean => {
        const catName = (product.category?.name || '').toLowerCase()
        const catCode = (product.category?.code || '').toLowerCase()
        return catName.includes('ข้าวจานเดียว') ||
            catCode.includes('rice_single') ||
            catCode.includes('single_rice') ||
            catName.includes('จานเดียว')
    }

    // ─── Add Item to Order ────────────────────────────────────
    const addItem = (product: Product) => {
        // Intercept rice-single-dish products for protein selection
        if (requiresProteinSelection(product)) {
            setProteinPendingProduct(product)
            return
        }
        setOrderItems(prev => {
            const existing = prev.find(i => i.productId === product.id && !i.note)
            if (existing) {
                return prev.map(i =>
                    i.productId === product.id && !i.note
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                )
            }
            return [...prev, {
                productId: product.id,
                product,
                quantity: 1,
                unitPrice: product.salePrice,
            }]
        })
    }

    const addItemWithProtein = (product: Product, protein: string) => {
        setOrderItems(prev => [...prev, {
            productId: product.id,
            product,
            quantity: 1,
            unitPrice: product.salePrice,
            note: protein,
        }])
        setProteinPendingProduct(null)
    }

    const updateItemQty = (index: number, delta: number) => {
        setOrderItems(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], quantity: Math.max(0, updated[index].quantity + delta) }
            if (updated[index].quantity === 0) {
                updated.splice(index, 1)
            }
            return updated
        })
    }

    const removeItem = async (index: number) => {
        const item = orderItems[index]
        if (item.id && currentOrder) {
            await fetch(`/api/pos/orders/${currentOrder.id}/items/${item.id}`, { method: 'DELETE' })
        }
        setOrderItems(prev => prev.filter((_, i) => i !== index))
    }

    // ─── Calculate Totals ─────────────────────────────────────
    const subtotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const discountAmount = discountType === 'PERCENT' ? subtotal * (discount / 100) : discount
    const afterDiscount = subtotal - discountAmount
    const totalAmount = afterDiscount

    // ─── Save/Create Order ────────────────────────────────────
    const saveOrder = async (skipKitchen = false): Promise<string | null> => {
        if (!selectedTable || orderItems.length === 0) return null
        setLoading(true)

        try {
            if (currentOrder) {
                const newItems = orderItems.filter(i => !i.id)
                if (newItems.length > 0) {
                    const res = await fetch(`/api/pos/orders/${currentOrder.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            items: newItems.map(i => ({
                                productId: i.productId,
                                quantity: i.quantity,
                                unitPrice: i.unitPrice,
                                note: i.note,
                            })),
                            discount,
                            discountType,
                            skipKitchen,
                        }),
                    })
                    if (handleApiError(res, 'บันทึกออเดอร์')) return null
                    const json = await res.json()
                    if (json.success) {
                        setCurrentOrder(json.data)
                        setOrderItems(json.data.items.filter((i: OrderItemData) => !i.isCancelled))
                        setToast({ message: 'บันทึกออเดอร์สำเร็จ', type: 'success' })
                        return json.data.id
                    } else {
                        setToast({ message: json.error || 'บันทึกไม่สำเร็จ', type: 'error' })
                        return null
                    }
                }
                return currentOrder.id
            } else {
                const res = await fetch('/api/pos/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tableId: selectedTable.id,
                        items: orderItems.map(i => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            unitPrice: i.unitPrice,
                            note: i.note,
                        })),
                        skipKitchen,
                    }),
                })
                if (handleApiError(res, 'สร้างออเดอร์')) return null
                const json = await res.json()
                if (json.success) {
                    setCurrentOrder(json.data)
                    setOrderItems(json.data.items.filter((i: OrderItemData) => !i.isCancelled))
                    setToast({ message: 'สร้างออเดอร์สำเร็จ', type: 'success' })
                    fetchTables()
                    return json.data.id
                } else {
                    setToast({ message: json.error || 'สร้างออเดอร์ไม่สำเร็จ', type: 'error' })
                    return null
                }
            }
        } catch (e) {
            console.error('Save order error:', e)
            setToast({ message: 'เกิดข้อผิดพลาดในการบันทึก', type: 'error' })
            return null
        } finally {
            setLoading(false)
        }
    }

    const confirmAndSaveOrder = async () => {
        if (!selectedTable || orderItems.length === 0) return;

        const newItems = orderItems.filter(i => !i.id);

        const orderId = await saveOrder();
        if (orderId && newItems.length > 0) {
            const kitchenList: OrderItemData[] = [];
            const barList: OrderItemData[] = [];

            newItems.forEach(item => {
                const code = (item.product?.category?.code || '').toLowerCase();
                const name = (item.product?.category?.name || '').toLowerCase();
                const isDrink = code.includes('drink') || code.includes('bev') || name.includes('เครื่องดื่ม') || name.includes('น้ำ') || name.includes('เบียร์') || name.includes('เหล้า') || name.includes('แอลกอฮอล์');
                if (isDrink) {
                    barList.push(item);
                } else {
                    kitchenList.push(item);
                }
            });

            setSentItems({ kitchen: kitchenList, bar: barList, orderId, tableCode: selectedTable.name });
        }
    }

    // ─── Close Bill ───────────────────────────────────────────
    const closeBill = async () => {
        if (orderItems.length === 0) {
            setToast({ message: 'ยังไม่มีรายการสินค้า', type: 'warning' })
            return
        }

        // Save first if not saved yet
        let orderId = currentOrder?.id || null
        if (!orderId) {
            orderId = await saveOrder()
            if (!orderId) {
                setToast({ message: 'ไม่สามารถสร้างออเดอร์ได้', type: 'error' })
                return
            }
        } else {
            // Update existing order with any new items
            const newItems = orderItems.filter(i => !i.id)
            if (newItems.length > 0) {
                try {
                    const res = await fetch(`/api/pos/orders/${orderId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            items: newItems.map(i => ({
                                productId: i.productId,
                                quantity: i.quantity,
                                unitPrice: i.unitPrice,
                                note: i.note,
                            })),
                            discount,
                            discountType,
                        }),
                    })
                    if (handleApiError(res, 'อัพเดตออเดอร์')) return
                    const json = await res.json()
                    if (json.success) {
                        setCurrentOrder(json.data)
                        setOrderItems(json.data.items.filter((i: OrderItemData) => !i.isCancelled))
                    }
                } catch (e) {
                    console.error('Update order before close error:', e)
                    setToast({ message: 'ไม่สามารถอัพเดตออเดอร์ก่อนปิดบิล', type: 'error' })
                    return
                }
            }
        }

        setShowReceiptPreview(true)
    }

    const confirmPayment = async () => {
        const orderId = currentOrder?.id
        if (!orderId) {
            setToast({ message: 'ไม่พบออเดอร์', type: 'error' })
            return
        }
        setPaymentLoading(true)

        try {
            const received = paymentMethod === 'CASH' ? parseFloat(receivedAmount || '0') : totalAmount
            const res = await fetch(`/api/pos/orders/${orderId}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentMethod,
                    receivedAmount: received,
                    discount,
                    discountType,
                }),
            })
            if (handleApiError(res, 'ปิดบิล')) {
                setPaymentLoading(false)
                return
            }
            const json = await res.json()
            if (json.success) {
                setCloseResult({
                    changeAmount: json.data.changeAmount,
                    orderId: orderId,
                    stockWarnings: json.data.stockWarnings,
                })
            } else {
                setToast({ message: json.error || 'ปิดบิลไม่สำเร็จ', type: 'error' })
            }
        } catch (e) {
            console.error('Close bill error:', e)
            setToast({ message: 'เกิดข้อผิดพลาดในการปิดบิล', type: 'error' })
        } finally {
            setPaymentLoading(false)
        }
    }

    const resetAfterClose = () => {
        setCloseResult(null)
        setShowPaymentModal(false)
        setShowReceiptPreview(false)
        setCurrentOrder(null)
        setOrderItems([])
        setSelectedTable(null)
        setDiscount(0)
        setDiscountType('AMOUNT')
        setPaymentMethod('CASH')
        setReceivedAmount('')
        setOrderStartTime(null)
        setNoKitchen(false)
        setSelectedTable(null)
        fetchTables()
    }

    const cancelOrder = () => {
        if (!confirm('ยกเลิกออเดอร์ทั้งหมด?')) return
        setCurrentOrder(null)
        setOrderItems([])
        setDiscount(0)
    }

    // ─── Move order to another table ──────────────────────────
    const moveOrder = async (targetTable: DiningTable) => {
        if (!currentOrder) return
        setLoading(true)
        try {
            const res = await fetch(`/api/pos/orders/${currentOrder.id}/move`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetTableId: targetTable.id }),
            })
            const json = await res.json()
            if (json.success) {
                setToast({ message: `ย้ายไปโต๊ะ ${targetTable.name} สำเร็จ`, type: 'success' })
                setShowMoveModal(false)
                setSelectedTable(targetTable)
                setCurrentOrder(json.data)
                setOrderItems(json.data.items.filter((i: OrderItemData) => !i.isCancelled))
                fetchTables()
            } else {
                setToast({ message: json.error || 'ย้ายไม่สำเร็จ', type: 'error' })
            }
        } catch {
            setToast({ message: 'เกิดข้อผิดพลาดในการย้ายโต๊ะ', type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    // ─── Filtered products ────────────────────────────────────
    const filteredProducts = products.filter(p => {
        if (selectedCategory !== 'ALL' && p.categoryId !== selectedCategory) return false
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
        }
        return true
    })

    // ════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════
    if (!authChecked) {
        return (
            <div style={{ minHeight: '100%', background: '#F8F9FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#6B7280' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                    <div style={{ fontSize: '0.9rem' }}>กำลังตรวจสอบสิทธิ์...</div>
                </div>
            </div>
        )
    }

    // ─── Table/Zone prep (used by left panel) ─────────────────
    const tablesByZone: Record<string, DiningTable[]> = {}
    tables.forEach(t => { if (!tablesByZone[t.zone]) tablesByZone[t.zone] = []; tablesByZone[t.zone].push(t) })
    const zones = Object.keys(tablesByZone)
    const displayTables = selectedZone === 'ALL' ? tables : (tablesByZone[selectedZone] || [])
    const occupiedCount = tables.filter(t => t.orders && t.orders.length > 0).length
    const availableCount = tables.length - occupiedCount
    const elapsedLabel = (t: DiningTable) => {
        if (!t.orders?.length) return null
        const o = t.orders[0] as Order & { createdAt?: string }
        if (!o.createdAt) return null
        const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000)
        return mins < 60 ? `${mins}น.` : `${Math.floor(mins / 60)}ชม.${mins % 60}น.`
    }

    const btnStyle = (bg: string, disabled: boolean): CSSProperties => ({
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3, padding: '0.45rem 0.25rem', borderRadius: 10, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#E5E7EB' : bg,
        color: disabled ? '#9CA3AF' : '#fff',
        fontSize: '0.7rem', fontWeight: 700, fontFamily: 'inherit', minHeight: 52, opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
    })

    return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden', background: '#F0F2F5' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* ════ PROTEIN MODAL ════ */}
            {proteinPendingProduct && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                    onClick={() => setProteinPendingProduct(null)}>
                    <div style={{ background: '#fff', borderRadius: 20, padding: '1.5rem', width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>🍽️</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A1D26' }}>{proteinPendingProduct.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: 4 }}>เลือกประเภทเนื้อสัตว์</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                            {PROTEIN_OPTIONS.map(opt => (
                                <button key={opt.value} onClick={() => addItemWithProtein(proteinPendingProduct, opt.value)}
                                    style={{ padding: '1rem 0.5rem', borderRadius: 14, border: `2px solid ${opt.color}`, background: opt.color + '18', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: '1.8rem' }}>{opt.label.split(' ')[0]}</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1D26' }}>{opt.label.split(' ')[1]}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setProteinPendingProduct(null)}
                            style={{ width: '100%', padding: '0.55rem', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', cursor: 'pointer', fontFamily: 'inherit', color: '#6B7280', fontSize: '0.85rem', fontWeight: 600 }}>
                            ยกเลิก
                        </button>
                    </div>
                </div>
            )}

            {/* ════ LEFT PANEL — Table Grid ════ */}
            <div style={{ flex: '0 0 56%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB', background: '#fff', overflow: 'hidden' }}>
                {/* Top Bar */}
                <div style={{ background: '#1A1D26', color: '#fff', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: '1.3rem' }}>🍽️</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>43 Garden POS</div>
                        <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>
                            ว่าง <span style={{ color: '#4ADE80', fontWeight: 700 }}>{availableCount}</span>
                            &nbsp;•&nbsp; มีออเดอร์ <span style={{ color: '#FB7185', fontWeight: 700 }}>{occupiedCount}</span>
                        </div>
                    </div>
                    <a href="/dashboard" style={{ fontSize: '0.78rem', color: '#9CA3AF', textDecoration: 'none', padding: '5px 12px', borderRadius: 8, border: '1px solid #374151' }}>← กลับ</a>
                </div>

                {/* Zone Tabs */}
                <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0, borderBottom: '1px solid #E5E7EB', background: '#FAFBFD' }}>
                    {['ALL', ...zones].map(zone => {
                        const isActive = selectedZone === zone
                        const hasOccupied = (zone === 'ALL' ? tables : tablesByZone[zone] || []).some(t => t.orders && t.orders.length > 0)
                        return (
                            <button key={zone} onClick={() => setSelectedZone(zone)} style={{ padding: '0.65rem 1rem', border: 'none', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', fontWeight: isActive ? 700 : 500, fontSize: '0.82rem', whiteSpace: 'nowrap', color: isActive ? '#E8364E' : '#6B7280', borderBottom: isActive ? '2.5px solid #E8364E' : '2.5px solid transparent', position: 'relative' }}>
                                {zone === 'ALL' ? '📋 ทั้งหมด' : `📍 ${zone}`}
                                {hasOccupied && zone !== 'ALL' && <span style={{ position: 'absolute', top: 8, right: 6, width: 7, height: 7, borderRadius: '50%', background: '#E8364E' }} />}
                            </button>
                        )
                    })}
                </div>

                {/* Table Grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '0.6rem', alignContent: 'start' }}>
                    {displayTables.map(table => {
                        const hasOrder = !!(table.orders && table.orders.length > 0)
                        const elapsed = elapsedLabel(table)
                        const order = hasOrder ? table.orders![0] as Order : null
                        const isSelected = selectedTable?.id === table.id
                        return (
                            <button key={table.id} onClick={() => selectTable(table)} style={{ background: isSelected ? '#1A1D26' : hasOrder ? '#1E2533' : '#FFFFFF', border: `2px solid ${isSelected ? '#E8364E' : hasOrder ? '#374151' : '#E5E7EB'}`, borderRadius: 16, padding: '0.9rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: (hasOrder || isSelected) ? '#FFFFFF' : '#1A1D26', transition: 'all 0.18s ease', boxShadow: hasOrder ? '0 4px 16px rgba(0,0,0,0.18)' : '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 5, minHeight: 110 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{table.name}</div>
                                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: hasOrder ? '#FB7185' : '#4ADE80' }} />
                                </div>
                                <div style={{ fontSize: '0.62rem', color: (hasOrder || isSelected) ? '#9CA3AF' : '#6B7280' }}>📍 {table.zone} • {table.seats} ที่นั่ง</div>
                                <div style={{ marginTop: 'auto' }}>
                                    {hasOrder ? (
                                        <>
                                            {nowString && elapsed && <div style={{ fontSize: '0.7rem', color: '#FCD34D', fontWeight: 700 }}>⏱️ {elapsed}</div>}
                                            {(order?.totalAmount ?? 0) > 0 && <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#4ADE80' }}>{formatLAK(order!.totalAmount)}</div>}
                                        </>
                                    ) : (
                                        <div style={{ fontSize: '0.68rem', color: '#4ADE80', fontWeight: 600, background: 'rgba(74,222,128,0.1)', borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>🟢 ว่าง</div>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                    {displayTables.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#9CA3AF' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🪑</div>
                            <div style={{ fontWeight: 600 }}>ไม่มีโต๊ะในโซนนี้</div>
                        </div>
                    )}
                </div>

                {/* Bottom Filter Bar */}
                <div style={{ display: 'flex', gap: 4, padding: '0.5rem 0.75rem', borderTop: '1px solid #E5E7EB', background: '#FAFBFD', flexShrink: 0 }}>
                    {['เมนู', 'ยังไม่ได้รับ', 'ครัว', 'ประวัติ'].map(t => (
                        <button key={t} style={{ padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', fontSize: '0.78rem', color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
                    ))}
                </div>
            </div>

            {/* ════ RIGHT PANEL — Order Detail ════ */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#FAFBFD', overflow: 'hidden', minWidth: 0 }}>
                {!selectedTable ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🪑</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>กรุณาเลือกโต๊ะ</div>
                        <div style={{ fontSize: '0.82rem', marginTop: 6 }}>คลิกโต๊ะทางซ้ายเพื่อเริ่มออเดอร์</div>
                    </div>
                ) : (
                    <>
                        {/* Panel Header */}
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #E5E7EB', background: '#fff', flexShrink: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1A1D26' }}>รายละเอียด [ID : {currentOrder?.orderNumber || '0'}]</div>
                        </div>

                        {/* Table Info Cards (2-col) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '0.75rem', flexShrink: 0 }}>
                            <div style={{ background: '#fff', borderRadius: 12, padding: '0.75rem 1rem', border: '1px solid #E5E7EB' }}>
                                {([
                                    ['โต้อาหาร', selectedTable.name],
                                    ['เวลามา', nowString ? (orderStartTime?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) || '−') : '−'],
                                    ['เวลาที่ใช้', nowString ? (elapsedLabel(selectedTable) || '00:00') : '00:00'],
                                    ['จำนวนคน', '−'],
                                    ['จำนวนรายการ', `${orderItems.length} รายการ`],
                                ] as [string, string][]).map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.79rem' }}>
                                        <span style={{ color: '#9CA3AF' }}>{k}</span>
                                        <span style={{ fontWeight: 600, color: '#1A1D26' }}>{v}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ background: '#fff', borderRadius: 12, padding: '0.75rem 1rem', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: 6 }}>เวลาที่จะใช้</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.79rem' }}><span style={{ color: '#9CA3AF' }}>ราคาเริ่มต้น</span><span>0 ₭</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.79rem' }}><span style={{ color: '#9CA3AF' }}>ภาษีและส่วนลด</span><span>₭</span></div>
                                <div style={{ marginTop: 'auto', background: '#F3F4F6', borderRadius: 10, padding: '0.6rem 0.85rem' }}>
                                    <div style={{ fontSize: '0.7rem', color: '#6B7280', marginBottom: 2 }}>ราคาสุทธิ</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1A1D26', letterSpacing: '-0.02em' }}>{formatLAK(totalAmount)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons Row 1 */}
                        <div style={{ display: 'flex', gap: 5, padding: '0 0.75rem', flexShrink: 0 }}>
                            {([
                                { label: 'เพิ่ม', icon: '➕', bg: '#4F46E5', onClick: () => setShowMenuOverlay(true), off: false },
                                { label: 'QRcode', icon: '📱', bg: '#374151', onClick: () => setToast({ message: 'QR Code — Coming Soon', type: 'warning' }), off: false },
                                { label: 'ยกเลิก', icon: '✕', bg: '#DC2626', onClick: cancelOrder, off: orderItems.length === 0 },
                                { label: 'ย้าย', icon: '⇄', bg: '#7C3AED', onClick: () => setShowMoveModal(true), off: !currentOrder },
                                { label: 'สถานะ', icon: '✓', bg: '#0EA5E9', onClick: confirmAndSaveOrder, off: orderItems.length === 0 || loading },
                            ] as { label: string; icon: string; bg: string; onClick: () => void; off: boolean }[]).map(b => (
                                <button key={b.label} onClick={b.onClick} disabled={b.off} style={btnStyle(b.bg, b.off)}>
                                    <span style={{ fontSize: '1rem' }}>{b.icon}</span><span>{b.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Action Buttons Row 2 */}
                        <div style={{ display: 'flex', gap: 5, padding: '0.4rem 0.75rem', flexShrink: 0 }}>
                            <button onClick={() => setShowReceiptPreview(true)} disabled={orderItems.length === 0} style={btnStyle('#6B7280', orderItems.length === 0)}>
                                <span>📋</span><span>ใบแจ้ง</span>
                            </button>
                            <button onClick={closeBill} disabled={orderItems.length === 0} style={{ ...btnStyle('#16A34A', orderItems.length === 0), flex: 2 }}>
                                <span>🖨️</span><span>เช็คบิล</span>
                            </button>
                        </div>

                        {/* Order Items Table Header */}
                        <div style={{ background: '#FFFFFF', flexShrink: 0, borderTop: '1px solid #E5E7EB' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr 1fr 1.2fr 1fr 0.5fr', padding: '0.4rem 0.75rem', fontSize: '0.72rem', color: '#9CA3AF', gap: 4 }}>
                                {['รายการ', 'ราคา', 'จำนวน', 'รวม', 'สถานะ', '#'].map(h => <span key={h}>{h}</span>)}
                            </div>
                        </div>

                        {/* Order Items List */}
                        <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
                            {orderItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>
                                    <div style={{ fontSize: '2rem' }}>🛒</div>
                                    <div style={{ fontSize: '0.85rem', marginTop: 6 }}>ยังไม่มีรายการ — กด ➕ เพิ่มเมนู</div>
                                </div>
                            ) : (
                                orderItems.map((item, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr 1fr 1.2fr 1fr 0.5fr', padding: '0.5rem 0.75rem', borderBottom: '1px solid #F3F4F6', alignItems: 'center', gap: 4 }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1A1D26', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product?.name || item.productId}</span>
                                        <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>{formatLAK(item.unitPrice)}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <button onClick={() => updateItemQty(idx, -1)} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>−</button>
                                            <span style={{ minWidth: 18, textAlign: 'center', fontSize: '0.82rem', fontWeight: 700 }}>{item.quantity}</span>
                                            <button onClick={() => updateItemQty(idx, 1)} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>+</button>
                                        </div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#E8364E' }}>{formatLAK(item.quantity * item.unitPrice)}</span>
                                        {(() => {
                                            const st = item.kitchenStatus || 'PENDING'
                                            const icon = { PENDING: '⏳', ACCEPTED: '👌', COOKING: '🔥', READY: '✅', SERVED: '🍽️' }[st] || '⏳'
                                            const col = { PENDING: '#F59E0B', ACCEPTED: '#3B82F6', COOKING: '#EF4444', READY: '#10B981', SERVED: '#6B7280' }[st] || '#F59E0B'
                                            return <span style={{ fontSize: '0.72rem', color: col, fontWeight: 600 }}>{icon}</span>
                                        })()}
                                        <button onClick={() => removeItem(idx)} style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ════ MENU OVERLAY ════ */}
            {showMenuOverlay && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', background: '#F0F2F5' }}>
                    {/* Left: Category tabs + Product grid */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Category Horizontal Scroll */}
                        <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none', background: '#1A1D26', flexShrink: 0 }}>
                            <button onClick={() => setSelectedCategory('ALL')} style={{ padding: '0.65rem 1rem', border: 'none', background: selectedCategory === 'ALL' ? '#E8364E' : 'transparent', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: selectedCategory === 'ALL' ? 700 : 400, fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0 }}>เมนู</button>
                            {categories.map(cat => (
                                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} style={{ padding: '0.65rem 0.9rem', border: 'none', background: selectedCategory === cat.id ? (cat.color || '#E8364E') : 'transparent', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: selectedCategory === cat.id ? 700 : 400, fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {cat.icon} {cat.name}
                                </button>
                            ))}
                        </div>
                        {/* Search */}
                        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #E5E7EB', background: '#fff', flexShrink: 0 }}>
                            <input ref={searchRef} type="text" placeholder="🔍 ค้นหาเมนู..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '0.45rem 0.75rem', border: '1px solid #E5E7EB', borderRadius: 10, fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', background: '#FAFBFD' }} />
                        </div>
                        {/* Product Grid — image cards */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '0.65rem', alignContent: 'start' }}>
                            {filteredProducts.map(product => {
                                const hasImg = !!product.imageUrl
                                const catColor = product.category?.color || '#4F46E5'
                                return (
                                    <button key={product.id} onClick={() => addItem(product)}
                                        style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 14, padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: '100%' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.14)' }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' }}>
                                        {/* Image area — padding-top trick for reliable 4:3 ratio */}
                                        <div style={{ position: 'relative', width: '100%', paddingTop: '75%', overflow: 'hidden', background: hasImg ? '#111' : catColor, flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {hasImg ? (
                                                    <img src={product.imageUrl!} alt={product.name}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                ) : (
                                                    <span style={{ fontSize: '2.8rem', opacity: 0.9 }}>{product.category?.icon || '🍽️'}</span>
                                                )}
                                            </div>
                                            {/* Price badge */}
                                            {product.salePrice > 0 && (
                                                <div style={{ position: 'absolute', top: 7, right: 7, background: 'rgba(10,10,10,0.78)', backdropFilter: 'blur(4px)', borderRadius: 8, padding: '2px 8px', color: '#FCD34D', fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                                    {formatLAK(product.salePrice)} ₭
                                                </div>
                                            )}
                                        </div>
                                        {/* Name */}
                                        <div style={{ padding: '0.45rem 0.55rem 0.55rem', flex: 1, display: 'flex', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1A1D26', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{product.name}</span>
                                        </div>
                                    </button>
                                )
                            })}
                            {filteredProducts.length === 0 && (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>📭 ไม่พบเมนู</div>
                            )}
                        </div>
                    </div>
                    {/* Right: Cart summary */}
                    <div style={{ width: 300, display: 'flex', flexDirection: 'column', background: '#fff', borderLeft: '1px solid #E5E7EB' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #E5E7EB', flexShrink: 0, background: '#1A1D26' }}>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{selectedTable?.name}</div>
                            {currentOrder && <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>#{currentOrder.orderNumber}</div>}
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                            {orderItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF', fontSize: '0.85rem' }}>ยังไม่มีรายการ</div>
                            ) : (
                                orderItems.map((item, idx) => (
                                    <div key={idx} style={{ padding: '0.5rem', borderBottom: '1px solid #F3F4F6' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                                            <span style={{ flex: 1, fontSize: '0.83rem', fontWeight: 600, color: '#1A1D26' }}>({item.quantity}) {item.product?.name}</span>
                                            <button onClick={() => removeItem(idx)} style={{ background: '#EF4444', border: 'none', color: '#fff', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                                            <button onClick={() => updateItemQty(idx, -1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>−</button>
                                            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>{item.quantity}</span>
                                            <button onClick={() => updateItemQty(idx, 1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>+</button>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#9CA3AF', textAlign: 'right' }}>ราคา {formatLAK(item.quantity * item.unitPrice)} กีบ</div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div style={{ borderTop: '1px solid #E5E7EB', padding: '0.75rem 1rem', flexShrink: 0 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#6B7280', marginBottom: 10, cursor: 'pointer' }}>
                                <input type="checkbox" checked={noKitchen} onChange={e => setNoKitchen(e.target.checked)} />ไม่ส่งครัว
                            </label>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: '0.9rem', fontWeight: 700 }}>
                                <span style={{ color: '#1A1D26' }}>รวม ({orderItems.length} รายการ)</span>
                                <span style={{ color: '#7C3AED' }}>{formatLAK(totalAmount)} .-</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <button onClick={() => setShowMenuOverlay(false)} style={{ padding: '0.75rem', background: '#EF4444', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>ยกเลิก</button>
                                <button onClick={async () => {
                                    if (noKitchen) {
                                        // บันทึกเงียบ ไม่ส่งครัว
                                        await saveOrder()
                                        setShowMenuOverlay(false)
                                    } else {
                                        await confirmAndSaveOrder()
                                        setShowMenuOverlay(false)
                                    }
                                }} disabled={orderItems.length === 0 || loading}
                                    style={{ padding: '0.75rem', background: orderItems.length === 0 ? '#E5E7EB' : '#16A34A', border: 'none', borderRadius: 12, color: orderItems.length === 0 ? '#9CA3AF' : '#fff', fontWeight: 700, cursor: orderItems.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>
                                    {noKitchen ? 'บันทึก (ไม่ส่งครัว)' : 'ส่งครัว'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ RECEIPT PREVIEW MODAL ════ */}
            {showReceiptPreview && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)', padding: '0.75rem' }}>
                    <div style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1A1D26' }}>🧾 ใบเสร็จ — {selectedTable?.name}</div>
                                {currentOrder && <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: 2 }}>#{currentOrder.orderNumber}</div>}
                            </div>
                            <button onClick={() => setShowReceiptPreview(false)} style={{ background: '#F3F4F6', border: 'none', color: '#6B7280', cursor: 'pointer', borderRadius: 8, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>✕</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem' }}>
                            <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1A1D26' }}>43 Garden Restaurant</div>
                                <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{nowString}</div>
                            </div>
                            <div style={{ borderTop: '1px dashed #D1D5DB', borderBottom: '1px dashed #D1D5DB', padding: '0.75rem 0', marginBottom: '0.75rem' }}>
                                {orderItems.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, fontSize: '0.82rem' }}>
                                        <span style={{ flex: 1, color: '#1A1D26', fontWeight: 500 }}>{item.product?.name || item.productId}</span>
                                        <span style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{item.quantity} × {formatLAK(item.unitPrice)}</span>
                                        <span style={{ color: '#1A1D26', fontWeight: 700, minWidth: 72, textAlign: 'right' }}>{formatLAK(item.quantity * item.unitPrice)}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: '0.82rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: '#6B7280' }}>รวม</span><span>{formatLAK(subtotal)}</span></div>
                                {discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: '#6B7280' }}>ส่วนลด</span><span style={{ color: '#059669' }}>-{formatLAK(discountAmount)}</span></div>}
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '2px solid #1A1D26', marginTop: 4 }}>
                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1A1D26' }}>ยอดรวมสุทธิ</span>
                                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#E8364E' }}>{formatLAK(totalAmount)}</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, flexShrink: 0, background: '#FAFBFD' }}>
                            <button onClick={() => { if (currentOrder?.id) window.open(`/receipt/${currentOrder.id}?preview=1`, '_blank', 'width=380,height=700') }}
                                style={{ flex: 1, padding: '0.7rem', borderRadius: 10, border: '2px solid #2563EB', background: '#EFF6FF', color: '#2563EB', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', minHeight: 46 }}>
                                🖨️ พิมพ์ให้ลูกค้าดู
                            </button>
                            <button onClick={() => { setShowReceiptPreview(false); setShowPaymentModal(true) }}
                                style={{ flex: 1.5, padding: '0.7rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #059669, #10B981)', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(5,150,105,0.3)', minHeight: 46 }}>
                                💳 ไปชำระเงิน →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ SEND TO KITCHEN MODAL ════ */}
            {sentItems && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)', padding: '0.75rem' }}>
                    <div style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A1D26' }}>✅ ส่งออเดอร์สำเร็จ</div>
                                <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: 4 }}>โต๊ะ: {sentItems.tableCode}</div>
                            </div>
                            <button onClick={() => setSentItems(null)} style={{ background: '#F3F4F6', border: 'none', color: '#6B7280', cursor: 'pointer', borderRadius: 8, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>✕</button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
                            {[{ title: '👩‍🍳 ส่งครัว', items: sentItems.kitchen }, { title: '🍹 ส่งบาร์', items: sentItems.bar }].map(({ title, items }) => (
                                <div key={title} style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: 700, color: '#1A1D26', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>{title} ({items.length} รายการ)</div>
                                    {items.length > 0 ? (
                                        <div style={{ background: '#F8F9FC', borderRadius: 8, padding: '0.75rem', border: '1px solid #E5E7EB' }}>
                                            {items.map((item, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                                                    <span>{item.quantity} × {item.product?.name}</span>
                                                    {item.note && <span style={{ color: '#E8364E', fontSize: '0.8rem' }}>({item.note})</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.8rem', color: '#9CA3AF', textAlign: 'center' }}>ไม่มีรายการ</div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #E5E7EB', background: '#FAFBFD' }}>
                            <button onClick={() => setSentItems(null)} style={{ width: '100%', padding: '0.8rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #059669, #10B981)', color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(5,150,105,0.3)' }}>ตกลง</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ PAYMENT MODAL ════ */}
            {showPaymentModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)', padding: '0.75rem' }}>
                    <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 440, border: '1px solid #E5E7EB', boxShadow: '0 24px 48px rgba(0,0,0,0.15)', maxHeight: '92vh', overflowY: 'auto' }}>
                        {closeResult ? (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669', marginBottom: 8 }}>ปิดบิลสำเร็จ!</h2>
                                {closeResult.changeAmount > 0 && (
                                    <div style={{ background: '#ECFDF5', borderRadius: 12, padding: '1rem', marginBottom: 12, border: '1px solid #A7F3D0' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>เงินทอน</div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669' }}>{formatLAK(closeResult.changeAmount)}</div>
                                    </div>
                                )}
                                {closeResult.stockWarnings && closeResult.stockWarnings.length > 0 && (
                                    <div style={{ background: '#FFFBEB', borderRadius: 10, padding: '0.75rem', marginBottom: 12, textAlign: 'left', border: '1px solid #FDE68A' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#D97706', marginBottom: 4 }}>⚠️ คำเตือนสต็อค:</div>
                                        {closeResult.stockWarnings.map((w, i) => <div key={i} style={{ fontSize: '0.75rem', color: '#92400E', marginBottom: 2 }}>{w}</div>)}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    <button onClick={() => { if (closeResult.orderId) window.open(`/receipt/${closeResult.orderId}`, '_blank', 'width=350,height=700') }}
                                        style={{ flex: 1, padding: '0.75rem', borderRadius: 10, border: '2px solid #2563EB', background: '#EFF6FF', color: '#2563EB', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'inherit', minHeight: 48 }}>
                                        🖨️ พิมพ์บิล
                                    </button>
                                    <button onClick={resetAfterClose} style={{ flex: 1, padding: '0.75rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #E8364E, #FF6B81)', color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(232,54,78,0.3)', minHeight: 48 }}>
                                        ✨ ออเดอร์ใหม่
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1A1D26' }}>💳 ชำระเงิน</h2>
                                    <button onClick={() => setShowPaymentModal(false)} style={{ background: '#F3F4F6', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '1rem', minWidth: 36, minHeight: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                </div>
                                <div style={{ background: '#F8F9FC', borderRadius: 12, padding: '1rem', marginBottom: '1.25rem', textAlign: 'center', border: '1px solid #E5E7EB' }}>
                                    <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>ยอดที่ต้องชำระ</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#E8364E' }}>{formatLAK(totalAmount)}</div>
                                </div>
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: 8, fontWeight: 500 }}>วิธีชำระ</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                        {([{ key: 'CASH', icon: '💵', label: 'เงินสด' }, { key: 'TRANSFER', icon: '📱', label: 'เงินโอน' }] as const).map(m => (
                                            <button key={m.key} onClick={() => setPaymentMethod(m.key)} style={{ padding: '0.75rem 0.5rem', borderRadius: 10, border: `2px solid ${paymentMethod === m.key ? '#E8364E' : '#E5E7EB'}`, background: paymentMethod === m.key ? '#FFF0F2' : '#FFFFFF', color: '#1A1D26', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', minHeight: 56 }}>
                                                <div style={{ fontSize: '1.3rem' }}>{m.icon}</div>
                                                <div style={{ fontSize: '0.78rem', marginTop: 3, color: paymentMethod === m.key ? '#E8364E' : '#6B7280', fontWeight: paymentMethod === m.key ? 600 : 400 }}>{m.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {paymentMethod === 'CASH' && (
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: 6, fontWeight: 500 }}>จำนวนเงินที่รับ</div>
                                        <input type="number" value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} placeholder={String(totalAmount)}
                                            style={{ width: '100%', padding: '0.7rem', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, color: '#1A1D26', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'inherit', outline: 'none', textAlign: 'right', minHeight: 48, boxSizing: 'border-box' }} />
                                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                            {[50000, 100000, 200000, 500000, 1000000].map(amt => (
                                                <button key={amt} onClick={() => setReceivedAmount(String(amt))} style={{ padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F8F9FC', color: '#6B7280', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit', minHeight: 32 }}>{formatLAK(amt)}</button>
                                            ))}
                                            <button onClick={() => setReceivedAmount(String(totalAmount))} style={{ padding: '0.35rem 0.6rem', borderRadius: 8, border: '1px solid #059669', background: '#ECFDF5', color: '#059669', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit', fontWeight: 600, minHeight: 32 }}>พอดี</button>
                                        </div>
                                        {parseFloat(receivedAmount) > 0 && (
                                            <div style={{ background: '#ECFDF5', borderRadius: 10, padding: '0.7rem', marginTop: 12, textAlign: 'center', border: '1px solid #A7F3D0' }}>
                                                <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>เงินทอน</div>
                                                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: parseFloat(receivedAmount) >= totalAmount ? '#059669' : '#DC2626' }}>
                                                    {parseFloat(receivedAmount) >= totalAmount ? formatLAK(parseFloat(receivedAmount) - totalAmount) : `ขาด ${formatLAK(totalAmount - parseFloat(receivedAmount))}`}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {paymentMethod === 'TRANSFER' && (
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '1rem', textAlign: 'center', border: '1px solid #BFDBFE' }}>
                                            <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: 4 }}>ยอดโอน</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563EB' }}>{formatLAK(totalAmount)}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 4 }}>ตรวจสอบยอดโอนก่อนยืนยัน</div>
                                        </div>
                                    </div>
                                )}
                                <button onClick={confirmPayment} disabled={paymentLoading || (paymentMethod === 'CASH' && parseFloat(receivedAmount || '0') < totalAmount)}
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #059669, #10B981)', color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(5,150,105,0.3)', opacity: paymentLoading ? 0.6 : 1, minHeight: 48 }}>
                                    {paymentLoading ? '⏳ กำลังปิดบิล...' : '✅ ยืนยันการชำระเงิน'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ════ MOVE TABLE MODAL ════ */}
            {showMoveModal && selectedTable && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', borderRadius: 20, padding: '1.5rem', width: '90%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1A1D26', margin: 0 }}>⇄ ย้ายโต๊ะ</h2>
                            <button onClick={() => setShowMoveModal(false)} style={{ background: '#F3F4F6', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: '1rem', color: '#6B7280' }}>✕</button>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>โต๊ะปัจจุบัน: <strong style={{ color: '#1A1D26' }}>{selectedTable.name}</strong> → เลือกโต๊ะว่าง</div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                {tables.filter(t => t.id !== selectedTable.id && (!t.orders || t.orders.length === 0)).map(t => (
                                    <button key={t.id} onClick={() => moveOrder(t)} disabled={loading}
                                        style={{ padding: '0.75rem 0.5rem', borderRadius: 12, border: '2px solid #E5E7EB', background: '#F9FAFB', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1D26' }}>{t.name}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>{t.zone} • {t.seats} ที่นั่ง</div>
                                        <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>● ว่าง</div>
                                    </button>
                                ))}
                                {tables.filter(t => t.id !== selectedTable.id && (!t.orders || t.orders.length === 0)).length === 0 && (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>ไม่มีโต๊ะว่าง</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    )
}
