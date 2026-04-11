'use client'
import { useState, useEffect, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────
type DeliveryStatus = 'RECEIVED' | 'PREPARING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'

interface DeliveryInfo {
    id: string
    customerName: string
    customerPhone: string
    addressText: string
    deliveryStatus: DeliveryStatus
    driverNote?: string
    latitude?: number | null
    longitude?: number | null
}

interface DeliveryOrder {
    id: string
    orderNumber: string
    totalAmount: number
    openedAt: string
    deliveryInfo: DeliveryInfo
    items: { product: { name: string }; quantity: number; unitPrice: number; isCancelled: boolean }[]
}

// ─── Design Tokens ─────────────────────────────────────────────
const C = {
    bg: '#0f172a',
    surface: '#1e293b',
    border: 'rgba(255,255,255,0.08)',
    accent: '#E11D48',
    accentGrad: 'linear-gradient(135deg, #E11D48, #9F1239)',
    green: '#10B981',
    amber: '#F59E0B',
    blue: '#3B82F6',
    text: '#F8FAFC',
    sub: '#94A3B8',
    muted: '#475569',
    card: '#1e293b',
}
const FONT = "'Outfit','Noto Sans Lao','Noto Sans Thai',system-ui,sans-serif"

const STATUS_CONFIG: Record<string, { label: string; labelLo: string; color: string; icon: string }> = {
    ASSIGNED:         { label: 'งานใหม่ — รอรับ',    labelLo: 'ວຽກໃຫມ່ — ລໍຮັບ',    color: C.amber,  icon: '🔔' },
    OUT_FOR_DELIVERY: { label: 'กำลังส่ง',            labelLo: 'ກຳລັງສົ່ງ',            color: C.blue,   icon: '🛵' },
    DELIVERED:        { label: 'ส่งแล้ว ✅',           labelLo: 'ສົ່ງແລ້ວ ✅',           color: C.green,  icon: '✅' },
}

// ─── Main Page ─────────────────────────────────────────────────
export default function RiderPage() {
    const [orders, setOrders]   = useState<DeliveryOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter]   = useState<'active' | 'done'>('active')

    const fetchOrders = useCallback(async () => {
        try {
            const res  = await fetch('/api/pos/delivery?limit=100')
            const data = await res.json()
            if (data.success) setOrders(data.data || [])
        } catch { /* ignore */ } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchOrders()
        const t = setInterval(fetchOrders, 20_000)
        return () => clearInterval(t)
    }, [fetchOrders])

    // Rider เห็นเฉพาะ ASSIGNED / OUT_FOR_DELIVERY (active) หรือ DELIVERED วันนี้
    const today = new Date().toDateString()
    const activeOrders   = orders.filter(o =>
        ['ASSIGNED', 'OUT_FOR_DELIVERY'].includes(o.deliveryInfo.deliveryStatus)
    )
    const deliveredToday = orders.filter(o =>
        o.deliveryInfo.deliveryStatus === 'DELIVERED' &&
        new Date(o.openedAt).toDateString() === today
    )

    const shown = filter === 'active' ? activeOrders : deliveredToday

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Noto+Sans+Lao:wght@400;600;700&family=Noto+Sans+Thai:wght@400;600;700&display=swap');
                * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
                body { background: ${C.bg}; }
                @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
            `}</style>

            <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: FONT, color: C.text, maxWidth: 480, margin: '0 auto', padding: '0 0 32px' }}>

                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #1e0a13, #0f172a)', padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: '0.7rem', color: C.muted, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                        🛵 Rider App
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: C.text }}>
                        งานของฉัน
                    </div>
                    <div style={{ fontSize: '0.8rem', color: C.sub, marginTop: 2 }}>
                        ວຽກຂອງຂ້ອຍ / My Deliveries
                    </div>
                </div>

                {/* Tab Filter */}
                <div style={{ display: 'flex', gap: 8, padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
                    {([
                        { key: 'active', label: `🔴 งานที่รอ (${activeOrders.length})` },
                        { key: 'done',   label: `✅ ส่งแล้ว (${deliveredToday.length})` },
                    ] as const).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            style={{
                                flex: 1, padding: '10px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                fontFamily: FONT, fontWeight: 700, fontSize: '0.82rem',
                                background: filter === tab.key ? C.accentGrad : 'rgba(255,255,255,0.05)',
                                color: filter === tab.key ? '#fff' : C.sub,
                                transition: 'all 0.15s',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Auto-refresh indicator */}
                <div style={{ textAlign: 'center', padding: '8px', fontSize: '0.68rem', color: C.muted }}>
                    🔄 อัปเดตอัตโนมัติทุก 20 วินาที
                </div>

                {/* Order List */}
                <div style={{ padding: '0 12px' }}>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>⏳ กำลังโหลด...</div>
                    )}
                    {!loading && shown.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 48, color: C.muted }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>
                                {filter === 'active' ? '🎉' : '📭'}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>
                                {filter === 'active' ? 'ไม่มีงานที่รอ' : 'ยังไม่มีงานที่ส่งวันนี้'}
                            </div>
                            <div style={{ fontSize: '0.75rem' }}>
                                {filter === 'active' ? 'ຍັງບໍ່ມີວຽກ' : 'ຍັງບໍ່ມີການສົ່ງ'}
                            </div>
                        </div>
                    )}
                    {shown.map(order => (
                        <RiderOrderCard key={order.id} order={order} onRefresh={fetchOrders} />
                    ))}
                </div>
            </div>
        </>
    )
}

// ─── Order Card ─────────────────────────────────────────────────
function RiderOrderCard({ order, onRefresh }: { order: DeliveryOrder; onRefresh: () => void }) {
    const info    = order.deliveryInfo
    const cfg     = STATUS_CONFIG[info.deliveryStatus]
    const [busy, setBusy] = useState(false)

    const minutesAgo = Math.floor((Date.now() - new Date(order.openedAt).getTime()) / 60_000)

    async function advance(nextStatus: DeliveryStatus) {
        if (busy) return
        setBusy(true)
        await fetch(`/api/pos/delivery/${info.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deliveryStatus: nextStatus }),
        })
        setBusy(false)
        onRefresh()
    }

    const mapsUrl = info.latitude && info.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${info.latitude},${info.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.addressText)}`

    const activeItems = order.items.filter(i => !i.isCancelled)

    return (
        <div style={{
            background: C.card, borderRadius: 16, border: `1.5px solid ${C.border}`,
            marginBottom: 14, overflow: 'hidden', animation: 'fadeUp 0.25s ease',
            ...(info.deliveryStatus === 'ASSIGNED' && { boxShadow: `0 0 0 2px ${C.amber}40, 0 4px 20px rgba(245,158,11,0.15)` }),
        }}>
            {/* Status Badge */}
            <div style={{
                padding: '8px 14px',
                background: `${cfg?.color}18`,
                borderBottom: `1px solid ${cfg?.color}30`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '1rem' }}>{cfg?.icon}</span>
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', color: cfg?.color }}>
                        {cfg?.label}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.7rem', color: C.muted }}>{minutesAgo} นาทีที่แล้ว</span>
                    <span style={{ fontWeight: 900, fontSize: '0.85rem', color: C.accent }}>
                        {order.orderNumber}
                    </span>
                </div>
            </div>

            {/* Customer Info */}
            <div style={{ padding: '12px 14px' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: C.text, marginBottom: 4 }}>
                    {info.customerName}
                </div>
                <div style={{ fontSize: '0.85rem', color: C.sub, marginBottom: 6 }}>
                    📞 <a href={`tel:${info.customerPhone}`} style={{ color: C.blue, textDecoration: 'none', fontWeight: 600 }}>
                        {info.customerPhone}
                    </a>
                </div>
                <div style={{ fontSize: '0.8rem', color: C.sub, marginBottom: 8, lineHeight: 1.5 }}>
                    📍 {info.addressText}
                </div>
                {info.driverNote && (
                    <div style={{ background: 'rgba(245,158,11,0.1)', border: `1px solid ${C.amber}40`, borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem', color: C.amber, marginBottom: 8 }}>
                        💬 {info.driverNote}
                    </div>
                )}

                {/* Items Summary */}
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                    <div style={{ fontSize: '0.68rem', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        🍽️ รายการ ({activeItems.length})
                    </div>
                    {activeItems.slice(0, 4).map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: C.sub, padding: '2px 0' }}>
                            <span>{item.product.name} × {item.quantity}</span>
                        </div>
                    ))}
                    {activeItems.length > 4 && (
                        <div style={{ fontSize: '0.72rem', color: C.muted }}>+อีก {activeItems.length - 4} รายการ</div>
                    )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {/* Google Maps */}
                    <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            flex: 1, padding: '11px 8px', borderRadius: 10, textAlign: 'center',
                            background: 'rgba(59,130,246,0.15)', color: C.blue, fontWeight: 700,
                            fontSize: '0.82rem', textDecoration: 'none', border: `1px solid ${C.blue}30`,
                        }}
                    >
                        🗺️ นำทาง
                    </a>

                    {/* Status Advance Button */}
                    {info.deliveryStatus === 'ASSIGNED' && (
                        <button
                            onClick={() => advance('OUT_FOR_DELIVERY')}
                            disabled={busy}
                            style={{
                                flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                                background: busy ? C.muted : `linear-gradient(135deg, ${C.amber}, #D97706)`,
                                color: '#fff', fontWeight: 800, fontSize: '0.88rem', fontFamily: FONT,
                                transition: 'all 0.15s',
                            }}
                        >
                            {busy ? '⏳...' : '✅ รับงาน — ออกไปส่ง'}
                        </button>
                    )}
                    {info.deliveryStatus === 'OUT_FOR_DELIVERY' && (
                        <button
                            onClick={() => advance('DELIVERED')}
                            disabled={busy}
                            style={{
                                flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                                background: busy ? C.muted : `linear-gradient(135deg, ${C.green}, #059669)`,
                                color: '#fff', fontWeight: 800, fontSize: '0.88rem', fontFamily: FONT,
                                transition: 'all 0.15s',
                            }}
                        >
                            {busy ? '⏳...' : '🎉 ส่งแล้ว!'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
