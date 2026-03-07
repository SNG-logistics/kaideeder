'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useCallback, useRef } from 'react'

interface QueueItem {
    id: string; quantity: number; unitPrice: number; note: string | null
    kitchenStatus: string; stationId: string | null
    statusChangedAt: string | null
    product: { id: string; sku: string; name: string; imageUrl: string | null; category: { code: string; name: string; icon: string; color: string } }
    statusChangedBy: { name: string } | null
}
interface QueueOrder {
    orderId: string; orderNumber: string; tableName: string; zone: string
    openedAt: string; orderNote: string | null
    items: QueueItem[]
}

const STATUS_BG: Record<string, string> = {
    PENDING: '#EF4444', ACCEPTED: '#3B82F6', COOKING: '#F59E0B', READY: '#10B981', SERVED: '#4B5563',
}
const STATUS_LABEL: Record<string, string> = {
    PENDING: '⏳ รอรับ', ACCEPTED: '👌 รับแล้ว', COOKING: '🔥 กำลังทำ', READY: '✅ พร้อมเสิร์ฟ', SERVED: '🍽️ เสิร์ฟแล้ว',
}
const NEXT_STATUS: Record<string, string> = {
    PENDING: 'ACCEPTED', ACCEPTED: 'COOKING', COOKING: 'READY', READY: 'SERVED',
}
const NEXT_LABEL: Record<string, string> = {
    PENDING: '👌 รับงาน', ACCEPTED: '🔥 เริ่มทำ', COOKING: '✅ เสร็จแล้ว', READY: '🍽️ เสิร์ฟแล้ว',
}

function playBell(freq = 880, times = 2) {
    try {
        const ctx = new window.AudioContext()
        let t = ctx.currentTime
        for (let i = 0; i < times; i++) {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination)
            osc.frequency.value = freq; osc.type = 'sine'
            gain.gain.setValueAtTime(0, t)
            gain.gain.linearRampToValueAtTime(0.7, t + 0.01)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0)
            osc.start(t); osc.stop(t + 1.0); t += 0.45
        }
        setTimeout(() => ctx.close(), (times * 0.45 + 1.1) * 1000)
    } catch { }
}

function ageMinutes(dateStr: string) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
}
function timeSince(dateStr: string) {
    const diff = ageMinutes(dateStr)
    if (diff < 1) return 'เมื่อกี้'
    if (diff < 60) return `${diff} นาที`
    return `${Math.floor(diff / 60)} ชม. ${diff % 60} น.`
}

export default function KitchenPage() {
    useRoleGuard(['owner', 'manager', 'kitchen', 'bar', 'cashier'])
    const [queue, setQueue] = useState<QueueOrder[]>([])
    const [station, setStation] = useState('')
    const [showServed, setShowServed] = useState(false)
    const [counts, setCounts] = useState({ PENDING: 0, ACCEPTED: 0, COOKING: 0, READY: 0 })
    const [loading, setLoading] = useState(true)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [updating, setUpdating] = useState<string | null>(null)
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
    const [isMobile, setIsMobile] = useState(false)
    const [mobileTab, setMobileTab] = useState<'list' | 'items'>('list')
    const prevOrderIdsRef = useRef<Set<string>>(new Set())
    const isFirstLoadRef = useRef(true)

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    useEffect(() => {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission()
        }
    }, [])

    const fetchQueue = useCallback(async () => {
        try {
            const params = new URLSearchParams()
            if (station) params.set('station', station)
            const sf = showServed ? 'PENDING,ACCEPTED,COOKING,READY,SERVED' : 'PENDING,ACCEPTED,COOKING,READY'
            params.set('status', sf)
            const res = await fetch(`/api/kitchen/queue?${params}`)
            const json = await res.json()
            if (json.success) {
                const newQueue: QueueOrder[] = json.data.queue
                setCounts(json.data.byStatus)
                if (!isFirstLoadRef.current) {
                    const newOrders = newQueue.filter(o => !prevOrderIdsRef.current.has(o.orderId))
                    if (newOrders.length > 0) {
                        const hasBar = newOrders.some(o => o.items.some(i => i.stationId === 'BAR'))
                        const hasKitchen = newOrders.some(o => o.items.some(i => i.stationId !== 'BAR'))
                        if (hasKitchen) playBell(880, 3)
                        else if (hasBar) playBell(660, 2)
                    }
                }
                prevOrderIdsRef.current = new Set(newQueue.map(o => o.orderId))
                isFirstLoadRef.current = false
                setQueue(newQueue)
                setSelectedOrderId(prev => {
                    if (prev && newQueue.some(o => o.orderId === prev)) return prev
                    return newQueue[0]?.orderId ?? null
                })
            }
        } catch { }
        setLoading(false)
        setLastUpdate(new Date())
    }, [station, showServed])

    useEffect(() => { fetchQueue() }, [fetchQueue])
    useEffect(() => {
        const iv = setInterval(fetchQueue, 5000)
        return () => clearInterval(iv)
    }, [fetchQueue])
    useEffect(() => {
        const t = setInterval(() => setQueue(q => [...q]), 30000)
        return () => clearInterval(t)
    }, [])

    const updateStatus = async (itemId: string, newStatus: string) => {
        setUpdating(itemId)
        await fetch(`/api/kitchen/items/${itemId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        })
        setUpdating(null)
        fetchQueue()
    }

    const serveAll = async (orderId: string) => {
        setUpdating(orderId)
        await fetch(`/api/kitchen/orders/${orderId}/serve-all`, { method: 'PATCH' })
        setUpdating(null)
        fetchQueue()
    }

    const selectedOrder = queue.find(o => o.orderId === selectedOrderId) ?? null
    const totalActive = counts.PENDING + counts.ACCEPTED + counts.COOKING + counts.READY

    // ── Shared: Order List column
    const OrderList = (
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: isMobile ? 1 : '0 0 270px', background: '#fff', borderRight: isMobile ? 'none' : '1px solid #E5E7EB' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1F2937' }}>📋 รายการโต๊ะ</span>
                <span style={{ fontSize: '0.72rem', background: '#E8364E', color: '#fff', borderRadius: 12, padding: '2px 9px', fontWeight: 700 }}>{queue.length} โต๊ะ</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>กำลังโหลด...</div>
                ) : queue.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>✅</div>
                        <div style={{ color: '#10B981', fontWeight: 700 }}>ไม่มีออเดอร์ค้าง</div>
                        <div style={{ color: '#9CA3AF', fontSize: '0.78rem', marginTop: 4 }}>{totalActive} รายการ</div>
                    </div>
                ) : queue.map(order => {
                    const age = ageMinutes(order.openedAt)
                    const isSelected = selectedOrderId === order.orderId
                    const hasPending = order.items.some(i => i.kitchenStatus === 'PENDING')
                    return (
                        <div key={order.orderId}
                            onClick={() => {
                                setSelectedOrderId(order.orderId)
                                if (isMobile) setMobileTab('items')
                            }}
                            style={{ padding: '13px 14px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: isSelected ? 'rgba(232,54,78,0.07)' : '#fff', borderLeft: isSelected ? '4px solid #E8364E' : '4px solid transparent', transition: 'all 0.12s', position: 'relative' }}>
                            {hasPending && <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1.5s infinite' }} />}
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: isSelected ? '#E8364E' : '#111827' }}>โต๊ะ {order.tableName}</div>
                            <div style={{ fontSize: '0.73rem', color: '#6B7280', marginTop: 2 }}>⏱ {timeSince(order.openedAt)} · {order.items.length} รายการ</div>
                            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {order.items.slice(0, 3).map(item => (
                                    <span key={item.id} style={{ fontSize: '0.67rem', padding: '2px 7px', borderRadius: 10, background: STATUS_BG[item.kitchenStatus] + '22', color: STATUS_BG[item.kitchenStatus], fontWeight: 600 }}>
                                        {item.product.name.length > 8 ? item.product.name.slice(0, 8) + '…' : item.product.name}
                                    </span>
                                ))}
                                {order.items.length > 3 && <span style={{ fontSize: '0.67rem', color: '#9CA3AF' }}>+{order.items.length - 3}</span>}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )

    // ── Shared: Item Detail column
    const ItemDetail = selectedOrder ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F9FAFB' }}>
            {/* Right header */}
            <div style={{ padding: '11px 18px', borderBottom: '1px solid #E5E7EB', background: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {isMobile && (
                    <button onClick={() => setMobileTab('list')} style={{ marginRight: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#E8364E', padding: 0 }}>←</button>
                )}
                <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#E8364E' }}>โต๊ะ {selectedOrder.tableName}</span>
                <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>{selectedOrder.zone} · #{selectedOrder.orderNumber}</span>
                <div style={{ marginLeft: 'auto', padding: '3px 12px', borderRadius: 20, background: ageMinutes(selectedOrder.openedAt) >= 10 ? '#FEE2E2' : '#FEF3C7', color: ageMinutes(selectedOrder.openedAt) >= 10 ? '#B91C1C' : '#92400E', fontSize: '0.75rem', fontWeight: 700 }}>
                    ⏱ {timeSince(selectedOrder.openedAt)}
                </div>
            </div>
            {selectedOrder.orderNote && (
                <div style={{ padding: '7px 18px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A', color: '#92400E', fontSize: '0.82rem' }}>
                    📌 {selectedOrder.orderNote}
                </div>
            )}
            {/* Items */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedOrder.items.map(item => {
                    const isServed = item.kitchenStatus === 'SERVED'
                    const isWorking = updating === item.id
                    const next = NEXT_STATUS[item.kitchenStatus]
                    const hasPending = item.kitchenStatus === 'PENDING'
                    return (
                        <div key={item.id} style={{ background: '#fff', borderRadius: 14, border: hasPending ? '2px solid #E8364E' : '1px solid #E5E7EB', boxShadow: hasPending ? '0 4px 14px rgba(232,54,78,0.15)' : '0 1px 4px rgba(0,0,0,0.05)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: isServed ? 0.45 : 1 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: hasPending ? 'linear-gradient(135deg,#E8364E,#FF6B35)' : STATUS_BG[item.kitchenStatus] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem', color: hasPending ? '#fff' : STATUS_BG[item.kitchenStatus] }}>
                                {item.quantity}
                            </div>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                                {item.product.imageUrl
                                    ? <img src={item.product.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                                    : item.product.category.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.product.name}</div>
                                <div style={{ fontSize: '0.72rem', color: STATUS_BG[item.kitchenStatus], fontWeight: 600, marginTop: 2 }}>{STATUS_LABEL[item.kitchenStatus]}</div>
                                {item.note && <div style={{ fontSize: '0.72rem', color: '#D97706', marginTop: 2 }}>📝 {item.note}</div>}
                            </div>
                            {next && (
                                <button onClick={() => updateStatus(item.id, next)} disabled={isWorking}
                                    style={{ padding: isMobile ? '8px 10px' : '8px 16px', borderRadius: 10, border: 'none', background: hasPending ? 'linear-gradient(135deg,#E8364E,#FF6B35)' : STATUS_BG[next], color: '#fff', fontWeight: 700, fontSize: isMobile ? '0.75rem' : '0.83rem', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', opacity: isWorking ? 0.6 : 1, boxShadow: hasPending ? '0 4px 10px rgba(232,54,78,0.4)' : 'none', whiteSpace: 'nowrap' }}>
                                    {isWorking ? '⏳' : NEXT_LABEL[item.kitchenStatus]}
                                </button>
                            )}
                            <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: isServed ? '#10B981' : '#F3F4F6', border: `2px solid ${isServed ? '#10B981' : '#D1D5DB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', color: '#fff' }}>
                                {isServed ? '✓' : ''}
                            </div>
                        </div>
                    )
                })}
            </div>
            {/* Bottom bar */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #E5E7EB', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                    {selectedOrder.items.filter(i => i.kitchenStatus === 'READY' || i.kitchenStatus === 'SERVED').length}/{selectedOrder.items.length} เสร็จ
                </div>
                {selectedOrder.items.some(i => i.kitchenStatus === 'READY') && (
                    <button onClick={() => serveAll(selectedOrder.orderId)} disabled={updating === selectedOrder.orderId}
                        style={{ padding: '9px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', opacity: updating === selectedOrder.orderId ? 0.6 : 1, boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>
                        {updating === selectedOrder.orderId ? '⏳' : '🍽️ เสิร์ฟทั้งโต๊ะ'}
                    </button>
                )}
            </div>
        </div>
    ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#9CA3AF', background: '#F9FAFB' }}>
            <div style={{ fontSize: '3rem' }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#10B981' }}>ไม่มีออเดอร์ค้าง</div>
            <div style={{ fontSize: '0.82rem' }}>รอรับออเดอร์ใหม่...</div>
        </div>
    )

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Sarabun', 'Inter', sans-serif", background: '#F5F5F5', overflow: 'hidden' }}>

            {/* ── Header ── */}
            <div style={{ background: 'linear-gradient(135deg, #E8364E 0%, #FF6B35 60%, #FF8C00 100%)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, color: '#fff', flexShrink: 0, boxShadow: '0 4px 16px rgba(232,54,78,0.4)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>🍳</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: isMobile ? '0.95rem' : '1.05rem', lineHeight: 1.1 }}>จอครัว (KDS)</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.85, display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                        {[
                            { label: '⏳', count: counts.PENDING, bg: '#FFF9C4', text: '#B45309' },
                            { label: '🔥', count: counts.COOKING, bg: '#FEE2E2', text: '#B91C1C' },
                            { label: '✅', count: counts.READY, bg: '#D1FAE5', text: '#065F46' },
                        ].map(b => (
                            <span key={b.label} style={{ background: b.bg, color: b.text, padding: '1px 7px', borderRadius: 10, fontWeight: 700, fontSize: '0.7rem' }}>{b.label} {b.count}</span>
                        ))}
                    </div>
                </div>

                {/* Station tabs — hide text on very small mobile */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {[{ key: '', label: isMobile ? '📋' : '📋 ทั้งหมด' }, { key: 'KITCHEN', label: isMobile ? '🍳' : '🍳 ครัว' }, { key: 'BAR', label: isMobile ? '🍺' : '🍺 บาร์' }].map(tab => (
                        <button key={tab.key} onClick={() => setStation(tab.key)} style={{ padding: isMobile ? '5px 8px' : '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', fontFamily: 'inherit', background: station === tab.key ? '#fff' : 'rgba(255,255,255,0.2)', color: station === tab.key ? '#E8364E' : '#fff', transition: 'all 0.15s' }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <button onClick={() => setShowServed(v => !v)} style={{ padding: isMobile ? '5px 8px' : '5px 12px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.4)', background: showServed ? 'rgba(255,255,255,0.3)' : 'transparent', color: '#fff', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {isMobile ? (showServed ? '🙈' : '👁') : (showServed ? '🙈 ซ่อน' : '👁 ดูเสิร์ฟ')}
                </button>

                {!isMobile && (
                    <div style={{ fontSize: '0.7rem', opacity: 0.75, whiteSpace: 'nowrap' }}>🔄 {lastUpdate?.toLocaleTimeString('th-TH') ?? '--:--'}</div>
                )}
            </div>

            {/* ── Body ── */}
            {isMobile ? (
                // MOBILE: tab-based — List or Items
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {mobileTab === 'list' ? OrderList : ItemDetail}
                </div>
            ) : (
                // DESKTOP: split panel
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {OrderList}
                    {ItemDetail}
                </div>
            )}

            <style>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
            `}</style>
        </div>
    )
}
