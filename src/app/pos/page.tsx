'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import { useStoreBranding } from '@/hooks/useStoreBranding'
import { useCurrency, useTenant } from '@/context/TenantContext'
import NewOrderAlert from '@/components/NewOrderAlert'
import { useNotification } from '@/components/NotificationContext'
import { getPrinterSettings } from '@/lib/printerSettings'
import {
    createReceiptRequestId,
    isAndroidPOSApp,
    printAndroidPOSReceipt,
    reprintAndroidPOSReceipt,
    type AndroidPOSReceiptPayload,
    type AndroidPOSResult,
} from '@/lib/android-pos'

// ─── Types ───────────────────────────────────────────────────
interface Category { id: string; code: string; name: string; icon: string | null; color: string | null }
interface Topping { id: string; name: string; price: number; isActive: boolean }
interface Product { id: string; sku: string; name: string; salePrice: number; unit: string; categoryId: string; category?: Category; productType: string; imageUrl?: string; toppingsJson?: string | null }
interface DiningTable { id: string; number: number; name: string; zone: string; seats: number; status: string; orders?: Order[]; posX?: number; posY?: number; width?: number; height?: number; shape?: string }
interface OrderItemData { id?: string; productId: string; product?: Product; quantity: number; unitPrice: number; note?: string; isCancelled?: boolean; kitchenStatus?: string; toppingsJson?: string; toppingsTotal?: number }
interface Order { id: string; orderNumber: string; tableId: string; table?: DiningTable; status: string; subtotal: number; discount: number; discountType: string; serviceCharge: number; vat: number; totalAmount: number; note?: string; openedAt?: string; closedAt?: string; items: OrderItemData[]; payments?: Payment[] }
interface Payment { id: string; method: string; amount: number; receivedAmount: number; changeAmount: number }

interface CloseResult {
    changeAmount: number
    orderId: string
    stockWarnings?: string[]
    receiptPayload?: AndroidPOSReceiptPayload
    nativePrint?: AndroidPOSResult
}

// ─── Format LAK ──────────────────────────────────────────────
function formatLAK(n: number): string {
    return new Intl.NumberFormat('lo-LA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' ₭'
}

// ─── Raw category codes to exclude ──────────────────────────
const RAW_CATEGORY_CODES = ['RAW_MEAT', 'RAW_PORK', 'RAW_SEA', 'RAW_VEG', 'DRY_GOODS', 'PACKAGING', 'OTHER', 'EGG', 'DAIRY', 'CHEESE', 'FLOUR_DOUGH']

// ─── Print Kitchen / Bar Ticket ──────────────────────────────
// ระบบรองรับหลาย printer: ครัว / บาร์ / ใบเสร็จ แต่ละตัวมี IP เองใน Settings
// Flow: ลอง TCP direct → ถ้าล้มเหลว → fallback browser print dialog
function printKitchenTicket(opts: {
    station: 'KITCHEN' | 'BAR'
    items: OrderItemData[]
    tableName: string
    orderNumber: string
    storeName: string
}) {
    if (opts.items.length === 0) return
    const { station, items, tableName, orderNumber } = opts

    // ── ดึง config ของ station ที่ถูกต้อง ────────────────────
    const allSettings = getPrinterSettings()
    const printer = station === 'KITCHEN'
        ? allSettings.kitchenPrinter
        : allSettings.barPrinter

    const { ip, port, paperWidth, autoCut, copies, enabled } = printer

    // ── 1. TCP/ESC/POS direct (ถ้า enabled และมี IP) ─────────
    const printItems = items.map(i => ({
        name: i.product?.name || '',
        quantity: i.quantity,
        note: i.note || undefined,
    }))

    if (enabled && ip) {
        fetch('/api/print/raw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip, port, station, tableName, orderNumber,
                items: printItems, autoCut, copies,
            }),
        }).then(r => r.json()).then(d => {
            if (d.ok) return   // ✅ TCP สำเร็จ — จบ
            console.warn(`[print] TCP ${station} failed (${ip}:${port}):`, d.error)
            doBrowserPrint()   // fallback
        }).catch(e => {
            console.warn(`[print] TCP ${station} error:`, e.message)
            doBrowserPrint()   // fallback
        })
    } else {
        // TCP ปิดอยู่ → ใช้ browser print ทันที
        doBrowserPrint()
    }

    // ── 2. Browser fallback ───────────────────────────────────
    function doBrowserPrint() {
        const isBar = station === 'BAR'
        const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        const bodyWidth = paperWidth === '58mm' ? '54mm' : '76mm'

        const w = window.open('', '_blank', 'width=302,height=400,toolbar=0,menubar=0,scrollbars=0')
        if (!w) return
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;700;900&family=Noto+Sans+Thai:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:${paperWidth} auto;margin:3mm 2mm}
  html,body{height:fit-content!important;overflow:hidden!important}
  body{font-family:'Noto Sans Lao','Noto Sans Thai','Courier New',monospace;font-size:14px;color:#000;width:${bodyWidth};line-height:1.35}
  .top{font-size:18px;font-weight:900;border-bottom:2px solid #000;padding-bottom:3px;margin-bottom:5px;display:flex;justify-content:space-between;align-items:baseline}
  .sub{font-size:10px;color:#444;margin-bottom:6px;border-bottom:1px dashed #000;padding-bottom:4px}
  .row{display:flex;gap:6px;padding:3px 0;border-bottom:1px dotted #ccc}
  .q{font-size:17px;font-weight:900;min-width:22px;flex-shrink:0}
  .n{font-size:14px;font-weight:700;flex:1}
  .nt{font-size:11px;color:#555}
</style></head><body>
<div class="top">
  <span>โต๊ะ ${tableName}</span>
  <span style="font-size:13px">${isBar ? '🍹 BAR' : '🍳 ครัว'}</span>
</div>
<div class="sub">#${orderNumber} &nbsp;·&nbsp; ${time}</div>
${items.map(i => `<div class="row">
  <span class="q">${i.quantity}</span>
  <span class="n">${i.product?.name || ''}${i.note ? `<br><span class="nt">📝 ${i.note}</span>` : ''}</span>
</div>`).join('')}
<script>
(function(){
  function doClose(){ try{ window.close(); }catch(e){} }
  window.addEventListener('afterprint', doClose);
  try {
    var mq = window.matchMedia('print');
    var handler = function(e){ if(!e.matches) doClose(); };
    if(mq.addEventListener){ mq.addEventListener('change', handler); }
    else if(mq.addListener){ mq.addListener(handler); }
  } catch(e){}
  window.onload = function(){ window.focus(); window.print(); };
  if(document.readyState === 'complete'){ window.focus(); window.print(); }
})();
<\/script>
</body></html>`)
        w.document.close()
    }
}


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
    const { fmt, currency } = useCurrency();
    const { settings: tenantSettings } = useTenant()

    useRoleGuard(['owner', 'manager', 'cashier'])
    const branding = useStoreBranding()
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
    const [closeResult, setCloseResult] = useState<CloseResult | null>(null)
    const [nativeReprintLoading, setNativeReprintLoading] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [isTablet, setIsTablet] = useState(false)
    const [showOrderPanel, setShowOrderPanel] = useState(true)
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'warning' } | null>(null)
    const [showReceiptPreview, setShowReceiptPreview] = useState(false)
    const [proteinPendingProduct, setProteinPendingProduct] = useState<Product | null>(null)
    const [proteinComment, setProteinComment] = useState('')      // comment สำหรับ topping modal (hack: stores selected topping IDs)
    const [proteinNote, setProteinNote] = useState('')            // text note input for topping modal
    const [sentItems, setSentItems] = useState<{ kitchen: OrderItemData[], bar: OrderItemData[], orderId: string, tableCode: string } | null>(null)
    const [authChecked, setAuthChecked] = useState(false)
    const [selectedZone, setSelectedZone] = useState<string>('ALL')  // Zone tab
    const [orderStartTime, setOrderStartTime] = useState<Date | null>(null)  // เวลาเริ่มออเดอร์
    const [nowString, setNowString] = useState<string>('')  // hydration-safe clock
    const [showMenuOverlay, setShowMenuOverlay] = useState(false)  // full-screen menu overlay
    const [noKitchen, setNoKitchen] = useState(false)  // ไม่ส่งครัว checkbox
    const [showMoveModal, setShowMoveModal] = useState(false)  // ย้ายโต๊ะ modal
    const [showHistory, setShowHistory] = useState(false)  // ประวัติ modal
    const [historyOrders, setHistoryOrders] = useState<any[]>([])
    const [historySearch, setHistorySearch] = useState('')
    const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<any | null>(null)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [showKitchenPopup, setShowKitchenPopup] = useState(false)  // kitchen popup
    const [kitchenQueue, setKitchenQueue] = useState<any[]>([])
    const [selectedKitchenOrder, setSelectedKitchenOrder] = useState<any | null>(null)
    const [kitchenUpdating, setKitchenUpdating] = useState<string | null>(null)
    const [mobileTab, setMobileTab] = useState<'tables' | 'order'>('tables')  // mobile bottom nav
    const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())  // ซ่อนหมวด
    const [catEditMode, setCatEditMode] = useState(false)  // mode แก้ไขการมองเห็นหมวด
    const [deliveryMode, setDeliveryMode] = useState(false)
    const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')
    const [deliveryOrders, setDeliveryOrders] = useState<any[]>([])
    const [showDeliveryModal, setShowDeliveryModal] = useState(false)
    const [deliveryForm, setDeliveryForm] = useState({
        customerName: '', customerPhone: '', addressText: '',
        channel: 'PHONE', deliveryFee: '0', isPrepaid: false,
    })
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
            const w = window.innerWidth
            setIsMobile(w < 768)
            setIsTablet(w >= 768 && w <= 1024)
            setShowOrderPanel(w >= 768)
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
        if (res.status >= 500) {
            setToast({ message: `เซิร์ฟเวอร์ผิดพลาด (${res.status}): ${context}`, type: 'error' })
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

    const fetchDeliveryOrders = useCallback(async () => {
        try {
            const res = await fetch('/api/pos/delivery')
            if (handleApiError(res, 'โหลด delivery')) return
            const json = await res.json()
            if (json.success) setDeliveryOrders(json.data)
        } catch (e) { console.error('Fetch delivery error:', e) }
    }, [handleApiError])

    const fetchProducts = useCallback(async () => {
        try {
            const res = await fetch('/api/categories')
            if (handleApiError(res, 'โหลดหมวดหมู่')) return
            const catJson = await res.json()
            if (catJson.success) {
                const EXCLUDE_NAMES = ['ของทะเลสด', 'ข้าวสาร', 'อุปกรณ์', 'ไข่']
                const saleCategories = (catJson.data as Category[]).filter(c =>
                    !RAW_CATEGORY_CODES.includes(c.code) &&
                    !c.name.includes('เครื่องปรุง') &&
                    !EXCLUDE_NAMES.includes(c.name.trim())
                )
                setCategories(saleCategories)
            }

            const pRes = await fetch('/api/products?limit=500')
        if (handleApiError(pRes, 'โหลดสินค้า')) return
        const pJson = await pRes.json()
        if (pJson.success) {
            const allProducts = (pJson.data.products ?? pJson.data) as Product[]
            const saleProducts = allProducts.filter(p =>
                (p.productType === 'SALE_ITEM' || p.productType === 'ENTERTAIN') &&
                !(p.category?.name || '').includes('เครื่องปรุง')
            )
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

// ─── Auto-refresh tables every 5s (cashier sees new QR orders without manual refresh) ──
useEffect(() => {
    if (!authChecked) return
    const iv = setInterval(() => fetchTables(), 5000)
    return () => clearInterval(iv)
}, [authChecked, fetchTables])

// ─── Refresh tables immediately when a new ORDER_NEW notification arrives ──
const { notifications } = useNotification()
const prevNotifCountRef = useRef(0)
useEffect(() => {
    const orderNotifs = notifications.filter(n => n.type === 'ORDER_NEW')
    if (orderNotifs.length > prevNotifCountRef.current) {
        // New order arrived — refresh table list so pending badge updates
        fetchTables()
    }
    prevNotifCountRef.current = orderNotifs.length
}, [notifications, fetchTables])

// ─── Table Selection ──────────────────────────────────────
const selectTable = async (table: DiningTable) => {
    setSelectedTable(table)

    const activeOrders = table.orders ?? []

    if (activeOrders.length === 0) {
        // No existing order → fresh slate
        setCurrentOrder(null)
        setOrderItems([])
        setDiscount(0)
        setDiscountType('AMOUNT')
        setOrderStartTime(new Date())
        if (isMobile) setMobileTab('order')
        return
    }

    try {
        let targetOrderId: string

        if (activeOrders.length > 1) {
            // ── Multi-round: consolidate all into one order ──────────
            const roundCount = activeOrders.length
            setToast({ message: `⏳ กำลังรวม ${roundCount} รอบออเดอร์…`, type: 'warning' })

            const res = await fetch('/api/pos/orders/consolidate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableId: table.id }),
            })
            if (handleApiError(res, 'รวมออเดอร์')) return
            const json = await res.json()
            if (!json.success) {
                setToast({ message: json.error || 'ไม่สามารถรวมออเดอร์ได้', type: 'error' })
                return
            }
            // json.data is already the full merged order with items
            setCurrentOrder(json.data)
            setOrderItems((json.data.items ?? []).filter((i: OrderItemData) => !i.isCancelled))
            setDiscount(json.data.discount ?? 0)
            setDiscountType(json.data.discountType ?? 'AMOUNT')
            setOrderStartTime(json.data.openedAt ? new Date(json.data.openedAt) : new Date())
            setToast({ message: `✅ รวม ${roundCount} รอบออเดอร์เรียบร้อย`, type: 'success' })
            if (isMobile) setMobileTab('order')
            fetchTables()
            return
        }

        // ── Single order: load normally ──────────────────────────
        targetOrderId = activeOrders[0].id
        const res = await fetch(`/api/pos/orders/${targetOrderId}`)
        if (handleApiError(res, 'โหลดออเดอร์')) return
        const json = await res.json()
        if (json.success) {
            setCurrentOrder(json.data)
            setOrderItems(json.data.items.filter((i: OrderItemData) => !i.isCancelled))
            setDiscount(json.data.discount)
            setDiscountType(json.data.discountType)
            setOrderStartTime(json.data.openedAt ? new Date(json.data.openedAt) : new Date())
        } else {
            setToast({ message: json.error || 'ไม่สามารถโหลดออเดอร์ได้', type: 'error' })
        }
    } catch (e) {
        console.error('Load order error:', e)
        setToast({ message: 'เกิดข้อผิดพลาดในการโหลดออเดอร์', type: 'error' })
    }

    if (isMobile) setMobileTab('order')
}


// ─── Topping (per-product catalog) ────────────────────────────────────────
function parseToppings(json?: string | null): Topping[] {
    try { return json ? JSON.parse(json) : [] } catch { return [] }
}

// ─── เงื่อนไข trigger topping modal ──────────────────────────
// เปิด modal ถ้าเมนูนั้นมี toppings ไว้ (ดึงจาก catalog) หรือ category match
const requiresProteinSelection = (product: Product): boolean => {
    const toppings = parseToppings(product.toppingsJson)
    return toppings.filter(t => t.isActive).length > 0
}


// ─── Add Item to Order ────────────────────────────────────
const addItem = (product: Product) => {
    // ถ้าเมนูนี้ต้องเลือก topping → เปิด modal ก่อน
    if (requiresProteinSelection(product)) {
        setProteinPendingProduct(product)
        setProteinComment('')   // reset selected topping IDs
        setProteinNote('')      // reset text note
        return
    }
    setOrderItems(prev => {
        // Only merge with UNSAVED items (no DB id yet).
        // If the product is already saved to DB, always add a new line
        // so kitchen/bar gets a fresh ticket for the re-order.
        const existing = prev.find(i => i.productId === product.id && !i.note && !i.id)
        if (existing) {
            return prev.map(i =>
                i.productId === product.id && !i.note && !i.id
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

// เพิ่ม item พร้อม toppings + comment ลง order
const addItemWithProtein = (product: Product, selectedToppings: Topping[], comment: string = '') => {
    const toppingsTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0)
    const toppingNames = selectedToppings.map(t => t.name).join(', ')
    const note = [toppingNames, comment.trim()].filter(Boolean).join(' · ')
    setOrderItems(prev => [...prev, {
        productId: product.id,
        product,
        quantity: 1,
        unitPrice: product.salePrice + toppingsTotal,
        note: note || undefined,
        toppingsJson: selectedToppings.length > 0 ? JSON.stringify(selectedToppings) : undefined,
        toppingsTotal: toppingsTotal > 0 ? toppingsTotal : undefined,
    }])
    setProteinPendingProduct(null)
    setProteinComment('')
    setProteinNote('')
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

const updateItemNote = (index: number, note: string) => {
    setOrderItems(prev => {
        const updated = [...prev]
        updated[index] = { ...updated[index], note: note || undefined }
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
                            toppingsJson: i.toppingsJson || undefined,
                            toppingsTotal: i.toppingsTotal || undefined,
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
                        toppingsJson: i.toppingsJson || undefined,
                        toppingsTotal: i.toppingsTotal || undefined,
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
            const isDrink = code.includes('drink') || code.includes('bev') || name.includes('เครื่องดื่ม') || name.includes('น้ำ') || name.includes('เบียร์') || name.includes('เหล้า') || name.includes('แอลกอฮอล์') || code.includes('beer') || code.includes('wine') || code.includes('cocktail') || code.includes('water') || code.includes('entertain');
            if (isDrink) {
                barList.push(item);
            } else {
                kitchenList.push(item);
            }
        });

        // Auto print — delay bar slightly so popup blocker doesn't kill second window
        const orderNumber = currentOrder?.orderNumber || orderId.slice(-8)
        const tableName = selectedTable.name
        const sn = branding.displayName || 'ร้านอาหาร'
        if (kitchenList.length > 0) {
            printKitchenTicket({ station: 'KITCHEN', items: kitchenList, tableName, orderNumber, storeName: sn })
        }
        if (barList.length > 0) {
            setTimeout(() => {
                printKitchenTicket({ station: 'BAR', items: barList, tableName, orderNumber, storeName: sn })
            }, 300)
        }

        setSentItems({ kitchen: kitchenList, bar: barList, orderId, tableCode: tableName });
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
            const closedOrder = json.data.order as Order
            const confirmedSubtotal = Number(closedOrder.subtotal || 0)
            const confirmedDiscount = closedOrder.discountType === 'PERCENT'
                ? confirmedSubtotal * (Number(closedOrder.discount || 0) / 100)
                : Number(closedOrder.discount || 0)
            const receiptPrinter = getPrinterSettings().receiptPrinter
            const receiptPayload: AndroidPOSReceiptPayload = {
                schemaVersion: 1,
                requestId: createReceiptRequestId(orderId, 'ORIGINAL'),
                receiptType: 'ORIGINAL',
                orderId,
                receiptNo: closedOrder.orderNumber,
                saleDateTime: closedOrder.closedAt || new Date().toISOString(),
                store: {
                    name: branding.displayName || tenantSettings?.displayName || tenantSettings?.name || 'KAIDEEDER',
                    nameLao: tenantSettings?.storeNameLao || undefined,
                    phone: tenantSettings?.phone || undefined,
                    address: tenantSettings?.address || undefined,
                    taxId: tenantSettings?.taxId || undefined,
                    receiptHeader: tenantSettings?.receiptHeader || undefined,
                    logoUrl: branding.logoUrl || tenantSettings?.logoUrl || undefined,
                },
                items: closedOrder.items
                    .filter(item => !item.isCancelled)
                    .map(item => ({
                        name: item.product?.name || item.productId,
                        quantity: Number(item.quantity),
                        unitPrice: Number(item.unitPrice),
                        total: Number(item.quantity) * Number(item.unitPrice),
                        note: item.note || undefined,
                    })),
                subtotal: confirmedSubtotal,
                discount: confirmedDiscount,
                serviceCharge: Number(closedOrder.serviceCharge || 0),
                vat: Number(closedOrder.vat || 0),
                grandTotal: Number(closedOrder.totalAmount || 0),
                currency,
                payment: {
                    method: paymentMethod,
                    receivedAmount: received,
                    changeAmount: Number(json.data.changeAmount || 0),
                },
                options: {
                    // Android PosSettings is the final gate; reprints always force this false.
                    openCashDrawer: paymentMethod === 'CASH',
                    cutPaper: receiptPrinter.autoCut,
                },
            }

            let nativePrint: AndroidPOSResult | undefined
            if (isAndroidPOSApp()) {
                try {
                    nativePrint = printAndroidPOSReceipt(receiptPayload)
                    setToast(nativePrint.ok
                        ? { message: 'ส่งใบเสร็จไปยังเครื่องพิมพ์ SUNMI แล้ว', type: 'success' }
                        : { message: `ชำระเงินสำเร็จ แต่พิมพ์ใบเสร็จไม่สำเร็จ (${nativePrint.code})`, type: 'warning' })
                } catch (printError) {
                    nativePrint = {
                        ok: false,
                        code: 'BRIDGE_ERROR',
                        message: printError instanceof Error ? printError.message : 'AndroidPOS bridge error',
                    }
                    setToast({ message: 'ชำระเงินสำเร็จ แต่ไม่สามารถส่งใบเสร็จไปยัง SUNMI ได้', type: 'warning' })
                }
            }

            setCloseResult({
                changeAmount: json.data.changeAmount,
                orderId,
                stockWarnings: json.data.stockWarnings,
                receiptPayload,
                nativePrint,
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

const printClosedReceipt = () => {
    if (!closeResult?.orderId) return

    if (!isAndroidPOSApp() || !closeResult.receiptPayload) {
        window.open(`/receipt/${closeResult.orderId}`, '_blank', 'width=350,height=700')
        return
    }

    if (nativeReprintLoading) return
    setNativeReprintLoading(true)
    try {
        const result = reprintAndroidPOSReceipt(closeResult.receiptPayload)
        setToast(result.ok
            ? { message: 'ส่งคำขอพิมพ์ใบเสร็จซ้ำแล้ว', type: 'success' }
            : { message: `พิมพ์ใบเสร็จซ้ำไม่สำเร็จ (${result.code})`, type: 'warning' })
    } catch {
        setToast({ message: 'ไม่สามารถส่งคำขอพิมพ์ใบเสร็จซ้ำไปยัง SUNMI ได้', type: 'warning' })
    } finally {
        setNativeReprintLoading(false)
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
    setNativeReprintLoading(false)
    setSelectedTable(null)
    fetchTables()
}

const cancelOrder = () => {
    if (!confirm('ยกเลิกออเดอร์ทั้งหมด?')) return
    setCurrentOrder(null)
    setOrderItems([])
    setDiscount(0)
}

// ─── Open Table for QR Order (no items, creates OPEN order) ──────────
const openTableForQR = async () => {
    if (!selectedTable || currentOrder || loading) return
    setLoading(true)
    try {
        const res = await fetch('/api/pos/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tableId: selectedTable.id }),
        })
        if (handleApiError(res, 'เปิดโต๊ะ')) return
        const json = await res.json()
        if (json.success) {
            setCurrentOrder(json.data)
            setOrderItems([])
            setOrderStartTime(new Date())
            setToast({ message: `🟢 โต๊ะ ${selectedTable.name} เปิดแล้ว — ลูกค้าสแกน QR สั่งออเดอร์ได้เลย`, type: 'success' })
            fetchTables()
        } else {
            setToast({ message: json.error || 'เปิดโต๊ะไม่สำเร็จ', type: 'error' })
        }
    } catch { setToast({ message: 'เกิดข้อผิดพลาดในการเปิดโต๊ะ', type: 'error' }) }
    finally { setLoading(false) }
}

const closeEmptyTable = async () => {
    if (loading) return
    if (orderItems.length > 0) {
        setToast({ message: 'ยังมีรายการอาหาร กรุณาเช็คบิลก่อนปิดโต๊ะ', type: 'warning' })
        return
    }
    if (!confirm(`ยืนยันปิดโต๊ะ ${selectedTable?.name}?\n(Order ทั้งหมดของโต๊ะนี้จะถูกยกเลิก)`)) return
    setLoading(true)
    try {
        // Step 1: ถ้ายังไม่มี currentOrder (เช่น consolidate ก่อนหน้าล้มเหลว) → ลอง consolidate ใหม่
        let orderId = currentOrder?.id
        if (!orderId && selectedTable) {
            const cr = await fetch('/api/pos/orders/consolidate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableId: selectedTable.id }),
            })
            const cj = await cr.json()
            if (cj.success && cj.data?.id) {
                orderId = cj.data.id
            }
        }
        if (!orderId) {
            // ไม่มี order เลย → reset table state ตรงๆ
            setCurrentOrder(null)
            setOrderItems([])
            setSelectedTable(null)
            fetchTables()
            return
        }
        // Step 2: ลบ order ที่ได้
        const res = await fetch(`/api/pos/orders/${orderId}`, { method: 'DELETE' })
        const json = await res.json()
        if (json.success) {
            setCurrentOrder(null)
            setOrderItems([])
            setSelectedTable(null)
            setToast({ message: `โต๊ะ ${selectedTable?.name} ปิดแล้ว`, type: 'success' })
            fetchTables()
        } else {
            setToast({ message: json.error || 'ปิดโต๊ะไม่สำเร็จ', type: 'error' })
        }
    } catch { setToast({ message: 'เกิดข้อผิดพลาดในการปิดโต๊ะ', type: 'error' }) }
    finally { setLoading(false) }
}

// ─── Force-clear stuck table (no active order but OCCUPIED) ───────
const forceClearTable = async () => {
    if (!selectedTable) return
    if (!confirm(`บังคับปลดล็อคโต๊ะ ${selectedTable.name}?\n(ใช้เมื่อโต๊ะค้างอยู่โดยไม่มีออเดอร์)`)) return
    setLoading(true)
    try {
        const res = await fetch(`/api/pos/tables/${selectedTable.id}/force-clear`, { method: 'POST' })
        const json = await res.json()
        if (json.success) {
            setCurrentOrder(null)
            setOrderItems([])
            setSelectedTable(null)
            setToast({ message: `✅ ปลดล็อคโต๊ะ ${selectedTable.name} แล้ว`, type: 'success' })
            fetchTables()
        } else {
            setToast({ message: json.error || 'ปลดล็อคไม่สำเร็จ', type: 'error' })
        }
    } catch { setToast({ message: 'เกิดข้อผิดพลาด', type: 'error' }) }
    finally { setLoading(false) }
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
    // ซ่อนสินค้าที่อยู่ในหมวดที่ถูกปิด (เฉพาะตอน ALL และไม่ได้ search)
    if (selectedCategory === 'ALL' && hiddenCategories.has(p.categoryId) && !searchQuery) return false
    if (selectedCategory !== 'ALL' && p.categoryId !== selectedCategory) return false
    if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    }
    return true
})

const toggleCategoryVisibility = (catId: string) => {
    setHiddenCategories(prev => {
        const next = new Set(prev)
        if (next.has(catId)) next.delete(catId)
        else next.add(catId)
        return next
    })
}


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
        {/* ── New order alert — POS page only ── */}
        <NewOrderAlert />


        {/* ════ TOPPING MODAL (Dynamic — catalog-driven) ════ */}
        {proteinPendingProduct && (() => {
            const availableToppings = parseToppings(proteinPendingProduct.toppingsJson).filter(t => t.isActive)
            const hasCatalogToppings = availableToppings.length > 0
            return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '1rem' }}
                    onClick={() => { setProteinPendingProduct(null); setProteinComment(''); setProteinNote('') }}>
                    <div style={{ background: '#fff', borderRadius: 20, padding: '1.5rem', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', maxHeight: '88vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>🌶️</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A1D26' }}>{proteinPendingProduct.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, marginTop: 4 }}>
                                {formatLAK(proteinPendingProduct.salePrice)}
                            </div>
                        </div>

                        {/* ── Dynamic Topping Picker ────────────────────────────────────────── */}
                        {/* ใช้ state จาก proteinComment เป็น JSON ชั่วคราวเก็บ selectedIds */}
                        {(() => {
                            let selected: string[] = []
                            try { selected = proteinComment ? JSON.parse(proteinComment) : [] } catch { selected = [] }
                            const selectedToppings = availableToppings.filter(t => selected.includes(t.id))
                            const toppingsTotal = selectedToppings.reduce((s, t) => s + t.price, 0)

                            function toggleToppingId(id: string) {
                                const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
                                setProteinComment(JSON.stringify(next))
                            }

                            return (
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                                        🌶️ เลือกท็อปปิ้ดพิเศษ (ราคาจะบวกเพิ่มอัตโนมัติ)
                                    </div>

                                    {/* Topping checkboxes */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                                        {availableToppings.map(t => {
                                            const isSel = selected.includes(t.id)
                                            return (
                                                <button key={t.id} onClick={() => toggleToppingId(t.id)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                                        borderRadius: 14, border: `2px solid ${isSel ? '#F59E0B' : '#E5E7EB'}`,
                                                        background: isSel ? '#FFFBEB' : '#FAFAFA',
                                                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                                    }}>
                                                    <span style={{
                                                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                                        border: `2px solid ${isSel ? '#F59E0B' : '#D1D5DB'}`,
                                                        background: isSel ? '#F59E0B' : '#fff',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.75rem', color: '#fff', fontWeight: 800,
                                                    }}>{isSel ? '✓' : ''}</span>
                                                    <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9rem', color: '#1A1D26', textAlign: 'left' }}>
                                                        {t.name}
                                                    </span>
                                                    <span style={{
                                                        fontWeight: 800, fontSize: '0.88rem',
                                                        color: isSel ? '#D97706' : '#9CA3AF',
                                                    }}>+{formatLAK(t.price)}</span>
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Optional Note input */}
                                    <div style={{ marginBottom: 14 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>📝 หมายเหตุเพิ่มเติม</div>
                                        <input type="text" placeholder="เช่น ไม่เผ็ด, เด็กกิน, แยกน้ำ..." value={proteinNote} onChange={e => setProteinNote(e.target.value)}
                                            style={{ width: '100%', padding: '0.65rem 1rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontFamily: 'inherit', fontSize: '0.88rem', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Price summary strip */}
                                    {toppingsTotal > 0 && (
                                        <div style={{
                                            background: '#FFF7ED', border: '1.5px solid #FDE68A', borderRadius: 12,
                                            padding: '8px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}>
                                            <span style={{ fontSize: '0.82rem', color: '#92400E', fontWeight: 600 }}>รวมท็อปปิ้ง</span>
                                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#D97706' }}>+{formatLAK(toppingsTotal)}</span>
                                        </div>
                                    )}
                                    <div style={{
                                        background: '#F0FDF4', border: '1.5px solid #A7F3D0', borderRadius: 12,
                                        padding: '8px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                        <span style={{ fontSize: '0.82rem', color: '#065F46', fontWeight: 600 }}>รวมทั้งสิ้น</span>
                                        <span style={{ fontWeight: 900, fontSize: '1rem', color: '#059669' }}>{formatLAK(proteinPendingProduct.salePrice + toppingsTotal)}</span>
                                    </div>

                                    {/* Confirm button */}
                                    <button
                                        onClick={() => addItemWithProtein(proteinPendingProduct, selectedToppings, proteinNote)}
                                        style={{
                                            width: '100%', padding: '0.75rem', borderRadius: 12, border: 'none',
                                            background: 'linear-gradient(135deg, #059669, #10B981)',
                                            color: '#fff', fontWeight: 800, fontSize: '0.95rem',
                                            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8,
                                            boxShadow: '0 4px 14px rgba(5,150,105,0.4)',
                                        }}>
                                        ✅ เพิ่มลงออเดอร์ {toppingsTotal > 0 ? `(${formatLAK(proteinPendingProduct.salePrice + toppingsTotal)})` : ''}
                                    </button>
                                    <button onClick={() => { setProteinPendingProduct(null); setProteinComment(''); setProteinNote('') }}
                                        style={{ width: '100%', padding: '0.55rem', borderRadius: 10, border: '1px solid #E5E7EB', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#9CA3AF', fontSize: '0.82rem', fontWeight: 600 }}>
                                        ยกเลิก
                                    </button>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            )
        })()}


        {/* ════ LEFT PANEL — Table Grid ════ */}
        <div style={{ flex: isMobile ? '0 0 100%' : (isTablet ? '0 0 45%' : '0 0 56%'), display: isMobile && mobileTab !== 'tables' ? 'none' : 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB', background: '#fff', overflow: 'hidden', paddingBottom: isMobile ? 60 : 0 }}>
            {/* Top Bar */}
            <div style={{ background: '#1A1D26', color: '#fff', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: '1.3rem' }}>🍽️</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{branding.displayName} POS</div>
                    <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>
                        ว่าง <span style={{ color: '#4ADE80', fontWeight: 700 }}>{availableCount}</span>
                        &nbsp;•&nbsp; มีออเดอร์ <span style={{ color: '#FB7185', fontWeight: 700 }}>{occupiedCount}</span>
                    </div>
                </div>
                {!isMobile && (
                    <button
                        onClick={() => {
                            setShowHistory(true)
                            setHistoryLoading(true)
                            fetch('/api/pos/history?limit=80')
                                .then(r => r.json())
                                .then(d => {
                                    if (d.success) {
                                        setHistoryOrders(d.data)
                                        setSelectedHistoryOrder(d.data[0] ?? null)
                                    }
                                })
                                .finally(() => setHistoryLoading(false))
                        }}
                        style={{
                            fontSize: '0.78rem', color: '#fff', cursor: 'pointer',
                            padding: '5px 14px', borderRadius: 8,
                            border: '1px solid #F59E0B',
                            background: 'rgba(245,158,11,0.15)',
                            fontFamily: 'inherit', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        🕐 ประวัติ
                    </button>
                )}
                <button
                    onClick={() => {
                        setDeliveryMode(m => {
                            if (!m) fetchDeliveryOrders()
                            return !m
                        })
                    }}
                    style={{
                        fontSize: '0.78rem', cursor: 'pointer',
                        padding: '5px 14px', borderRadius: 8,
                        border: `1px solid ${deliveryMode ? '#86EFAC' : '#4ADE80'}`,
                        background: deliveryMode ? 'rgba(74,222,128,0.25)' : 'rgba(74,222,128,0.12)',
                        color: '#4ADE80', fontFamily: 'inherit', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}
                >
                    🚵 {deliveryMode ? 'ปิด Delivery' : 'Delivery'}
                    {deliveryOrders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.deliveryInfo?.deliveryStatus)).length > 0 && (
                        <span style={{ background: '#E8364E', color: '#fff', borderRadius: 99, fontSize: '0.65rem', padding: '1px 6px', fontWeight: 800 }}>
                            {deliveryOrders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.deliveryInfo?.deliveryStatus)).length}
                        </span>
                    )}
                </button>
                <a href="/dashboard" style={{ fontSize: '0.78rem', color: '#9CA3AF', textDecoration: 'none', padding: '5px 12px', borderRadius: 8, border: '1px solid #374151' }}>← กลับ</a>
            </div>

            {/* ── DELIVERY QUEUE (when delivery mode active) ── */}
            {deliveryMode && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <button
                        onClick={() => setShowDeliveryModal(true)}
                        style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 12, padding: '0.65rem 1rem', fontFamily: 'inherit', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
                    >
                        ➕ สร้างออเดอร์ Delivery
                    </button>
                    {deliveryOrders.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '3rem 1rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🚵</div>
                            <div style={{ fontSize: '0.85rem' }}>ยังไม่มีออเดอร์ delivery</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>กดปุ่มด้านบนเพื่อสร้างออเดอร์ใหม่</div>
                        </div>
                    ) : deliveryOrders.map(order => {
                        const info = order.deliveryInfo
                        const statusColors: Record<string, { bg: string; color: string; label: string }> = {
                            RECEIVED: { bg: '#FEF3C7', color: '#D97706', label: '📦 รับออเดอร์' },
                            PREPARING: { bg: '#DBEAFE', color: '#1D4ED8', label: '👨‍🍳 กำลังทำ' },
                            ASSIGNED: { bg: '#E0E7FF', color: '#4F46E5', label: '🚵 มอบ rider แล้ว' },
                            OUT_FOR_DELIVERY: { bg: '#D1FAE5', color: '#059669', label: '🚗 ออกส่ง' },
                            DELIVERED: { bg: '#F0FDF4', color: '#16A34A', label: '✅ ส่งแล้ว' },
                            CANCELLED: { bg: '#FEF2F2', color: '#DC2626', label: '❌ ยกเลิก' },
                        }
                        const sc = statusColors[info?.deliveryStatus] || statusColors.RECEIVED
                        const nextStatus: Record<string, string> = {
                            RECEIVED: 'PREPARING', PREPARING: 'OUT_FOR_DELIVERY',
                            OUT_FOR_DELIVERY: 'DELIVERED',
                        }
                        const next = info ? nextStatus[info.deliveryStatus] : null
                        return (
                            <div key={order.id} style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 14, padding: '0.8rem 1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1A1D26' }}>{info?.customerName || '-'}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>{info?.customerPhone} • {info?.channel}</div>
                                    </div>
                                    <span style={{ background: sc.bg, color: sc.color, borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px' }}>{sc.label}</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#374151', marginBottom: 6, background: '#F9FAFB', borderRadius: 8, padding: '4px 8px' }}>
                                    📍 {info?.addressText}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#E8364E' }}>
                                        {fmt(order.totalAmount)} {info?.deliveryFee > 0 && <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(ค่าส่ง {fmt(info.deliveryFee)})</span>}
                                    </div>
                                    {next && (
                                        <button
                                            onClick={async () => {
                                                const r = await fetch(`/api/pos/delivery/${info.id}/status`, {
                                                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ deliveryStatus: next }),
                                                })
                                                if (r.ok) fetchDeliveryOrders()
                                            }}
                                            style={{ background: '#1A1D26', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                        >
                                            {next === 'PREPARING' ? '👨‍🍳 เริ่มทำ' : next === 'OUT_FOR_DELIVERY' ? '🚗 ออกส่ง' : '✅ ส่งแล้ว'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Zone Tabs & View Mode Toggle */}
            {!deliveryMode && (
                <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', background: '#FAFBFD' }}>
                    <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0, flex: 1 }}>
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
                    {/* View Mode Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', gap: 4, flexShrink: 0, borderLeft: '1px solid #E5E7EB' }}>
                        <button onClick={() => setViewMode('grid')} style={{ padding: '0.4rem', borderRadius: 6, background: viewMode === 'grid' ? 'rgba(232,54,78,0.1)' : 'transparent', border: '1px solid', borderColor: viewMode === 'grid' ? 'rgba(232,54,78,0.3)' : 'transparent', color: viewMode === 'grid' ? '#E8364E' : '#9CA3AF', cursor: 'pointer' }} title="Grid View">🔲</button>
                        <button onClick={() => setViewMode('map')} style={{ padding: '0.4rem', borderRadius: 6, background: viewMode === 'map' ? 'rgba(232,54,78,0.1)' : 'transparent', border: '1px solid', borderColor: viewMode === 'map' ? 'rgba(232,54,78,0.3)' : 'transparent', color: viewMode === 'map' ? '#E8364E' : '#9CA3AF', cursor: 'pointer' }} title="Map View">🗺️</button>
                    </div>
                </div>
            )}

            {/* Table Grid / Map */}
            {!deliveryMode && viewMode === 'map' ? (
                <div style={{ flex: 1, overflow: 'auto', background: '#F3F4F6', position: 'relative' }}>
                    <div style={{ position: 'relative', width: 1200, height: 1600, margin: '1rem', background: '#fff', borderRadius: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                        {displayTables.map(table => {
                            const hasOrder = !!(table.orders && table.orders.length > 0)
                            const allOrders = (table.orders ?? []) as Order[]
                            const hasPending = allOrders.some(o => o.status === 'PENDING_CONFIRM')
                            const isSelected = selectedTable?.id === table.id
                            let bg = isSelected ? '#1A1D26' : hasOrder ? '#1E2533' : '#FFFFFF'
                            let color = (hasOrder || isSelected) ? '#FFFFFF' : '#1A1D26'
                            let borderColor = isSelected ? '#E8364E' : hasPending ? '#F59E0B' : hasOrder ? '#374151' : '#E5E7EB'
                            
                            const tShape = table.shape || 'square'
                            const tWidth = table.width || 80
                            const tHeight = table.height || 80
                            const tX = table.posX || 0
                            const tY = table.posY || 0

                            return (
                                <button
                                    key={table.id}
                                    onClick={() => selectTable(table)}
                                    style={{
                                        position: 'absolute', left: tX, top: tY,
                                        width: tWidth, height: tHeight,
                                        borderRadius: tShape === 'circle' ? '50%' : 8,
                                        background: bg, border: `2px solid ${borderColor}`, color,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', fontFamily: 'inherit',
                                        boxShadow: hasOrder ? '0 4px 16px rgba(0,0,0,0.18)' : '0 2px 4px rgba(0,0,0,0.05)',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    <span style={{ fontWeight: 800, fontSize: tShape === 'rectangle' ? '1rem' : '0.9rem' }}>{table.name}</span>
                                    {hasPending && <span style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%', background: '#F59E0B', border: '2px solid #fff' }} />}
                                    {hasOrder && !hasPending && <span style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%', background: '#FB7185', border: '2px solid #fff' }} />}
                                </button>
                            )
                        })}
                        {displayTables.length === 0 && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🪑</div>
                                <div style={{ fontWeight: 600 }}>ไม่มีโต๊ะในโซนนี้</div>
                            </div>
                        )}
                    </div>
                </div>
            ) : !deliveryMode && viewMode === 'grid' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '0.6rem', alignContent: 'start' }}>
                    {displayTables.map(table => {
                        const hasOrder = !!(table.orders && table.orders.length > 0)
                        const elapsed = elapsedLabel(table)
                        const allOrders = (table.orders ?? []) as Order[]
                        const roundCount = allOrders.length
                        // Sum ALL rounds into one grand total
                        const grandTotal = allOrders.reduce((s, o) => {
                            const orderTotal = o.totalAmount > 0
                                ? o.totalAmount
                                : o.items.reduce((is, i) => is + i.quantity * i.unitPrice, 0)
                            return s + orderTotal
                        }, 0)
                        const hasPending = allOrders.some(o => o.status === 'PENDING_CONFIRM')
                        const isSelected = selectedTable?.id === table.id
                        return (
                            <button key={table.id} onClick={() => selectTable(table)} style={{ background: isSelected ? '#1A1D26' : hasOrder ? '#1E2533' : '#FFFFFF', border: `2px solid ${isSelected ? '#E8364E' : hasPending ? '#F59E0B' : hasOrder ? '#374151' : '#E5E7EB'}`, borderRadius: 16, padding: '0.9rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: (hasOrder || isSelected) ? '#FFFFFF' : '#1A1D26', transition: 'all 0.18s ease', boxShadow: hasOrder ? '0 4px 16px rgba(0,0,0,0.18)' : '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 5, minHeight: 110 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{table.name}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {hasPending && (
                                            <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#F59E0B', color: '#fff', borderRadius: 99, padding: '1px 6px', animation: 'pulse-badge 1.5s ease-in-out infinite' }}>
                                                ⏳ รอยืนยัน
                                            </span>
                                        )}
                                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: hasPending ? '#F59E0B' : hasOrder ? '#FB7185' : '#4ADE80' }} />
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.62rem', color: (hasOrder || isSelected) ? '#9CA3AF' : '#6B7280' }}>📍 {table.zone} • {table.seats} ที่นั่ง</div>
                                <div style={{ marginTop: 'auto' }}>
                                    {hasOrder ? (
                                        <>
                                            {nowString && elapsed && <div style={{ fontSize: '0.7rem', color: '#FCD34D', fontWeight: 700 }}>⏱️ {elapsed}</div>}
                                            {grandTotal > 0 && <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#4ADE80' }}>{formatLAK(grandTotal)}</div>}
                                            {hasPending && <div style={{ fontSize: '0.6rem', color: '#FCD34D', marginTop: 1 }}>🕐 รอยืนยัน</div>}
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
            )}

            {/* Bottom Filter Bar */}
            <div style={{ display: 'flex', gap: 4, padding: '0.5rem 0.75rem', borderTop: '1px solid #E5E7EB', background: '#FAFBFD', flexShrink: 0 }}>
                {[['เมนู', 'menu'], ['ยังไม่ได้รับ', 'pending'], ['ครัว', 'kitchen'], ['ประวัติ', 'history']].map(([label, action]) => (
                    <button key={label as string}
                        onClick={() => {
                            if (action === 'history') {
                                setShowHistory(true)
                                setHistoryLoading(true)
                                fetch('/api/pos/history?limit=80')
                                    .then(r => r.json())
                                    .then(d => { if (d.success) { setHistoryOrders(d.data); setSelectedHistoryOrder(d.data[0] ?? null) } })
                                    .finally(() => setHistoryLoading(false))
                            } else if (action === 'kitchen') {
                                setShowKitchenPopup(true)
                                fetch('/api/kitchen/queue?status=PENDING,ACCEPTED,COOKING,READY')
                                    .then(r => r.json())
                                    .then(d => {
                                        if (d.success) {
                                            setKitchenQueue(d.data.queue ?? [])
                                            setSelectedKitchenOrder(d.data.queue?.[0] ?? null)
                                        }
                                    })
                            } else if (action === 'pending') {
                                window.open('/kitchen', '_blank')
                            }
                        }}
                        style={{
                            padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid #E5E7EB',
                            background: action === 'history' ? '#FEF3C7' : action === 'kitchen' ? '#FFF1F2' : '#fff',
                            fontSize: '0.78rem',
                            color: action === 'history' ? '#92400E' : action === 'kitchen' ? '#BE123C' : '#6B7280',
                            cursor: 'pointer', fontFamily: 'inherit',
                            fontWeight: (action === 'history' || action === 'kitchen') ? 700 : 400,
                        }}>
                        {action === 'history' ? '🕐 ' : action === 'kitchen' ? '🍳 ' : ''}{label as string}
                    </button>
                ))}
            </div>
        </div>

        {/* ════ RIGHT PANEL — Order Detail ════ */}
        <div style={{ flex: 1, display: isMobile && mobileTab !== 'order' ? 'none' : 'flex', flexDirection: 'column', background: '#FAFBFD', overflow: 'hidden', minWidth: 0, paddingBottom: isMobile ? 60 : 0 }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem', padding: '0.75rem', flexShrink: 0 }}>
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
                            { label: currentOrder ? 'QR✓' : 'เปิด QR', icon: '📱', bg: currentOrder ? '#059669' : '#0D9488', onClick: openTableForQR, off: !!currentOrder || loading },
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
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '3fr 1.5fr 1.5fr 0.5fr' : '3fr 1.2fr 1fr 1.2fr 1fr 0.5fr', padding: '0.4rem 0.75rem', fontSize: '0.72rem', color: '#9CA3AF', gap: 4 }}>
                            {(isMobile ? ['รายการ', 'จำนวน', 'รวม', '#'] : ['รายการ', 'ราคา', 'จำนวน', 'รวม', 'สถานะ', '#']).map(h => <span key={h}>{h}</span>)}
                        </div>
                    </div>

                    {/* Order Items List */}
                    <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
                        {orderItems.length === 0 ? (
                            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {/* QR Open Card — show when table is not opened yet */}
                                {!currentOrder && (
                                    <div style={{
                                        borderRadius: 16, border: '2px dashed #10B981',
                                        background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
                                        padding: '1.25rem', textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📱</div>
                                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#065f46', marginBottom: 4 }}>
                                            เปิดโต๊ะให้ลูกค้า QR สั่งเองได้เลย
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#047857', marginBottom: 12, lineHeight: 1.5 }}>
                                            กดปุ่ม <b>เปิด QR</b> ด้านบน หรือปุ่มด้านล่างนี้<br />
                                            แล้วให้ลูกค้า สแกน QR บนโต๊ะ → สั่งได้เลย
                                        </div>
                                        <button
                                            onClick={openTableForQR}
                                            disabled={loading}
                                            style={{
                                                background: loading ? '#d1d5db' : '#059669',
                                                color: '#fff', border: 'none', borderRadius: 12,
                                                padding: '0.7rem 1.5rem', fontSize: '0.88rem',
                                                fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                                                fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
                                                display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto',
                                            }}
                                        >
                                            📱 {loading ? 'กำลังเปิด...' : 'เปิดโต๊ะ QR Order'}
                                        </button>
                                    </div>
                                )}
                                {/* Already open — show QR hint */}
                                {(currentOrder || (selectedTable?.orders && selectedTable.orders.length > 0)) && (
                                    <div style={{
                                        borderRadius: 14, border: '1.5px solid #A7F3D0',
                                        background: '#ECFDF5', padding: '0.9rem 1rem',
                                        display: 'flex', alignItems: 'center', gap: 10,
                                    }}>
                                        <span style={{ fontSize: '1.4rem' }}>🟢</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#065f46' }}>
                                                โต๊ะ {selectedTable?.name} เปิดแล้ว
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#047857', marginTop: 2 }}>
                                                ลูกค้าสแกน QR สั่งออเดอร์ได้เลย
                                            </div>
                                        </div>
                                        {/* ปิดโต๊ะ — only if no items yet */}
                                        {orderItems.length === 0 && (
                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                <button
                                                    onClick={closeEmptyTable}
                                                    disabled={loading}
                                                    style={{
                                                        background: '#dc2626', color: '#fff',
                                                        border: 'none', borderRadius: 8,
                                                        padding: '5px 12px', fontSize: '0.72rem',
                                                        fontWeight: 700, cursor: 'pointer',
                                                        fontFamily: 'inherit',
                                                    }}
                                                >
                                                    ❌ ปิดโต๊ะ
                                                </button>
                                                <button
                                                    onClick={forceClearTable}
                                                    disabled={loading}
                                                    title="บังคับปลดล็อคโต๊ะที่ค้างอยู่โดยไม่มีออเดอร์"
                                                    style={{
                                                        background: '#6B7280', color: '#fff',
                                                        border: 'none', borderRadius: 8,
                                                        padding: '5px 10px', fontSize: '0.72rem',
                                                        fontWeight: 700, cursor: 'pointer',
                                                        fontFamily: 'inherit',
                                                    }}
                                                >
                                                    🔓 ปลดล็อค
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Generic empty hint */}
                                <div style={{ textAlign: 'center', padding: '0.75rem', color: '#9CA3AF' }}>
                                    <div style={{ fontSize: '1.5rem' }}>🛒</div>
                                    <div style={{ fontSize: '0.82rem', marginTop: 4 }}>กด ➕ เพิ่มเมนูจากพนักงาน</div>
                                </div>
                            </div>
                        ) : (
                            orderItems.map((item, idx) => (
                                <div key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '3fr 1.5fr 1.5fr 0.5fr' : '3fr 1.2fr 1fr 1.2fr 1fr 0.5fr', padding: '0.5rem 0.75rem', alignItems: 'center', gap: 4 }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1A1D26', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product?.name || item.productId}</span>
                                        {!isMobile && <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>{formatLAK(item.unitPrice)}</span>}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <button onClick={() => updateItemQty(idx, -1)} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>−</button>
                                            <span style={{ minWidth: 18, textAlign: 'center', fontSize: '0.82rem', fontWeight: 700 }}>{item.quantity}</span>
                                            <button onClick={() => updateItemQty(idx, 1)} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem' }}>+</button>
                                        </div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#E8364E' }}>{formatLAK(item.quantity * item.unitPrice)}</span>
                                        {!isMobile && (() => {
                                            const st = item.kitchenStatus || 'PENDING'
                                            const icon = { PENDING: '⏳', ACCEPTED: '👌', COOKING: '🔥', READY: '✅', SERVED: '🍽️' }[st] || '⏳'
                                            const col = { PENDING: '#F59E0B', ACCEPTED: '#3B82F6', COOKING: '#EF4444', READY: '#10B981', SERVED: '#6B7280' }[st] || '#F59E0B'
                                            return <span style={{ fontSize: '0.72rem', color: col, fontWeight: 600 }}>{icon}</span>
                                        })()}
                                        <button onClick={() => removeItem(idx)} style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                                    </div>
                                    {/* Note Input */}
                                    <div style={{ padding: '0 0.75rem 0.5rem 0.75rem' }}>
                                        <input
                                            type="text"
                                            placeholder="📝 หมายเหตุ (เช่น ไม่เผ็ด, เด็กกิน)..."
                                            value={item.note || ''}
                                            onChange={e => updateItemNote(idx, e.target.value)}
                                            style={{ width: '100%', fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#FAFAFA', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>

        {/* ════ MOBILE BOTTOM NAV ════ */}
        {isMobile && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 150, background: '#1A1D26', borderTop: '1px solid #374151', display: 'flex', height: 60, paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <button onClick={() => setMobileTab('tables')} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: mobileTab === 'tables' ? '#E8364E' : '#9CA3AF', transition: 'color 0.15s' }}>
                    <span style={{ fontSize: '1.3rem' }}>🪑</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: mobileTab === 'tables' ? 700 : 400 }}>โต๊ะ</span>
                </button>
                <button onClick={() => { if (selectedTable) setMobileTab('order'); else setToast({ message: 'กรุณาเลือกโต๊ะก่อน', type: 'warning' }) }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: mobileTab === 'order' ? '#E8364E' : '#9CA3AF', position: 'relative', transition: 'color 0.15s' }}>
                    <span style={{ fontSize: '1.3rem' }}>🛒</span>
                    {orderItems.length > 0 && <span style={{ position: 'absolute', top: 8, right: '28%', background: '#E8364E', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{orderItems.length}</span>}
                    <span style={{ fontSize: '0.65rem', fontWeight: mobileTab === 'order' ? 700 : 400 }}>รายการ</span>
                </button>
                <button onClick={() => { if (orderItems.length > 0) { setShowReceiptPreview(true) } else setToast({ message: 'ยังไม่มีรายการ', type: 'warning' }) }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', transition: 'color 0.15s' }}>
                    <span style={{ fontSize: '1.3rem' }}>💳</span>
                    <span style={{ fontSize: '0.65rem' }}>ชำระ</span>
                </button>
            </div>
        )}

        {/* ════ MENU OVERLAY ════ */}
        {showMenuOverlay && (
            <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', background: '#F0F2F5' }}>
                    {/* Left: Category tabs + Product grid */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Category Horizontal Scroll */}
                        <div style={{ display: 'flex', alignItems: 'center', background: '#1A1D26', flexShrink: 0, overflow: 'hidden' }}>
                            {/* Scrollable tabs */}
                            <div style={{ flex: 1, display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
                                {/* ALL tab — hidden in edit mode */}
                                {!catEditMode && (
                                    <button onClick={() => setSelectedCategory('ALL')} style={{ padding: '0.65rem 1rem', border: 'none', background: selectedCategory === 'ALL' ? '#E8364E' : 'transparent', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: selectedCategory === 'ALL' ? 700 : 400, fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0 }}>เมนู</button>
                                )}
                                {categories.map(cat => {
                                    const isHidden = hiddenCategories.has(cat.id)
                                    const isActive = selectedCategory === cat.id
                                    if (catEditMode) {
                                        // Edit mode: show all as toggle pill
                                        return (
                                            <button key={cat.id}
                                                onClick={() => toggleCategoryVisibility(cat.id)}
                                                style={{
                                                    padding: '0.45rem 0.85rem', border: `2px solid ${isHidden ? '#4B5563' : '#4ADE80'}`,
                                                    borderRadius: 99, margin: '0.3rem 0.25rem',
                                                    background: isHidden ? 'rgba(75,85,99,0.3)' : 'rgba(74,222,128,0.15)',
                                                    color: isHidden ? '#9CA3AF' : '#4ADE80',
                                                    cursor: 'pointer', fontFamily: 'inherit',
                                                    fontWeight: 700, fontSize: '0.78rem',
                                                    whiteSpace: 'nowrap', flexShrink: 0,
                                                    display: 'flex', alignItems: 'center', gap: 5,
                                                    transition: 'all 0.15s',
                                                    textDecoration: isHidden ? 'line-through' : 'none',
                                                    opacity: isHidden ? 0.6 : 1,
                                                }}
                                            >
                                                <span style={{ fontSize: '0.9rem' }}>{isHidden ? '🚫' : '👁'}</span>
                                                {cat.icon} {cat.name}
                                            </button>
                                        )
                                    }
                                    // Normal mode
                                    if (isHidden) return null  // ซ่อนหมวดที่ถูกปิด
                                    return (
                                        <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                                            style={{ padding: '0.65rem 0.9rem', border: 'none', background: isActive ? (cat.color || '#E8364E') : 'transparent', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: isActive ? 700 : 400, fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                                        >
                                            {cat.icon} {cat.name}
                                        </button>
                                    )
                                })}
                            </div>
                            {/* Edit mode toggle button */}
                            <button
                                onClick={() => { setCatEditMode(m => !m); if (catEditMode) setSelectedCategory('ALL') }}
                                title={catEditMode ? 'เสร็จสิ้นการแก้ไข' : 'แก้ไขหมวดหมู่ที่แสดง'}
                                style={{
                                    flexShrink: 0, padding: '0.5rem 0.75rem',
                                    border: `1.5px solid ${catEditMode ? '#4ADE80' : '#374151'}`,
                                    background: catEditMode ? 'rgba(74,222,128,0.15)' : 'rgba(55,65,81,0.5)',
                                    color: catEditMode ? '#4ADE80' : '#9CA3AF',
                                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                    borderRadius: 8, fontFamily: 'inherit', whiteSpace: 'nowrap',
                                    marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: 4,
                                    transition: 'all 0.15s',
                                }}
                            >
                                {catEditMode ? '✓ เสร็จ' : '⚙️'}
                            </button>
                        </div>
                        {/* Search */}
                        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #E5E7EB', background: '#fff', flexShrink: 0 }}>
                            <input ref={searchRef} type="text" placeholder="🔍 ค้นหาเมนู..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '0.45rem 0.75rem', border: '1px solid #E5E7EB', borderRadius: 10, fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none', background: '#FAFBFD' }} />
                        </div>
                        {/* Product Grid */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 130 : 150}px, 1fr))`, gap: '0.6rem', alignContent: 'start' }}>
                            {filteredProducts.map(product => {
                                const catColor = product.category?.color || '#4B5563'
                                const bg = product.imageUrl
                                    ? `url("${product.imageUrl}") center/cover no-repeat`
                                    : catColor
                                return (
                                    <div key={product.id} role="button" tabIndex={0}
                                        onClick={() => addItem(product)}
                                        onKeyDown={e => e.key === 'Enter' && addItem(product)}
                                        style={{
                                            position: 'relative',
                                            minHeight: 170,
                                            borderRadius: 14,
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            background: bg,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                                            transition: 'transform 0.15s, box-shadow 0.15s',
                                            userSelect: 'none',
                                        }}
                                        onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'scale(1.03)'; d.style.boxShadow = '0 6px 20px rgba(0,0,0,0.22)' }}
                                        onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; d.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)' }}>
                                        {/* Emoji for no-image */}
                                        {!product.imageUrl && (
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', opacity: 0.85 }}>
                                                {product.category?.icon || '🍽️'}
                                            </div>
                                        )}
                                        {/* Price badge */}
                                        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(10,10,10,0.75)', backdropFilter: 'blur(6px)', borderRadius: 8, padding: '2px 8px', color: '#FCD34D', fontWeight: 800, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                            {formatLAK(product.salePrice)} ₭
                                        </div>
                                        {/* Bottom gradient + name */}
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.72))', padding: '20px 8px 8px' }}>
                                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.3, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                                                {product.name}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {filteredProducts.length === 0 && (
                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>📭 ไม่พบเมนู</div>
                            )}
                        </div>
                    </div>
                    {/* Right: Cart summary — desktop only */}
                    <div style={{ width: 300, display: isMobile ? 'none' : 'flex', flexDirection: 'column', background: '#fff', borderLeft: '1px solid #E5E7EB' }}>
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                                            <span style={{ flex: 1, fontSize: '0.83rem', fontWeight: 600, color: '#1A1D26' }}>({item.quantity}) {item.product?.name}</span>
                                            <button onClick={() => removeItem(idx)} style={{ background: '#EF4444', border: 'none', color: '#fff', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                                            <button onClick={() => updateItemQty(idx, -1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>−</button>
                                            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>{item.quantity}</span>
                                            <button onClick={() => updateItemQty(idx, 1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>+</button>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                placeholder="📝 หมายเหตุ..."
                                                value={item.note || ''}
                                                onChange={e => updateItemNote(idx, e.target.value)}
                                                style={{ flex: 1, fontSize: '0.7rem', padding: '3px 6px', borderRadius: 4, border: '1px solid #E5E7EB', background: '#FAFAFA', outline: 'none', marginRight: '6px' }}
                                            />
                                            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', textAlign: 'right', flexShrink: 0 }}>
                                                {formatLAK(item.quantity * item.unitPrice)}
                                            </div>
                                        </div>
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
                {/* Mobile: floating bottom bar inside overlay */}
                {isMobile && (
                    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300, background: '#fff', borderTop: '1px solid #E5E7EB', padding: '0.6rem 1rem', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#6B7280', cursor: 'pointer' }}>
                                <input type="checkbox" checked={noKitchen} onChange={e => setNoKitchen(e.target.checked)} />ไม่ส่งครัว
                            </label>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#7C3AED' }}>รวม {formatLAK(totalAmount)}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                            <button onClick={() => setShowMenuOverlay(false)} style={{ padding: '0.65rem', background: '#EF4444', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>ยกเลิก</button>
                            <button onClick={async () => { if (noKitchen) { await saveOrder(); setShowMenuOverlay(false) } else { await confirmAndSaveOrder(); setShowMenuOverlay(false) } }} disabled={orderItems.length === 0 || loading}
                                style={{ padding: '0.65rem', background: orderItems.length === 0 ? '#E5E7EB' : '#16A34A', border: 'none', borderRadius: 12, color: orderItems.length === 0 ? '#9CA3AF' : '#fff', fontWeight: 700, cursor: orderItems.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>
                                {noKitchen ? 'บันทึก (ไม่ส่งครัว)' : `ส่งครัว (${orderItems.length} รายการ)`}
                            </button>
                        </div>
                    </div>
                )}
            </>
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
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1A1D26' }}>{branding.displayName}</div>
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

        {/* BAR ALERT SOUND via title flash when bar items exist */}
        {sentItems && sentItems.bar.length > 0 && (
            <style>{`@keyframes barPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}`}</style>
        )}

        {/* ════ SEND TO KITCHEN MODAL ════ */}
        {sentItems && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)', padding: '0.75rem' }}>
                <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 400, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 56px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

                    {/* Bar Alert Banner — only when bar has items */}
                    {sentItems.bar.length > 0 && (
                        <div style={{ background: 'linear-gradient(135deg,#7C3AED,#9333EA)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <span style={{ fontSize: '1.6rem', display: 'inline-block', animation: 'barPulse 0.9s ease-in-out infinite' }}>🍹</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>แจ้งเตือนบาร์ใหม่! ({sentItems.bar.length} รายการ)</div>
                                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>
                                    {sentItems.bar.map(i => `${i.quantity}× ${i.product?.name}`).join(' · ')}
                                </div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '3px 10px', fontSize: '0.7rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>🔔 ใหม่</div>
                        </div>
                    )}

                    {/* Header */}
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A1D26' }}>✅ ส่งออเดอร์สำเร็จ</div>
                            <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 2 }}>โต๊ะ: {sentItems.tableCode}</div>
                        </div>
                        <button onClick={() => setSentItems(null)} style={{ background: '#F3F4F6', border: 'none', color: '#6B7280', cursor: 'pointer', borderRadius: 8, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>✕</button>
                    </div>

                    {/* Body */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
                        {[
                            { title: '👩‍🍳 ส่งครัว', items: sentItems.kitchen, accent: '#EF4444', bg: '#FFF5F5', border: '#FECACA' },
                            { title: '🍹 ส่งบาร์', items: sentItems.bar, accent: '#7C3AED', bg: '#FAF5FF', border: '#DDD6FE' },
                        ].map(({ title, items, accent, bg, border }) => (
                            <div key={title} style={{ marginBottom: 14 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: items.length > 0 ? accent : '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    {title}
                                    <span style={{ background: items.length > 0 ? accent : '#E5E7EB', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{items.length}</span>
                                </div>
                                {items.length > 0 ? (
                                    <div style={{ background: bg, borderRadius: 10, padding: '0.7rem', border: `1.5px solid ${border}` }}>
                                        {items.map((item, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.87rem', paddingBottom: idx < items.length - 1 ? 6 : 0, marginBottom: idx < items.length - 1 ? 6 : 0, borderBottom: idx < items.length - 1 ? `1px dashed ${border}` : 'none' }}>
                                                <span style={{ fontWeight: 600, color: '#1A1D26' }}>{item.product?.name}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {item.note && <span style={{ color: accent, fontSize: '0.75rem', background: `${accent}15`, borderRadius: 4, padding: '1px 6px' }}>{item.note}</span>}
                                                    <span style={{ fontWeight: 800, color: accent }}>×{item.quantity}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.78rem', color: '#D1D5DB', textAlign: 'center', padding: '6px 0' }}>ไม่มีรายการ</div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid #E5E7EB', background: '#FAFBFD' }}>
                        <button onClick={() => setSentItems(null)} style={{ width: '100%', padding: '0.8rem', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(5,150,105,0.28)' }}>✓ รับทราบ</button>
                    </div>
                </div>
            </div>
        )}

        {/* ════ PAYMENT MODAL ════ */}
        {showPaymentModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)', padding: '0.75rem' }}>
                <div style={{ background: '#FFFFFF', borderRadius: 16, padding: isMobile ? '1.5rem' : '2rem', width: '100%', maxWidth: 440, border: '1px solid #E5E7EB', boxShadow: '0 24px 48px rgba(0,0,0,0.15)', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box' }}>
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
                            {closeResult.nativePrint && !closeResult.nativePrint.ok && (
                                <div style={{ background: '#FFFBEB', borderRadius: 10, padding: '0.75rem', marginBottom: 12, textAlign: 'left', border: '1px solid #FDE68A', color: '#92400E', fontSize: '0.78rem' }}>
                                    ชำระเงินและตัดสต็อกสำเร็จแล้ว แต่เครื่องพิมพ์ยังไม่รับงาน ({closeResult.nativePrint.code})
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                <button onClick={printClosedReceipt} disabled={nativeReprintLoading}
                                    style={{ flex: 1, padding: '0.75rem', borderRadius: 10, border: '2px solid #2563EB', background: '#EFF6FF', color: '#2563EB', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'inherit', minHeight: 48 }}>
                                    {nativeReprintLoading
                                        ? '⏳ กำลังส่งพิมพ์...'
                                        : isAndroidPOSApp() ? '🖨️ พิมพ์ใบเสร็จซ้ำ' : '🖨️ พิมพ์บิล'}
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
                                {paymentLoading
                                    ? '⏳ กำลังปิดบิล...'
                                    : isAndroidPOSApp() ? '✅ ชำระเงินและพิมพ์ใบเสร็จ' : '✅ ยืนยันการชำระเงิน'}
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

        {/* ════ HISTORY MODAL ════ */}
        {showHistory && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
                <div className="pos-modal-box">

                    {/* Header */}
                    <div style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🕐</div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1rem' }}>ประวัติ</div>
                            <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>ประวัติการสั่งซื้อ</div>
                        </div>
                        <button onClick={() => setShowHistory(false)}
                            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: '1.1rem' }}>✕</button>
                    </div>

                    <div className="pos-modal-split">
                        {/* Left — order list */}
                        <div className="pos-modal-left">
                            <div style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                                <input
                                    placeholder="🔍 ค้นหา..."
                                    value={historySearch}
                                    onChange={e => setHistorySearch(e.target.value)}
                                    style={{ width: '100%', padding: '7px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: '0.83rem', fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {historyLoading ? (
                                    <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>กำลังโหลด...</div>
                                ) : historyOrders.filter(o => {
                                    const q = historySearch.toLowerCase()
                                    return !q || o.table?.name?.toLowerCase().includes(q) || o.orderNumber?.toLowerCase().includes(q)
                                }).length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>ไม่พบข้อมูล</div>
                                ) : historyOrders.filter(o => {
                                    const q = historySearch.toLowerCase()
                                    return !q || o.table?.name?.toLowerCase().includes(q) || o.orderNumber?.toLowerCase().includes(q)
                                }).map(order => {
                                    const isSelected = selectedHistoryOrder?.id === order.id
                                    return (
                                        <div key={order.id} onClick={() => setSelectedHistoryOrder(order)}
                                            style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: isSelected ? 'rgba(37,99,235,0.08)' : '#fff', borderLeft: isSelected ? '4px solid #2563EB' : '4px solid transparent', transition: 'all 0.12s' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? '#2563EB' : '#111827' }}>
                                                {order.table?.name || '—'}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 2 }}>
                                                {order.closedAt ? new Date(order.closedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                            </div>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827', marginTop: 4, textAlign: 'right' }}>
                                                {(order.totalAmount ?? 0).toLocaleString()}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Right — bill detail */}
                        {selectedHistoryOrder ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                                    {/* Meta cards */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                                        {[
                                            { label: '# ORDER ID', value: selectedHistoryOrder.orderNumber },
                                            { label: '📅 วันที่', value: selectedHistoryOrder.closedAt ? new Date(selectedHistoryOrder.closedAt).toLocaleString('th-TH') : '—' },
                                            { label: '🪑 โต๊ะอาหาร', value: selectedHistoryOrder.table?.name || '—' },
                                            { label: '👤 พนักงาน', value: selectedHistoryOrder.createdBy?.name || '—' },
                                        ].map(card => (
                                            <div key={card.label} style={{ background: '#F0F4FF', borderRadius: 12, padding: '10px 14px' }}>
                                                <div style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A1D26', marginTop: 3 }}>{card.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Items table */}
                                    <div style={{ background: '#F9FAFB', borderRadius: 14, overflow: 'hidden', border: '1px solid #E5E7EB', marginBottom: 16 }}>
                                        <div style={{ background: '#2563EB', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.85rem' }}>
                                            <span>🍽️</span> รายการ
                                        </div>
                                        <div style={{ padding: '0 16px' }}>
                                            {/* Header row */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.5fr 1fr 1.5fr 1fr', gap: 8, padding: '8px 0', borderBottom: '1px solid #E5E7EB', fontSize: '0.73rem', color: '#6B7280', fontWeight: 600 }}>
                                                <span>รายการ</span><span style={{ textAlign: 'center' }}>จำนวน</span><span>เวลา</span><span>ผู้สั่ง</span><span style={{ textAlign: 'right' }}>ราคารวม</span>
                                            </div>
                                            {selectedHistoryOrder.items?.map((item: any) => (
                                                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 0.5fr 1fr 1.5fr 1fr', gap: 8, padding: '10px 0', borderBottom: '1px solid #F3F4F6', fontSize: '0.83rem', alignItems: 'start' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: '#111827' }}>{item.product?.name || '—'}</div>
                                                        {item.note && <div style={{ fontSize: '0.72rem', color: '#F59E0B', marginTop: 2 }}>📝 {item.note}</div>}
                                                    </div>
                                                    <div style={{ textAlign: 'center', fontWeight: 700, color: '#2563EB' }}>{item.quantity}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                                                        {item.createdAt ? new Date(item.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{'—'}</div>
                                                    <div style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>{(item.quantity * item.unitPrice).toLocaleString()}.00</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Totals */}
                                    <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
                                        {[
                                            { label: 'ราคา', value: selectedHistoryOrder.subtotal ?? selectedHistoryOrder.totalAmount },
                                            { label: 'ราคาสุทธิ', value: selectedHistoryOrder.totalAmount },
                                            { label: 'เงินสด', value: selectedHistoryOrder.payments?.[0]?.receivedAmount },
                                        ].filter(r => r.value != null).map(row => (
                                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.85rem', color: '#374151', borderBottom: '1px solid #F3F4F6' }}>
                                                <span>{row.label}</span><span style={{ fontWeight: 600 }}>{Number(row.value).toLocaleString()}.00</span>
                                            </div>
                                        ))}
                                        {selectedHistoryOrder.payments?.[0]?.changeAmount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#2563EB', fontWeight: 800, fontSize: '1rem' }}>
                                                <span>เงินทอน</span>
                                                <span>{Number(selectedHistoryOrder.payments[0].changeAmount).toLocaleString()}.00</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom actions */}
                                <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 10, background: '#fff', flexShrink: 0 }}>
                                    <button
                                        onClick={() => {
                                            const win = window.open('', '_blank', 'width=302,height=600')
                                            if (!win) return
                                            const items = selectedHistoryOrder.items?.map((i: any) =>
                                                `<tr><td>${i.product?.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${(i.quantity * i.unitPrice).toLocaleString()}</td></tr>`
                                            ).join('') ?? ''
                                            win.document.write(`<html><head><title>Receipt</title><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;700&family=Noto+Sans+Thai:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:'Noto Sans Lao','Noto Sans Thai',sans-serif;padding:16px;font-size:13px}table{width:100%;border-collapse:collapse}td{padding:4px}hr{border:1px dashed #ccc}.total{font-weight:bold}</style></head><body>
                                                <h3 style="text-align:center">ใบเสร็จ</h3>
                                                <p>\u0e42\u0e15\u0e4a\u0e30: ${selectedHistoryOrder.table?.name ?? '—'} | #${selectedHistoryOrder.orderNumber}</p>
                                                <p>${selectedHistoryOrder.closedAt ? new Date(selectedHistoryOrder.closedAt).toLocaleString('th-TH') : ''}</p>
                                                <hr/><table><tr><th style="text-align:left">\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23</th><th>\u0e08\u0e33\u0e19\u0e27\u0e19</th><th>\u0e23\u0e32\u0e04\u0e32</th></tr>${items}</table>
                                                <hr/><p class="total">\u0e23\u0e27\u0e21: ${(selectedHistoryOrder.totalAmount ?? 0).toLocaleString()}</p>
                                                <script>window.print();window.onafterprint=()=>window.close()</script></body></html>`)
                                            win.document.close()
                                        }}
                                        style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#374151', color: '#fff', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        🖨️ พิมพ์ใบเสร็จ
                                    </button>
                                    <button onClick={() => setShowHistory(false)}
                                        style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>
                                        ✕ ปิดออก
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexDirection: 'column', gap: 8 }}>
                                <div style={{ fontSize: '2.5rem' }}>📋</div>
                                <div style={{ fontWeight: 600 }}>เลือกรายการประวัติทางซ้าย</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* ════ KITCHEN POPUP MODAL ════ */}
        {showKitchenPopup && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
                <div className="pos-kitchen-box">

                    {/* Header — orange/red gradient like KDS */}
                    <div style={{ background: 'linear-gradient(135deg, #E8364E 0%, #FF6B35 60%, #FF8C00 100%)', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, boxShadow: '0 4px 16px rgba(232,54,78,0.35)' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🍳</div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1rem' }}>จอครัว (KDS)</div>
                            <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>สถานะออเดอร์ — {kitchenQueue.length} โต๊ะ</div>
                        </div>
                        {/* Refresh */}
                        <button onClick={() => {
                            fetch('/api/kitchen/queue?status=PENDING,ACCEPTED,COOKING,READY')
                                .then(r => r.json())
                                .then(d => {
                                    if (d.success) {
                                        setKitchenQueue(d.data.queue ?? [])
                                        setSelectedKitchenOrder((prev: any) => d.data.queue?.find((o: any) => o.orderId === prev?.orderId) ?? d.data.queue?.[0] ?? null)
                                    }
                                })
                        }} style={{ marginLeft: 12, padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                            🔄 รีเฟรช
                        </button>
                        <button onClick={() => setShowKitchenPopup(false)}
                            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: '1.1rem' }}>✕</button>
                    </div>

                    <div className="pos-modal-split">
                        {/* Left — order list */}
                        <div className="pos-kitchen-left">
                            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1F2937' }}>📋 รายการโต๊ะ</span>
                                <span style={{ fontSize: '0.7rem', background: '#E8364E', color: '#fff', borderRadius: 12, padding: '2px 8px', fontWeight: 700 }}>{kitchenQueue.length}</span>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {kitchenQueue.length === 0 ? (
                                    <div style={{ padding: 32, textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                                        <div style={{ color: '#10B981', fontWeight: 700, fontSize: '0.85rem' }}>ไม่มีออเดอร์ค้าง</div>
                                    </div>
                                ) : kitchenQueue.map((order: any) => {
                                    const isSelected = selectedKitchenOrder?.orderId === order.orderId
                                    const hasPending = order.items?.some((i: any) => i.kitchenStatus === 'PENDING')
                                    const diffMs = Date.now() - new Date(order.openedAt).getTime()
                                    const mins = Math.floor(diffMs / 60000)
                                    return (
                                        <div key={order.orderId} onClick={() => setSelectedKitchenOrder(order)}
                                            style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: isSelected ? 'rgba(232,54,78,0.08)' : '#fff', borderLeft: isSelected ? '4px solid #E8364E' : '4px solid transparent', transition: 'all 0.12s', position: 'relative' }}>
                                            {hasPending && <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1.5s infinite' }} />}
                                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isSelected ? '#E8364E' : '#111827' }}>โต๊ะ {order.tableName}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 2 }}>⏱ {mins < 1 ? 'เมื่อกี้' : `${mins} นาที`}</div>
                                            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                {order.items?.slice(0, 3).map((item: any) => (
                                                    <span key={item.id} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 8, background: item.kitchenStatus === 'PENDING' ? '#FEE2E2' : item.kitchenStatus === 'COOKING' ? '#FEF3C7' : '#D1FAE5', color: item.kitchenStatus === 'PENDING' ? '#B91C1C' : item.kitchenStatus === 'COOKING' ? '#92400E' : '#065F46', fontWeight: 600 }}>
                                                        {item.product?.name?.slice(0, 7) ?? '—'}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            {/* Refresh */}
                            <button onClick={() => {
                                fetch('/api/kitchen/queue?status=PENDING,ACCEPTED,COOKING,READY')
                                    .then(r => r.json())
                                    .then(d => {
                                        if (d.success) {
                                            setKitchenQueue(d.data.queue ?? [])
                                            setSelectedKitchenOrder((prev: any) => d.data.queue?.find((o: any) => o.orderId === prev?.orderId) ?? d.data.queue?.[0] ?? null)
                                        }
                                    })
                            }} style={{ marginLeft: 12, padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                                🔄 รีเฟรช
                            </button>
                            <button onClick={() => setShowKitchenPopup(false)}
                                style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: '1.1rem' }}>✕</button>
                        </div>

                        {/* Right — items detail */}
                        {selectedKitchenOrder ? (
                            <div className="pos-kitchen-right">
                                {/* Right header */}
                                <div style={{ padding: '12px 18px', borderBottom: '1px solid #E5E7EB', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontWeight: 900, fontSize: '1.3rem', color: '#E8364E' }}>โต๊ะ {selectedKitchenOrder.tableName}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{selectedKitchenOrder.zone} · #{selectedKitchenOrder.orderNumber}</span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                                        {selectedKitchenOrder.items?.length} รายการ
                                    </div>
                                </div>
                                {/* Items */}
                                <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {selectedKitchenOrder.items?.map((item: any) => {
                                        const STATUS_COLORS: Record<string, string> = { PENDING: '#EF4444', ACCEPTED: '#3B82F6', COOKING: '#F59E0B', READY: '#10B981', SERVED: '#6B7280' }
                                        const NEXT: Record<string, string> = { PENDING: 'ACCEPTED', ACCEPTED: 'COOKING', COOKING: 'READY', READY: 'SERVED' }
                                        const NEXT_LABEL: Record<string, string> = { PENDING: '👌 รับงาน', ACCEPTED: '🔥 เริ่มทำ', COOKING: '✅ เสร็จแล้ว', READY: '🍽️ เสิร์ฟ' }
                                        const STATUS_LABEL: Record<string, string> = { PENDING: '⏳ รอรับ', ACCEPTED: '👌 รับแล้ว', COOKING: '🔥 กำลังทำ', READY: '✅ พร้อมเสิร์ฟ', SERVED: '🍽️ เสิร์ฟแล้ว' }
                                        const hasPending = item.kitchenStatus === 'PENDING'
                                        const isServed = item.kitchenStatus === 'SERVED'
                                        const next = NEXT[item.kitchenStatus]
                                        const isWorking = kitchenUpdating === item.id

                                        return (
                                            <div key={item.id} style={{ background: '#fff', borderRadius: 14, border: hasPending ? '2px solid #E8364E' : '1px solid #E5E7EB', boxShadow: hasPending ? '0 4px 16px rgba(232,54,78,0.15)' : '0 1px 4px rgba(0,0,0,0.06)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: isServed ? 0.5 : 1 }}>
                                                {/* Qty */}
                                                <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: hasPending ? 'linear-gradient(135deg,#E8364E,#FF6B35)' : STATUS_COLORS[item.kitchenStatus] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', color: hasPending ? '#fff' : STATUS_COLORS[item.kitchenStatus] }}>
                                                    {item.quantity}
                                                </div>
                                                {/* Icon */}
                                                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                                                    {item.product?.category?.icon ?? '🍽️'}
                                                </div>
                                                {/* Name */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{item.product?.name ?? '—'}</div>
                                                    <div style={{ fontSize: '0.72rem', color: STATUS_COLORS[item.kitchenStatus], fontWeight: 600, marginTop: 2 }}>{STATUS_LABEL[item.kitchenStatus]}</div>
                                                    {item.note && <div style={{ fontSize: '0.72rem', color: '#D97706', marginTop: 2 }}>📝 {item.note}</div>}
                                                </div>
                                                {/* Action */}
                                                {next && (
                                                    <button onClick={async () => {
                                                        setKitchenUpdating(item.id)
                                                        await fetch(`/api/kitchen/items/${item.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
                                                        setKitchenUpdating(null)
                                                        // refresh
                                                        fetch('/api/kitchen/queue?status=PENDING,ACCEPTED,COOKING,READY')
                                                            .then(r => r.json())
                                                            .then(d => {
                                                                if (d.success) {
                                                                    setKitchenQueue(d.data.queue ?? [])
                                                                    setSelectedKitchenOrder(d.data.queue?.find((o: any) => o.orderId === selectedKitchenOrder.orderId) ?? d.data.queue?.[0] ?? null)
                                                                }
                                                            })
                                                    }} disabled={isWorking}
                                                        style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: hasPending ? 'linear-gradient(135deg,#E8364E,#FF6B35)' : STATUS_COLORS[next], color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', opacity: isWorking ? 0.6 : 1, flexShrink: 0, boxShadow: hasPending ? '0 4px 10px rgba(232,54,78,0.4)' : 'none' }}>
                                                        {isWorking ? '⏳' : NEXT_LABEL[item.kitchenStatus]}
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                {/* Bottom */}
                                <div style={{ padding: '10px 18px', borderTop: '1px solid #E5E7EB', background: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                    <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                                        {selectedKitchenOrder.items?.filter((i: any) => i.kitchenStatus === 'READY' || i.kitchenStatus === 'SERVED').length}/{selectedKitchenOrder.items?.length} รายการเสร็จ
                                    </div>
                                    {selectedKitchenOrder.items?.some((i: any) => i.kitchenStatus === 'READY') && (
                                        <button onClick={async () => {
                                            setKitchenUpdating(selectedKitchenOrder.orderId)
                                            await fetch(`/api/kitchen/orders/${selectedKitchenOrder.orderId}/serve-all`, { method: 'PATCH' })
                                            setKitchenUpdating(null)
                                            fetch('/api/kitchen/queue?status=PENDING,ACCEPTED,COOKING,READY')
                                                .then(r => r.json())
                                                .then(d => { if (d.success) { setKitchenQueue(d.data.queue ?? []); setSelectedKitchenOrder(d.data.queue?.[0] ?? null) } })
                                        }} disabled={kitchenUpdating === selectedKitchenOrder.orderId}
                                            style={{ marginLeft: 'auto', padding: '9px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>
                                            🍽️ เสิร์ฟทั้งโต๊ะ
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#9CA3AF', background: '#F9FAFB' }}>
                                <div style={{ fontSize: '3rem' }}>✅</div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#10B981' }}>ไม่มีออเดอร์ค้าง</div>
                                <div style={{ fontSize: '0.82rem' }}>คลิกโต๊ะทางซ้ายเพื่อดูรายละเอียด</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* ═══ DELIVERY ORDER MODAL ═══════════════════════════════════ */}
        {showDeliveryModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460, padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1A1D26' }}>🛵 สร้างออเดอร์ Delivery</div>
                        <button onClick={() => setShowDeliveryModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6B7280' }}>✕</button>
                    </div>

                    {[['ชื่อลูกค้า', 'customerName', 'text', 'แสง สมพล...'],
                    ['เบอร์โทร', 'customerPhone', 'tel', '+856 20...'],
                    ['ที่อยู่/สถานที่ส่ง', 'addressText', 'text', 'บ้านเลขที่, ถนน, คำสั่งบอกทาง...']
                    ].map(([label, key, type, placeholder]) => (
                        <div key={key} style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>{label}</label>
                            <input
                                type={type}
                                value={(deliveryForm as any)[key]}
                                onChange={e => setDeliveryForm(f => ({ ...f, [key]: e.target.value }))}
                                placeholder={placeholder}
                                style={{ width: '100%', padding: '0.55rem 0.8rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                    ))}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>ช่องทาง</label>
                            <select
                                value={deliveryForm.channel}
                                onChange={e => setDeliveryForm(f => ({ ...f, channel: e.target.value }))}
                                style={{ width: '100%', padding: '0.55rem 0.8rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.88rem', fontFamily: 'inherit', background: '#fff' }}
                            >
                                {[['WHATSAPP', 'WhatsApp'], ['LINE', 'LINE'], ['PHONE', 'โทรศัพท์'], ['WALKIN', 'Walk-in'], ['OTHER', 'อื่นๆ']].map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>ค่าส่ง (LAK)</label>
                            <input
                                type="number"
                                value={deliveryForm.deliveryFee}
                                onChange={e => setDeliveryForm(f => ({ ...f, deliveryFee: e.target.value }))}
                                style={{ width: '100%', padding: '0.55rem 0.8rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.88rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#374151' }}>
                        <input
                            type="checkbox"
                            checked={deliveryForm.isPrepaid}
                            onChange={e => setDeliveryForm(f => ({ ...f, isPrepaid: e.target.checked }))}
                        />
                        ชำระเงินแล้ว (Pre-paid)
                    </label>

                    <button
                        disabled={!deliveryForm.customerName.trim() || !deliveryForm.customerPhone.trim() || !deliveryForm.addressText.trim() || loading}
                        onClick={async () => {
                            if (!deliveryForm.customerName.trim() || !deliveryForm.customerPhone.trim() || !deliveryForm.addressText.trim()) return
                            setLoading(true)
                            try {
                                const res = await fetch('/api/pos/orders', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        deliveryInfo: {
                                            customerName: deliveryForm.customerName.trim(),
                                            customerPhone: deliveryForm.customerPhone.trim(),
                                            addressText: deliveryForm.addressText.trim(),
                                            channel: deliveryForm.channel,
                                            deliveryFee: parseFloat(deliveryForm.deliveryFee) || 0,
                                            isPrepaid: deliveryForm.isPrepaid,
                                        },
                                    }),
                                })
                                const json = await res.json()
                                if (json.success) {
                                    setCurrentOrder(json.data)
                                    setOrderItems([])
                                    setOrderStartTime(new Date())
                                    setSelectedTable(null)
                                    setShowDeliveryModal(false)
                                    setDeliveryForm({ customerName: '', customerPhone: '', addressText: '', channel: 'PHONE', deliveryFee: '0', isPrepaid: false })
                                    setToast({ message: `🛵 สร้างออเดอร์สำเร็จ — เพิ่มเมนูได้เลย`, type: 'success' })
                                    fetchDeliveryOrders()
                                } else {
                                    setToast({ message: json.error || 'สร้างออเดอร์ไม่สำเร็จ', type: 'error' })
                                }
                            } catch { setToast({ message: 'เกิดข้อผิดพลาด', type: 'error' }) }
                            finally { setLoading(false) }
                        }}
                        style={{ width: '100%', padding: '0.75rem', background: loading ? '#d1d5db' : '#059669', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        {loading ? 'กำลังสร้าง...' : '➕ ยืนยันสร้างออเดอร์ Delivery'}
                    </button>
                </div>
            </div>
        )}

        <style>{`
                @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

                /* ── History & Kitchen popup: responsive on mobile ── */
                .pos-modal-box {
                    background: #fff;
                    border-radius: 20px;
                    width: 90vw;
                    max-width: 920px;
                    height: 88vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 32px 80px rgba(0,0,0,0.3);
                }
                .pos-modal-split {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }
                .pos-modal-left {
                    width: 240px;
                    flex-shrink: 0;
                    border-right: 1px solid #E5E7EB;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .pos-modal-right {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                /* Kitchen popup box */
                .pos-kitchen-box {
                    background: #F5F5F5;
                    border-radius: 20px;
                    width: 90vw;
                    max-width: 900px;
                    height: 86vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 32px 80px rgba(0,0,0,0.3);
                }
                .pos-kitchen-left {
                    width: 220px;
                    flex-shrink: 0;
                    border-right: 1px solid #E5E7EB;
                    background: #fff;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .pos-kitchen-right {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    background: #F9FAFB;
                }

                @media (max-width: 640px) {
                    .pos-modal-box, .pos-kitchen-box {
                        width: 100vw !important;
                        max-width: 100vw !important;
                        height: 100dvh !important;
                        border-radius: 0 !important;
                    }
                    .pos-modal-split {
                        flex-direction: column;
                    }
                    .pos-modal-left {
                        width: 100% !important;
                        max-height: 200px;
                        border-right: none !important;
                        border-bottom: 1px solid #E5E7EB;
                    }
                    .pos-kitchen-left {
                        width: 100% !important;
                        max-height: 180px;
                        border-right: none !important;
                        border-bottom: 1px solid #E5E7EB;
                    }
                    .pos-kitchen-right {
                        flex: 1;
                    }
                }
            `}</style>
    </div>
)
}
