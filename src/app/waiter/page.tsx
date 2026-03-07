'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useCallback, useRef } from 'react'

interface QueueItem {
    id: string; quantity: number; note: string | null
    kitchenStatus: string; stationId: string | null
    statusChangedAt: string | null
    product: { name: string; category: { icon: string; name: string } }
}
interface QueueOrder {
    orderId: string; orderNumber: string; tableName: string; zone: string
    openedAt: string; orderNote: string | null
    items: QueueItem[]
}

function playBell() {
    try {
        const ctx = new window.AudioContext()
        let t = ctx.currentTime
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination)
            osc.frequency.value = 1047; osc.type = 'sine'
            gain.gain.setValueAtTime(0, t)
            gain.gain.linearRampToValueAtTime(0.8, t + 0.01)
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
            osc.start(t); osc.stop(t + 0.8); t += 0.35
        }
        setTimeout(() => ctx.close(), 3000)
    } catch { }
}

function timeSince(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
    if (diff < 1) return 'เมื่อกี้'
    if (diff < 60) return `${diff} นาทีที่แล้ว`
    return `${Math.floor(diff / 60)} ชม. ${diff % 60} น.`
}

export default function WaiterPage() {
    useRoleGuard(['owner', 'manager', 'kitchen', 'bar', 'cashier', 'waiter'])

    const [orders, setOrders] = useState<QueueOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [updating, setUpdating] = useState<string | null>(null)
    const prevReadyIdsRef = useRef<Set<string>>(new Set())
    const isFirstRef = useRef(true)

    useEffect(() => {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission()
        }
    }, [])

    const fetchReady = useCallback(async () => {
        try {
            const res = await fetch('/api/kitchen/queue?status=READY')
            const json = await res.json()
            if (json.success) {
                const q: QueueOrder[] = json.data.queue
                // Only show orders that have at least one READY item
                const readyOrders = q.filter(o => o.items.some(i => i.kitchenStatus === 'READY'))

                if (!isFirstRef.current) {
                    // Detect newly READY items
                    const newReadyIds = readyOrders.flatMap(o => o.items.filter(i => i.kitchenStatus === 'READY').map(i => i.id))
                    const hasNew = newReadyIds.some(id => !prevReadyIdsRef.current.has(id))
                    if (hasNew) {
                        playBell()
                        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            const tables = readyOrders.filter(o => o.items.some(i => i.kitchenStatus === 'READY' && !prevReadyIdsRef.current.has(i.id)))
                            tables.forEach(o => {
                                new Notification(`✅ อาหารพร้อมเสิร์ฟ — โต๊ะ ${o.tableName}`, {
                                    body: o.items.filter(i => i.kitchenStatus === 'READY').map(i => `${i.quantity}x ${i.product.name}`).join(', '),
                                    tag: `ready-${o.orderId}`,
                                })
                            })
                        }
                    }
                    prevReadyIdsRef.current = new Set(newReadyIds)
                } else {
                    prevReadyIdsRef.current = new Set(readyOrders.flatMap(o => o.items.filter(i => i.kitchenStatus === 'READY').map(i => i.id)))
                    isFirstRef.current = false
                }
                setOrders(readyOrders)
            }
        } catch { }
        setLoading(false)
        setLastUpdate(new Date())
    }, [])

    useEffect(() => { fetchReady() }, [fetchReady])
    useEffect(() => {
        const iv = setInterval(fetchReady, 5000)
        return () => clearInterval(iv)
    }, [fetchReady])

    const markItem = async (itemId: string) => {
        setUpdating(itemId)
        await fetch(`/api/kitchen/items/${itemId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'SERVED' }),
        })
        setUpdating(null)
        fetchReady()
    }

    const serveAll = async (orderId: string) => {
        setUpdating(orderId)
        await fetch(`/api/kitchen/orders/${orderId}/serve-all`, { method: 'PATCH' })
        setUpdating(null)
        fetchReady()
    }

    return (
        <div style={{
            minHeight: '100vh', fontFamily: "'Inter', 'Sarabun', sans-serif",
            background: '#F0FDF4', paddingBottom: 48,
        }}>
            {/* Header */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 20,
                background: 'rgba(240,253,244,0.95)', backdropFilter: 'blur(12px)',
                borderBottom: '2px solid #BBF7D0', padding: '12px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#065F46', margin: 0 }}>🍽️ หน้าเสิร์ฟอาหาร</h1>
                    <p style={{ color: '#059669', fontSize: '0.78rem', margin: '2px 0 0', fontWeight: 500 }}>
                        อาหารพร้อมเสิร์ฟ {orders.reduce((sum, o) => sum + o.items.filter(i => i.kitchenStatus === 'READY').length, 0)} รายการ
                        · อัปเดต {lastUpdate?.toLocaleTimeString('th-TH') ?? '--'}
                    </p>
                </div>
                <div style={{
                    width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#10B981)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                    boxShadow: '0 4px 12px rgba(5,150,105,0.4)',
                }}>
                    {orders.length > 0 ? orders.reduce((s, o) => s + o.items.filter(i => i.kitchenStatus === 'READY').length, 0) : '✓'}
                </div>
            </div>

            {/* Orders */}
            <div style={{ padding: '16px 20px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 80, color: '#059669' }}>กำลังโหลด...</div>
                ) : orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
                        <div style={{ fontSize: '5rem' }}>🛋️</div>
                        <div style={{ color: '#065F46', fontWeight: 700, fontSize: '1.3rem', marginTop: 16 }}>ยังไม่มีอาหารพร้อมเสิร์ฟ</div>
                        <div style={{ color: '#6B7280', fontSize: '0.85rem', marginTop: 8 }}>รอรับแจ้งเตือนจากครัวอัตโนมัติ</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {orders.map(order => {
                            const readyItems = order.items.filter(i => i.kitchenStatus === 'READY')
                            return (
                                <div key={order.orderId} style={{
                                    background: '#fff', borderRadius: 20, overflow: 'hidden',
                                    border: '2px solid #10B981',
                                    boxShadow: '0 4px 20px rgba(16,185,129,0.15)',
                                }}>
                                    {/* Order header */}
                                    <div style={{
                                        background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.08))',
                                        borderBottom: '1px solid #D1FAE5',
                                        padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 900, fontSize: '2rem', color: '#065F46', lineHeight: 1 }}>
                                                {order.tableName}
                                            </div>
                                            <div style={{ color: '#6B7280', fontSize: '0.75rem', marginTop: 4 }}>
                                                {order.zone} · ออเดอร์ #{order.orderNumber} · {timeSince(order.openedAt)}
                                            </div>
                                        </div>
                                        <div style={{
                                            width: 56, height: 56, borderRadius: '50%',
                                            background: 'linear-gradient(135deg,#059669,#10B981)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#fff', fontWeight: 900, fontSize: '1.4rem',
                                            boxShadow: '0 4px 12px rgba(5,150,105,0.4)',
                                        }}>
                                            {readyItems.length}
                                        </div>
                                    </div>

                                    {/* Ready items */}
                                    <div>
                                        {readyItems.map(item => (
                                            <div key={item.id} style={{
                                                padding: '14px 20px',
                                                borderBottom: '1px solid #F0FDF4',
                                                display: 'flex', alignItems: 'center', gap: 16,
                                            }}>
                                                <div style={{
                                                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                                                    background: '#F0FDF4', border: '2px solid #BBF7D0',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.82rem', fontWeight: 900, color: '#059669', flexDirection: 'column', gap: 0,
                                                }}>
                                                    <span style={{ fontSize: '1.4rem' }}>{item.product.category.icon}</span>
                                                    <span style={{ fontSize: '0.7rem', lineHeight: 1, marginTop: 2 }}>x{item.quantity}</span>
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1A1D26' }}>
                                                        {item.product.name}
                                                    </div>
                                                    {item.note && (
                                                        <div style={{ fontSize: '0.8rem', color: '#D97706', marginTop: 2 }}>
                                                            📝 {item.note}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => markItem(item.id)}
                                                    disabled={updating === item.id}
                                                    style={{
                                                        padding: '10px 18px', borderRadius: 12, border: 'none',
                                                        background: 'linear-gradient(135deg,#059669,#10B981)',
                                                        color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                                                        cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
                                                        opacity: updating === item.id ? 0.5 : 1,
                                                        boxShadow: '0 4px 10px rgba(5,150,105,0.3)',
                                                    }}
                                                >
                                                    {updating === item.id ? '⏳' : '🍽️ เสิร์ฟ'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Order note */}
                                    {order.orderNote && (
                                        <div style={{ padding: '10px 20px', background: '#FFFBEB', borderTop: '1px solid #FDE68A', color: '#D97706', fontSize: '0.85rem', fontWeight: 500 }}>
                                            📌 {order.orderNote}
                                        </div>
                                    )}

                                    {/* Serve all button */}
                                    <div style={{ padding: '14px 20px', background: '#F0FDF4', borderTop: '1px solid #D1FAE5' }}>
                                        <button
                                            onClick={() => serveAll(order.orderId)}
                                            disabled={updating === order.orderId}
                                            style={{
                                                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                                                background: 'linear-gradient(135deg,#065F46,#059669)',
                                                color: '#fff', fontWeight: 900, fontSize: '1.05rem',
                                                cursor: 'pointer', fontFamily: 'inherit',
                                                opacity: updating === order.orderId ? 0.5 : 1,
                                                boxShadow: '0 4px 14px rgba(5,150,105,0.4)',
                                                letterSpacing: '0.02em',
                                            }}
                                        >
                                            {updating === order.orderId ? '⏳ กำลังบันทึก...' : `✅ เสิร์ฟครบทั้งโต๊ะ ${order.tableName} (${readyItems.length} รายการ)`}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
