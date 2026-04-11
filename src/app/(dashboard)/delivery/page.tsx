'use client'
import { useState, useEffect, useCallback } from 'react'
import { useCurrency } from '@/context/TenantContext'

// ─── Types ────────────────────────────────────────────────────
type DeliveryStatus = 'RECEIVED' | 'PREPARING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'
type DeliveryChannel = 'WHATSAPP' | 'LINE' | 'PHONE' | 'WALKIN' | 'WEBSITE' | 'GRAB' | 'FOODPANDA' | 'LINEMAN' | 'SHOPEEFOOD' | 'LALAMOVE' | 'OTHER'

interface DeliveryInfo {
    id: string
    customerName: string
    customerPhone: string
    addressText: string
    channel: DeliveryChannel
    deliveryStatus: DeliveryStatus
    deliveryFee: number
    isPrepaid: boolean
    paymentRef?: string
    paymentSlipBase64?: string | null
    driverNote?: string
    estimatedAt?: string
}

interface OrderItem {
    product: { name: string }
    quantity: number
    unitPrice: number
    isCancelled: boolean
}

interface DeliveryOrder {
    id: string
    orderNumber: string
    totalAmount: number
    subtotal: number
    openedAt: string
    createdBy?: { name: string }
    deliveryInfo: DeliveryInfo
    items: OrderItem[]
}

// ─── Constants ────────────────────────────────────────────────
const STATUS_COLUMNS: { key: DeliveryStatus; label: string; labelLo: string; color: string; bg: string; icon: string }[] = [
    { key: 'RECEIVED',         label: 'รับออเดอร์',   labelLo: 'ຮັບອໍເດີ',   color: '#2563EB', bg: '#EFF6FF', icon: '📥' },
    { key: 'PREPARING',        label: 'กำลังเตรียม',  labelLo: 'ກຳລັງກຽມ',  color: '#D97706', bg: '#FFFBEB', icon: '🍳' },
    { key: 'OUT_FOR_DELIVERY', label: 'กำลังส่ง',     labelLo: 'ກຳລັງສົ່ງ',  color: '#7C3AED', bg: '#F5F3FF', icon: '🛵' },
    { key: 'DELIVERED',        label: 'ส่งแล้ว',      labelLo: 'ສົ່ງແລ້ວ',   color: '#059669', bg: '#F0FDF4', icon: '✅' },
]

const NEXT_STATUS: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
    RECEIVED: 'PREPARING',
    PREPARING: 'OUT_FOR_DELIVERY',
    OUT_FOR_DELIVERY: 'DELIVERED',
}

const CHANNEL_LABEL: Record<DeliveryChannel, string> = {
    WHATSAPP: '💬 WhatsApp', LINE: '💚 LINE', PHONE: '📞 โทรศัพท์',
    WALKIN: '🚶 Walk-in',   WEBSITE: '🌐 เว็บ',
    GRAB: '🟢 Grab', FOODPANDA: '🐼 Foodpanda', LINEMAN: '🔰 LineMan', SHOPEEFOOD: '🟠 ShopeeFood', LALAMOVE: '🚚 Lalamove',
    OTHER: '🔗 อื่นๆ',
}

const PRODUCT_FIELDS = [
    { id: 'productId', label: 'สินค้า', type: 'text' },
    { id: 'quantity',  label: 'จำนวน',  type: 'number' },
    { id: 'unitPrice', label: 'ราคา',   type: 'number' },
]

// ─── New Order Modal ──────────────────────────────────────────
interface Product { id: string; name: string; salePrice: number }

function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const { fmt } = useCurrency()
    const [products, setProducts] = useState<Product[]>([])
    const [form, setForm] = useState({
        customerName: '', customerPhone: '', addressText: '',
        channel: 'PHONE' as DeliveryChannel,
        deliveryFee: 0, isPrepaid: false, driverNote: '',
    })
    const [items, setItems] = useState([{ productId: '', qty: 1, price: 0 }])
    const [loading, setLoading] = useState(false)
    const [err, setErr] = useState('')

    useEffect(() => {
        fetch('/api/products?active=true&limit=200')
            .then(r => r.json())
            .then(j => {
                if (j.success) {
                    const arr = j.data?.products || j.data?.items || (Array.isArray(j.data) ? j.data : [])
                    setProducts(arr)
                }
            })
            .catch(() => {})
    }, [])

    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0)
    const total = subtotal + form.deliveryFee

    function addItem() { setItems(prev => [...prev, { productId: '', qty: 1, price: 0 }]) }
    function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
    function setItem(idx: number, field: string, value: any) {
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item
            const updated = { ...item, [field]: value }
            if (field === 'productId') {
                const p = products.find(p => p.id === value)
                if (p) updated.price = p.salePrice
            }
            return updated
        }))
    }

    async function submit() {
        setErr('')
        if (!form.customerName || !form.customerPhone || !form.addressText) {
            setErr('กรุณากรอกชื่อ เบอร์ และที่อยู่'); return
        }
        const validItems = items.filter(i => i.productId && i.qty > 0)
        setLoading(true)
        try {
            const res = await fetch('/api/pos/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deliveryInfo: { ...form },
                    items: validItems.map(i => ({ productId: i.productId, quantity: i.qty, unitPrice: i.price })),
                }),
            })
            const j = await res.json()
            if (j.success) { onCreated(); onClose() }
            else setErr(j.error || 'เกิดข้อผิดพลาด')
        } catch { setErr('ไม่สามารถเชื่อมต่อได้') }
        finally { setLoading(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#1A1D26,#2D3148)', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800 }}>🛵 สร้างออเดอร์ Delivery ใหม่</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>ສ້າງອໍເດີ Delivery ໃໝ່</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {/* Customer info */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={sectionLabel}>👤 ข้อมูลลูกค้า</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                                <label style={labelStyle}>ชื่อลูกค้า *</label>
                                <input style={inputStyle} placeholder="ชื่อ..." value={form.customerName}
                                    onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
                            </div>
                            <div>
                                <label style={labelStyle}>เบอร์โทร *</label>
                                <input style={inputStyle} placeholder="+856..." value={form.customerPhone}
                                    onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
                            </div>
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <label style={labelStyle}>ที่อยู่จัดส่ง *</label>
                            <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} placeholder="บ้านเลขที่ ถนน หมู่บ้าน..."
                                value={form.addressText} onChange={e => setForm(f => ({ ...f, addressText: e.target.value }))} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                            <div>
                                <label style={labelStyle}>ช่องทางรับออเดอร์</label>
                                <select style={inputStyle} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value as DeliveryChannel }))}>
                                    {(Object.keys(CHANNEL_LABEL) as DeliveryChannel[]).map(c => (
                                        <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>ค่าส่ง (LAK)</label>
                                <input style={inputStyle} type="number" min={0} value={form.deliveryFee}
                                    onChange={e => setForm(f => ({ ...f, deliveryFee: Number(e.target.value) }))} />
                            </div>
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <label style={labelStyle}>หมายเหตุไรเดอร์</label>
                            <input style={inputStyle} placeholder="บอกทางหรือข้อมูลเพิ่มเติม..." value={form.driverNote}
                                onChange={e => setForm(f => ({ ...f, driverNote: e.target.value }))} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 13 }}>
                            <input type="checkbox" checked={form.isPrepaid} onChange={e => setForm(f => ({ ...f, isPrepaid: e.target.checked }))} />
                            <span>ชำระเงินล่วงหน้าแล้ว (Prepaid)</span>
                        </label>
                    </div>

                    {/* Items */}
                    <div>
                        <div style={{ ...sectionLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>🍽️ รายการอาหาร</span>
                            <button onClick={addItem} style={{ fontSize: 12, padding: '3px 10px', background: '#E8364E', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>+ เพิ่ม</button>
                        </div>
                        {items.map((item, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', gap: 6, marginBottom: 8, alignItems: 'end' }}>
                                <div>
                                    {idx === 0 && <label style={labelStyle}>สินค้า</label>}
                                    <select style={inputStyle} value={item.productId} onChange={e => setItem(idx, 'productId', e.target.value)}>
                                        <option value="">-- เลือก --</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    {idx === 0 && <label style={labelStyle}>จำนวน</label>}
                                    <input style={inputStyle} type="number" min={1} value={item.qty} onChange={e => setItem(idx, 'qty', Number(e.target.value))} />
                                </div>
                                <div>
                                    {idx === 0 && <label style={labelStyle}>ราคา/หน่วย</label>}
                                    <input style={inputStyle} type="number" min={0} value={item.price} onChange={e => setItem(idx, 'price', Number(e.target.value))} />
                                </div>
                                <div style={{ paddingBottom: 1 }}>
                                    {items.length > 1 && (
                                        <button onClick={() => removeItem(idx)} style={{ width: 32, height: 36, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>✕</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid #E5E7EB', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 13 }}>
                        <span style={{ color: '#6B7280' }}>ยอดรวม: </span>
                        <span style={{ fontWeight: 700 }}>{fmt(subtotal)}</span>
                        {form.deliveryFee > 0 && <span style={{ color: '#6B7280' }}> + ค่าส่ง {fmt(form.deliveryFee)}</span>}
                        <span style={{ fontWeight: 900, color: '#E8364E', fontSize: 15, marginLeft: 8 }}>= {fmt(total)}</span>
                    </div>
                    {err && <span style={{ fontSize: 12, color: '#DC2626' }}>{err}</span>}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onClose} style={{ padding: '8px 18px', border: '1.5px solid #E5E7EB', background: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>ยกเลิก</button>
                        <button onClick={submit} disabled={loading} style={{ padding: '8px 20px', background: '#E8364E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: loading ? 0.7 : 1 }}>
                            {loading ? 'กำลังสร้าง...' : '✅ ยืนยันออเดอร์'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Order Card ───────────────────────────────────────────────
function OrderCard({ order, onStatusChange }: { order: DeliveryOrder; onStatusChange: () => void }) {
    const { fmt } = useCurrency()
    const info = order.deliveryInfo
    const next = NEXT_STATUS[info.deliveryStatus]
    const [loading, setLoading] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [showSlip, setShowSlip] = useState(false)
    const activeItems = order.items.filter(i => !i.isCancelled)

    async function advance() {
        if (!next || loading) return
        setLoading(true)
        await fetch(`/api/pos/delivery/${info.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deliveryStatus: next }),
        })
        setLoading(false)
        onStatusChange()
    }

    async function cancel() {
        if (!confirm('ยืนยันยกเลิกออเดอร์นี้?')) return
        setLoading(true)
        await fetch(`/api/pos/delivery/${info.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deliveryStatus: 'CANCELLED' }),
        })
        setLoading(false)
        onStatusChange()
    }

    const col = STATUS_COLUMNS.find(c => c.key === info.deliveryStatus)
    const minutesAgo = Math.floor((Date.now() - new Date(order.openedAt).getTime()) / 60000)
    const isUrgent = minutesAgo >= 30 && info.deliveryStatus !== 'DELIVERED'

    return (
        <div style={{
            background: '#fff', borderRadius: 12, border: `1.5px solid ${isUrgent ? '#FCA5A5' : '#E5E7EB'}`,
            overflow: 'hidden', transition: 'box-shadow 0.15s',
            boxShadow: isUrgent ? '0 0 0 2px rgba(239,68,68,0.15)' : '0 2px 8px rgba(0,0,0,0.06)',
        }}>
            {/* Card header */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#E8364E' }}>{order.orderNumber}</span>
                        {info.isPrepaid && <span style={{ fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>PREPAID</span>}
                        {isUrgent && <span style={{ fontSize: 10, background: '#FEE2E2', color: '#DC2626', padding: '1px 6px', borderRadius: 6, fontWeight: 700, animation: 'pulse-badge 2s infinite' }}>⚠️ {minutesAgo}min</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 2 }}>{info.customerName}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{info.customerPhone}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#1A1D26' }}>{fmt(order.totalAmount)}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{CHANNEL_LABEL[info.channel]}</div>
                </div>
            </div>

            {/* Address */}
            <div style={{ padding: '8px 12px', background: '#F9FAFB', fontSize: 11, color: '#374151', lineHeight: 1.5 }}>
                📍 {info.addressText}
                {info.driverNote && <div style={{ color: '#6B7280', fontStyle: 'italic', marginTop: 2 }}>💬 {info.driverNote}</div>}
                {info.deliveryFee > 0 && <div style={{ color: '#059669', fontWeight: 600, marginTop: 2 }}>🛵 ค่าส่ง {fmt(info.deliveryFee)}</div>}
            </div>

            {/* Slip Box (Inline or Modal trigger) */}
            {info.paymentSlipBase64 && (
                <div style={{ padding: '6px 12px', display: 'flex', gap: 8, background: '#ECFDF5', borderTop: '1px solid #D1FAE5', borderBottom: '1px solid #D1FAE5' }}>
                    <button onClick={() => setShowSlip(!showSlip)} style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: 'transparent', border: '1px solid #10B981', padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }}>
                        {showSlip ? 'ซ่อนสลิป ▲' : '📄 ดูสลิปโอนเงิน ▼'}
                    </button>
                    <span style={{ fontSize: 11, color: '#065F46', display: 'flex', alignItems: 'center' }}>ลูกค้าอัปโหลดสลิปแล้ว</span>
                </div>
            )}
            
            {showSlip && info.paymentSlipBase64 && (
                <div style={{ padding: '12px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'center', background: '#F9FAFB' }}>
                    <img src={info.paymentSlipBase64} alt="Payment Slip" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #D1D5DB' }} />
                </div>
            )}


            {/* Items toggle */}
            <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', padding: '6px 12px', background: 'none', border: 'none', borderTop: '1px solid #F3F4F6', cursor: 'pointer', fontSize: 11, color: '#6B7280', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                <span>🍽️ {activeItems.length} รายการ</span>
                <span>{expanded ? '▲' : '▼'}</span>
            </button>
            {expanded && (
                <div style={{ padding: '6px 12px 8px', borderTop: '1px solid #F3F4F6' }}>
                    {activeItems.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#374151', padding: '2px 0' }}>
                            <span>{item.product.name} × {item.quantity}</span>
                            <span style={{ fontWeight: 600 }}>{fmt(item.quantity * item.unitPrice)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Actions */}
            {info.deliveryStatus !== 'DELIVERED' && info.deliveryStatus !== 'CANCELLED' && (
                <div style={{ padding: '8px 12px', display: 'flex', gap: 6, borderTop: '1px solid #F3F4F6' }}>
                    {next && (
                        <button onClick={advance} disabled={loading} style={{
                            flex: 1, padding: '7px 10px', background: col?.color || '#E8364E', color: '#fff',
                            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            opacity: loading ? 0.7 : 1,
                        }}>
                            {loading ? '...' : `${STATUS_COLUMNS.find(c => c.key === next)?.icon} ${STATUS_COLUMNS.find(c => c.key === next)?.label}`}
                        </button>
                    )}
                    <button onClick={cancel} disabled={loading} style={{ padding: '7px 10px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        ยกเลิก
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── Shared styles ────────────────────────────────────────────
const sectionLabel: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'block' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#FAFAFA', boxSizing: 'border-box' }

// ═══════════════════════════════════════════════════════════════
export default function DeliveryQueuePage() {
    const [orders, setOrders] = useState<DeliveryOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [showNew, setShowNew] = useState(false)
    const [activeTab, setActiveTab] = useState<'active' | 'done'>('active')

    const fetchOrders = useCallback(async () => {
        const res = await fetch('/api/pos/delivery')
        const j = await res.json()
        if (j.success) setOrders(j.data)
        setLoading(false)
    }, [])

    useEffect(() => { fetchOrders() }, [fetchOrders])
    useEffect(() => {
        const t = setInterval(fetchOrders, 30_000)
        return () => clearInterval(t)
    }, [fetchOrders])

    const activeOrders = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.deliveryInfo.deliveryStatus))
    const doneOrders   = orders.filter(o =>  ['DELIVERED', 'CANCELLED'].includes(o.deliveryInfo.deliveryStatus))

    // Group active orders by status
    const byStatus = STATUS_COLUMNS.slice(0, 3).map(col => ({
        ...col,
        orders: activeOrders.filter(o => o.deliveryInfo.deliveryStatus === col.key),
    }))

    return (
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {/* ── Page Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1D26', margin: 0 }}>🛵 Delivery Queue</h1>
                    <p style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>ຄຸ້ມຄອງອໍເດີ Delivery — อัปเดตทุก 30 วินาที</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={fetchOrders} style={{ padding: '8px 14px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                        🔄 รีเฟรช
                    </button>
                    <button onClick={() => setShowNew(true)} style={{ padding: '8px 18px', background: '#E8364E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(232,54,78,0.35)' }}>
                        + สร้างออเดอร์ Delivery
                    </button>
                </div>
            </div>

            {/* ── Summary Strip ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {STATUS_COLUMNS.map(col => {
                    const count = orders.filter(o => o.deliveryInfo.deliveryStatus === col.key).length
                    return (
                        <div key={col.key} style={{ flex: '1 1 120px', background: col.bg, border: `1.5px solid ${col.color}30`, borderRadius: 10, padding: '10px 14px', minWidth: 100 }}>
                            <div style={{ fontSize: 20 }}>{col.icon}</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: col.color, lineHeight: 1.2 }}>{count}</div>
                            <div style={{ fontSize: 11, color: col.color, fontWeight: 600 }}>{col.label}</div>
                        </div>
                    )
                })}
            </div>

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #E5E7EB' }}>
                {[{ key: 'active', label: `🔴 Active (${activeOrders.length})` }, { key: 'done', label: `✅ เสร็จแล้ว (${doneOrders.length})` }].map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key as any)} style={{
                        padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
                        fontWeight: activeTab === t.key ? 800 : 500,
                        color: activeTab === t.key ? '#E8364E' : '#6B7280',
                        borderBottom: activeTab === t.key ? '2px solid #E8364E' : '2px solid transparent',
                        marginBottom: -2, fontFamily: 'inherit',
                    }}>{t.label}</button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>⏳ กำลังโหลด...</div>
            ) : activeTab === 'active' ? (
                activeOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>🛵</div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>ไม่มีออเดอร์ Delivery ที่ Active</div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>กด "+ สร้างออเดอร์" เพื่อเพิ่มออเดอร์ใหม่</div>
                    </div>
                ) : (
                    /* ── Kanban Columns ── */
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                        {byStatus.map(col => (
                            <div key={col.key}>
                                {/* Column header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '8px 12px', background: col.bg, borderRadius: 10, border: `1.5px solid ${col.color}30` }}>
                                    <span style={{ fontSize: 16 }}>{col.icon}</span>
                                    <span style={{ fontWeight: 800, fontSize: 13, color: col.color }}>{col.label}</span>
                                    <span style={{ marginLeft: 'auto', background: col.color, color: '#fff', borderRadius: 10, minWidth: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, padding: '0 6px' }}>{col.orders.length}</span>
                                </div>
                                {/* Cards */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {col.orders.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '24px 12px', color: '#D1D5DB', fontSize: 12, border: '1.5px dashed #E5E7EB', borderRadius: 10 }}>ว่างอยู่</div>
                                    ) : col.orders.map(o => (
                                        <OrderCard key={o.id} order={o} onStatusChange={fetchOrders} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                /* ── Done List ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {doneOrders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>ยังไม่มีออเดอร์ที่เสร็จแล้ว</div>
                    ) : doneOrders.map(o => (
                        <OrderCard key={o.id} order={o} onStatusChange={fetchOrders} />
                    ))}
                </div>
            )}

            {showNew && <NewOrderModal onClose={() => setShowNew(false)} onCreated={fetchOrders} />}

            <style>{`
                @keyframes pulse-badge {
                    0%, 100% { opacity: 1; } 50% { opacity: 0.6; }
                }
            `}</style>
        </div>
    )
}
