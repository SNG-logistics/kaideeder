'use client'
import { useEffect, useState, useCallback, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
type OrderItem = { id: string; quantity: number; unitPrice: number; note: string | null; product: { name: string } }
type PendingOrder = {
    id: string; orderNumber: string; createdAt: string
    table: { number: number; name: string; zone: string } | null
    items: OrderItem[]
    totalAmount: number
}
type BillRequest = {
    id: string; orderNumber: string; note: string; openedAt: string
    table: { number: number; name: string; zone: string } | null
    items: OrderItem[]
}

const POLL_INTERVAL = 3000   // 3 s — new orders
const BILL_POLL_INTERVAL = 3000  // 3 s — bill requests

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

// ── New Order Modal ────────────────────────────────────────────────────────
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
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🔔</div>
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

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>รายการ</div>
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

// ── Bill Request Modal ─────────────────────────────────────────────────────
function BillRequestModal({ bill, onAck, onClose }: {
    bill: BillRequest; onAck: () => void; onClose: () => void
}) {
    const total = bill.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    // Extract time from note e.g. "🧾 เรียกเช็คบิล 14:30"
    const timeMatch = bill.note?.match(/(\d{2}:\d{2})/)
    const requestTime = timeMatch?.[1] || fmtTime(bill.openedAt)

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
            <div style={{
                position: 'relative', background: '#140a0a',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 18, padding: '24px', width: '100%', maxWidth: 400,
                boxShadow: '0 24px 64px rgba(239,68,68,0.25)', animation: 'slideUp 0.25s ease',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem', flexShrink: 0,
                        animation: 'billPulse 1.2s ease-in-out infinite',
                    }}>🧾</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, color: '#fef2f2', fontSize: '1rem' }}>
                            ลูกค้าเรียกเช็คบิล!
                        </div>
                        <div style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: 3, fontWeight: 600 }}>
                            {bill.table ? `โต๊ะ ${bill.table.name}` : 'ไม่ระบุโต๊ะ'}
                            {bill.table?.zone && ` — ${bill.table.zone}`}
                            &nbsp;•&nbsp; เวลา {requestTime}
                        </div>
                    </div>
                </div>

                {/* Items summary */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.12)',
                    borderRadius: 10, marginBottom: 16, overflow: 'hidden',
                }}>
                    <div style={{ padding: '7px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>รายการ</div>
                    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                        {bill.items.length === 0 ? (
                            <div style={{ padding: '10px 14px', color: '#64748b', fontSize: '0.8rem' }}>ยังไม่มีรายการ</div>
                        ) : bill.items.slice(0, 8).map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>
                                    <span style={{ color: '#fca5a5', fontWeight: 700 }}>×{item.quantity} </span>
                                    {item.product.name}
                                </span>
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                    {Math.round(item.quantity * item.unitPrice).toLocaleString()}
                                </span>
                            </div>
                        ))}
                        {bill.items.length > 8 && (
                            <div style={{ padding: '6px 14px', color: '#64748b', fontSize: '0.72rem' }}>+{bill.items.length - 8} รายการ</div>
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(239,68,68,0.06)', borderTop: '1px solid rgba(239,68,68,0.1)' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>ยอดรวม</span>
                        <span style={{ color: '#f87171', fontWeight: 900, fontSize: '1rem' }}>
                            {Math.round(total).toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#64748b', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        รอก่อน
                    </button>
                    <button onClick={onAck} style={{
                        flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg,#dc2626,#ef4444)',
                        color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                        cursor: 'pointer', fontFamily: 'inherit',
                        boxShadow: '0 4px 16px rgba(220,38,38,0.45)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                        🧾 รับทราบ — เตรียมบิล
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes billPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
            `}</style>
        </div>
    )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function NewOrderAlert() {
    // ── New orders (QR → PENDING_CONFIRM) ─────────────────────────────────
    const [pending, setPending] = useState<PendingOrder[]>([])
    const [current, setCurrent] = useState<PendingOrder | null>(null)
    const [seenIds, setSeenIds] = useState<Set<string>>(new Set())

    // ── Bill requests ──────────────────────────────────────────────────────
    const [billRequests, setBillRequests] = useState<BillRequest[]>([])
    const [currentBill, setCurrentBill] = useState<BillRequest | null>(null)
    const [billSeenIds, setBillSeenIds] = useState<Set<string>>(new Set())

    // ── Sound ──────────────────────────────────────────────────────────────
    const audioUnlocked = useRef(false)
    const [showSoundHint, setShowSoundHint] = useState(true)

    useEffect(() => {
        function unlock() { audioUnlocked.current = true; setShowSoundHint(false) }
        document.addEventListener('click', unlock, { once: true })
        document.addEventListener('touchstart', unlock, { once: true })
        return () => { document.removeEventListener('click', unlock); document.removeEventListener('touchstart', unlock) }
    }, [])

    const playSound = useCallback(() => {
        if (!audioUnlocked.current) return
        try { new Audio('/notification.mp3').play() } catch {}
    }, [])

    // ── Poll: new QR orders ────────────────────────────────────────────────
    const fetchPending = useCallback(async () => {
        try {
            const res = await fetch('/api/pos/orders?status=PENDING_CONFIRM')
            if (!res.ok) return
            const data = await res.json()
            const orders: PendingOrder[] = data.data ?? data ?? []
            setPending(orders)
            if (orders.length > 0 && !current) {
                const unseen = orders.find(o => !seenIds.has(o.id))
                if (unseen) {
                    setCurrent(unseen)
                    setSeenIds(prev => new Set([...prev, unseen.id]))
                    playSound()
                }
            }
        } catch {}
    }, [current, seenIds, playSound])

    // ── Poll: bill requests ────────────────────────────────────────────────
    const fetchBillRequests = useCallback(async () => {
        try {
            const res = await fetch('/api/pos/bill-requests')
            if (!res.ok) return
            const data = await res.json()
            const bills: BillRequest[] = data.data ?? []
            setBillRequests(bills)
            if (bills.length > 0 && !currentBill) {
                const unseen = bills.find(b => !billSeenIds.has(b.id))
                if (unseen) {
                    setCurrentBill(unseen)
                    setBillSeenIds(prev => new Set([...prev, unseen.id]))
                    playSound()
                }
            }
        } catch {}
    }, [currentBill, billSeenIds, playSound])

    useEffect(() => {
        fetchPending()
        const iv = setInterval(fetchPending, POLL_INTERVAL)
        return () => clearInterval(iv)
    }, [fetchPending])

    useEffect(() => {
        fetchBillRequests()
        const iv = setInterval(fetchBillRequests, BILL_POLL_INTERVAL)
        return () => clearInterval(iv)
    }, [fetchBillRequests])

    // ── Handlers ───────────────────────────────────────────────────────────
    function handleConfirm() {
        if (current) setPending(prev => prev.filter(o => o.id !== current.id))
        setCurrent(null)
    }

    function handleBillAck() {
        setCurrentBill(null)
        // Show next pending bill if any
        const next = billRequests.find(b => !billSeenIds.has(b.id) && b.id !== currentBill?.id)
        if (next) {
            setCurrentBill(next)
            setBillSeenIds(prev => new Set([...prev, next.id]))
        }
    }

    // Pending bill count excluding seen
    const unseenBillCount = billRequests.filter(b => !billSeenIds.has(b.id) || b.id === currentBill?.id).length

    return (
        <>
            {/* Sound unlock hint */}
            {showSoundHint && (pending.length > 0 || billRequests.length > 0) && (
                <div
                    onClick={() => { audioUnlocked.current = true; setShowSoundHint(false) }}
                    style={{
                        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 10000, background: '#1e293b', border: '1px solid rgba(245,158,11,0.4)',
                        borderRadius: 99, padding: '6px 16px', fontSize: '0.75rem',
                        color: '#f59e0b', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
                    }}
                >
                    🔔 แตะที่นี่เพื่อเปิดเสียงแจ้งเตือน
                </div>
            )}

            {/* 🟡 New order badge */}
            {pending.length > 0 && !current && (
                <button
                    onClick={() => { if (pending.length > 0) setCurrent(pending[0]) }}
                    style={{
                        position: 'fixed', bottom: 80, right: unseenBillCount > 0 ? 170 : 20, zIndex: 1000,
                        background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 14,
                        padding: '10px 16px', fontWeight: 800, fontSize: '0.85rem',
                        cursor: 'pointer', fontFamily: 'inherit',
                        boxShadow: '0 6px 20px rgba(245,158,11,0.5)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        animation: 'pulse 1.5s ease-in-out infinite',
                        transition: 'right 0.3s ease',
                    }}
                >
                    🔔 ออเดอร์ใหม่ {pending.length > 1 && <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 99, padding: '1px 7px', fontSize: '0.72rem' }}>{pending.length}</span>}
                </button>
            )}

            {/* 🔴 Bill request badge */}
            {billRequests.length > 0 && !currentBill && (
                <button
                    onClick={() => {
                        const first = billRequests[0]
                        if (first) {
                            setCurrentBill(first)
                            setBillSeenIds(prev => new Set([...prev, first.id]))
                        }
                    }}
                    style={{
                        position: 'fixed', bottom: 80, right: 20, zIndex: 1001,
                        background: 'linear-gradient(135deg,#dc2626,#ef4444)',
                        color: '#fff', border: 'none', borderRadius: 14,
                        padding: '10px 16px', fontWeight: 800, fontSize: '0.85rem',
                        cursor: 'pointer', fontFamily: 'inherit',
                        boxShadow: '0 6px 20px rgba(220,38,38,0.55)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        animation: 'billBadgePulse 1.2s ease-in-out infinite',
                    }}
                >
                    🧾 เช็คบิล {billRequests.length > 1 && <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 99, padding: '1px 7px', fontSize: '0.72rem' }}>{billRequests.length}</span>}
                </button>
            )}

            {/* New order modal */}
            {current && (
                <PendingOrderModal
                    order={current}
                    onConfirm={handleConfirm}
                    onClose={() => setCurrent(null)}
                />
            )}

            {/* Bill request modal */}
            {currentBill && (
                <BillRequestModal
                    bill={currentBill}
                    onAck={handleBillAck}
                    onClose={() => setCurrentBill(null)}
                />
            )}

            <style>{`
                @keyframes pulse{0%,100%{box-shadow:0 6px 20px rgba(245,158,11,0.5)}50%{box-shadow:0 6px 30px rgba(245,158,11,0.85)}}
                @keyframes billBadgePulse{0%,100%{box-shadow:0 6px 20px rgba(220,38,38,0.55)}50%{box-shadow:0 6px 30px rgba(220,38,38,0.9),0 0 0 4px rgba(220,38,38,0.15)}}
            `}</style>
        </>
    )
}
