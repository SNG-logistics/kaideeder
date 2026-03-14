'use client'
import { useEffect, useState, useCallback } from 'react'

type OrderItem = { id: string; quantity: number; unitPrice: number; note: string | null; product: { name: string } }
type PendingOrder = {
    id: string; orderNumber: string; createdAt: string
    table: { number: number; name: string; zone: string } | null
    items: OrderItem[]
    totalAmount: number
}

const POLL_INTERVAL = 6000  // 6 seconds

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

// ── Modal showing one pending QR order ────────────────────────────
function PendingOrderModal({ order, onConfirm, onClose }: {
    order: PendingOrder; onConfirm: () => void; onClose: () => void
}) {
    const [loading, setLoading] = useState(false)

    async function confirm() {
        setLoading(true)
        try {
            const res = await fetch(`/api/pos/orders/${order.id}/confirm`, { method: 'POST' })
            if (res.ok) onConfirm()
            else {
                const j = await res.json()
                alert(j.error || 'เกิดข้อผิดพลาด')
            }
        } catch { alert('Network error') }
        setLoading(false)
    }

    const total = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
            <div style={{ position: 'relative', background: '#0d1220', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', animation: 'slideUp 0.25s ease' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                        🔔
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '0.95rem' }}>ออเดอร์ใหม่จากลูกค้า</div>
                        <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 2 }}>
                            {order.table ? `โต๊ะ ${order.table.number} — ${order.table.zone}` : 'ไม่ระบุโต๊ะ'} • {fmtTime(order.createdAt)}
                        </div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '3px 8px', borderRadius: 6 }}>
                        {order.orderNumber}
                    </div>
                </div>

                {/* Items */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        รายการ
                    </div>
                    {order.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ color: '#e2e8f0', fontSize: '0.82rem' }}>
                                <span style={{ color: '#f59e0b', fontWeight: 700 }}>×{item.quantity} </span>
                                {item.product.name}
                                {item.note && <span style={{ color: '#64748b', marginLeft: 6 }}>({item.note})</span>}
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: '0.78rem', flexShrink: 0, marginLeft: 8 }}>
                                {Math.round(item.quantity * item.unitPrice).toLocaleString()}
                            </span>
                        </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>รวม</span>
                        <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.9rem' }}>{Math.round(total).toLocaleString()}</span>
                    </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.09)', background: 'transparent', color: '#64748b', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        รอก่อน
                    </button>
                    <button onClick={confirm} disabled={loading} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', background: loading ? '#374151' : '#16a34a', color: '#fff', fontWeight: 800, fontSize: '0.88rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 4px 16px rgba(22,163,74,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {loading ? '⏳ กำลังยืนยัน…' : '✅ ยืนยัน → ส่งครัว'}
                    </button>
                </div>
            </div>
            <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
        </div>
    )
}

// ── Main component — drop into any layout or sidebar ───────────────
export default function NewOrderAlert() {
    const [pending, setPending] = useState<PendingOrder[]>([])
    const [current, setCurrent] = useState<PendingOrder | null>(null)
    const [seenIds, setSeenIds] = useState<Set<string>>(new Set())

    const fetchPending = useCallback(async () => {
        try {
            const res = await fetch('/api/pos/orders?status=PENDING_CONFIRM')
            if (!res.ok) return
            const data = await res.json()
            const orders: PendingOrder[] = data.data ?? data ?? []
            setPending(orders)
            // Auto-pop modal for first unseen order
            if (orders.length > 0 && !current) {
                const unseen = orders.find(o => !seenIds.has(o.id))
                if (unseen) {
                    setCurrent(unseen)
                    setSeenIds(prev => new Set([...prev, unseen.id]))
                    // Play notification sound
                    try { new Audio('/notification.mp3').play() } catch {}
                }
            }
        } catch {}
    }, [current, seenIds])

    useEffect(() => {
        fetchPending()
        const iv = setInterval(fetchPending, POLL_INTERVAL)
        return () => clearInterval(iv)
    }, [fetchPending])

    function handleConfirm() {
        // Remove confirmed order from pending list
        if (current) {
            setPending(prev => prev.filter(o => o.id !== current.id))
        }
        setCurrent(null)
    }

    function handleClose() {
        setCurrent(null)
    }

    if (pending.length === 0 && !current) return null

    return (
        <>
            {/* Badge — shows on any persistent nav/header */}
            {pending.length > 0 && !current && (
                <button
                    onClick={() => { if (pending.length > 0) setCurrent(pending[0]) }}
                    style={{
                        position: 'fixed', bottom: 80, right: 20, zIndex: 1000,
                        background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 14,
                        padding: '10px 16px', fontWeight: 800, fontSize: '0.85rem',
                        cursor: 'pointer', fontFamily: 'inherit',
                        boxShadow: '0 6px 20px rgba(245,158,11,0.5)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                >
                    🔔 ออเดอร์ใหม่ {pending.length > 1 && <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 99, padding: '1px 7px', fontSize: '0.72rem' }}>{pending.length}</span>}
                </button>
            )}

            {/* Modal */}
            {current && (
                <PendingOrderModal
                    order={current}
                    onConfirm={handleConfirm}
                    onClose={handleClose}
                />
            )}

            <style>{`@keyframes pulse{0%,100%{box-shadow:0 6px 20px rgba(245,158,11,0.5)}50%{box-shadow:0 6px 30px rgba(245,158,11,0.85)}}`}</style>
        </>
    )
}
