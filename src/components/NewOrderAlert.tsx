'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useNotification } from './NotificationContext'
import { useCurrentUser } from '@/hooks/useCurrentUser'

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

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

// ── New Order Modal (Green theme) ──────────────────────────────────────────
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
                const j = await res.json().catch(() => ({}))
                alert(j.error || 'เกิดข้อผิดพลาด')
            }
        } catch { alert('Network error') }
        setLoading(false)
    }

    const total = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
            <div style={{
                position: 'relative', background: '#071810',
                border: '1.5px solid rgba(22,163,74,0.45)',
                borderRadius: 18, padding: '24px', width: '100%', maxWidth: 420,
                boxShadow: '0 24px 64px rgba(22,163,74,0.3)', animation: 'slideUp 0.25s ease',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: 'rgba(22,163,74,0.15)', border: '1.5px solid rgba(22,163,74,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem', flexShrink: 0,
                        animation: 'orderIconPulse 1.2s ease-in-out infinite',
                    }}>🍽️</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, color: '#f0fdf4', fontSize: '1rem' }}>ออเดอร์ใหม่จากลูกค้า!</div>
                        <div style={{ color: '#86efac', fontSize: '0.78rem', marginTop: 3, fontWeight: 600 }}>
                            {order.table ? `โต๊ะ ${order.table.name}` : 'ไม่ระบุโต๊ะ'}
                            {order.table?.zone && ` — ${order.table.zone}`}
                            &nbsp;•&nbsp; {fmtTime(order.createdAt)}
                        </div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#4ade80', background: 'rgba(22,163,74,0.12)', padding: '3px 8px', borderRadius: 6 }}>
                        {order.orderNumber}
                    </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>รายการที่สั่ง</div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {order.items.map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <span style={{ color: '#e2e8f0', fontSize: '0.82rem' }}>
                                    <span style={{ color: '#4ade80', fontWeight: 700 }}>×{item.quantity} </span>
                                    {item.product.name}
                                    {item.note && <span style={{ color: '#64748b', marginLeft: 6 }}>({item.note})</span>}
                                </span>
                                <span style={{ color: '#94a3b8', fontSize: '0.78rem', flexShrink: 0, marginLeft: 8 }}>
                                    {Math.round(item.quantity * item.unitPrice).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(22,163,74,0.06)', borderTop: '1px solid rgba(22,163,74,0.12)' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>รวม</span>
                        <span style={{ color: '#4ade80', fontWeight: 800, fontSize: '0.9rem' }}>{Math.round(total).toLocaleString()} ฿</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.09)', background: 'transparent', color: '#64748b', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        รอก่อน
                    </button>
                    <button onClick={confirm} disabled={loading} style={{
                        flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                        background: loading ? '#374151' : 'linear-gradient(135deg,#16a34a,#15803d)',
                        color: '#fff', fontWeight: 800, fontSize: '0.9rem',
                        cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                        boxShadow: loading ? 'none' : '0 4px 16px rgba(22,163,74,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                        {loading ? '⏳ กำลังยืนยัน…' : '✅ ยืนยัน → ส่งครัว'}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes orderIconPulse{0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,0.5)}50%{box-shadow:0 0 0 10px rgba(22,163,74,0)}}
            `}</style>
        </div>
    )
}

// ── Bill Request Modal (Red theme) ─────────────────────────────────────────
function BillRequestModal({ bill, onAck, onClose, onCancel, canCancel }: {
    bill: BillRequest; onAck: () => void; onClose: () => void
    onCancel?: () => void; canCancel?: boolean
}) {
    const total = bill.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
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
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem', flexShrink: 0,
                        animation: 'billPulse 1.2s ease-in-out infinite',
                    }}>🧾</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, color: '#fef2f2', fontSize: '1rem' }}>ลูกค้าเรียกเช็คบิล!</div>
                        <div style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: 3, fontWeight: 600 }}>
                            {bill.table ? `โต๊ะ ${bill.table.name}` : 'ไม่ระบุโต๊ะ'}
                            {bill.table?.zone && ` — ${bill.table.zone}`}
                            &nbsp;•&nbsp; {requestTime}
                        </div>
                    </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
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
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(239,68,68,0.06)', borderTop: '1px solid rgba(239,68,68,0.1)' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>ยอดรวม</span>
                        <span style={{ color: '#f87171', fontWeight: 900, fontSize: '1rem' }}>{Math.round(total).toLocaleString()} ฿</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                    {canCancel && onCancel && (
                        <button onClick={onCancel} style={{
                            width: '100%', padding: '10px', borderRadius: 10,
                            border: '1.5px solid rgba(251,191,36,0.4)',
                            background: 'rgba(251,191,36,0.08)',
                            color: '#fbbf24', fontWeight: 700, fontSize: '0.82rem',
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                            ❌ ยกเลิกคำขอเช็คบิล (Owner)
                        </button>
                    )}
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
    const router = useRouter()
    const user = useCurrentUser()
    const { notifications, removeNotification, refresh, markAsSeen } = useNotification()
    const [viewingId, setViewingId] = useState<string | null>(null)
    const canCancel = ['OWNER', 'MANAGER', 'owner', 'manager'].includes(user?.role ?? '')

    const orderNotifs = notifications.filter(n => n.type === 'ORDER_NEW')
    const billNotifs  = notifications.filter(n => n.type === 'BILL_REQUEST')
    const deliveryNotifs = notifications.filter(n => n.type === 'DELIVERY_NEW')

    const currentOrderNode = viewingId ? orderNotifs.find(n => n.id === viewingId) : null
    const currentBillNode  = viewingId ? billNotifs.find(n => n.id === viewingId)  : null

    const handleConfirmOrder = useCallback(() => {
        if (currentOrderNode) {
            markAsSeen(currentOrderNode.id)
            removeNotification(currentOrderNode.id)
            setViewingId(null)
            refresh()
        }
    }, [currentOrderNode, markAsSeen, removeNotification, refresh])

    const handleAckBill = useCallback(() => {
        if (currentBillNode) {
            markAsSeen(currentBillNode.id)
            removeNotification(currentBillNode.id)
            setViewingId(null)
            refresh()
        }
    }, [currentBillNode, markAsSeen, removeNotification, refresh])

    const handleCancelBill = useCallback(async () => {
        if (!currentBillNode) return
        try { await fetch(`/api/pos/bill-requests?orderId=${currentBillNode.metadata?.id}`, { method: 'DELETE' }) } catch { }
        markAsSeen(currentBillNode.id)
        removeNotification(currentBillNode.id)
        setViewingId(null)
        refresh()
    }, [currentBillNode, markAsSeen, removeNotification, refresh])

    const pendingOrderCount = orderNotifs.length
    const pendingBillCount  = billNotifs.length

    return (
        <>
            {/* ── 🟢 ORDER_NEW ── top-right green button, urgent pulse ── */}
            {pendingOrderCount > 0 && !currentOrderNode && (
                <button
                    id="order-new-badge"
                    onClick={() => setViewingId(orderNotifs[0].id)}
                    style={{
                        position: 'fixed',
                        top: 14,
                        right: pendingBillCount > 0 ? 188 : 14,
                        zIndex: 1002,
                        background: 'linear-gradient(135deg,#16a34a,#15803d)',
                        color: '#fff', border: 'none', borderRadius: 14,
                        padding: '12px 20px', fontWeight: 800, fontSize: '0.92rem',
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 8,
                        animation: 'orderBadgePulse 1s ease-in-out infinite',
                        transition: 'right 0.3s ease',
                        minWidth: 160,
                        justifyContent: 'center',
                        whiteSpace: 'nowrap',
                    }}
                >
                    🍽️ สั่งอาหาร
                    <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 99, padding: '2px 9px', fontSize: '0.75rem' }}>
                        {pendingOrderCount > 1 ? pendingOrderCount : (orderNotifs[0]?.metadata?.table?.name ? `โต๊ะ ${orderNotifs[0].metadata.table.name}` : 'ใหม่')}
                    </span>
                </button>
            )}

            {/* ── 🔴 BILL_REQUEST ── top-right red button ── */}
            {pendingBillCount > 0 && !currentBillNode && (
                <button
                    id="bill-request-badge"
                    onClick={() => setViewingId(billNotifs[0].id)}
                    style={{
                        position: 'fixed',
                        top: 14,
                        right: 14,
                        zIndex: 1001,
                        background: 'linear-gradient(135deg,#dc2626,#ef4444)',
                        color: '#fff', border: 'none', borderRadius: 14,
                        padding: '12px 20px', fontWeight: 800, fontSize: '0.92rem',
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 8,
                        animation: 'billBadgePulse 1.2s ease-in-out infinite',
                        minWidth: 160,
                        justifyContent: 'center',
                        whiteSpace: 'nowrap',
                    }}
                >
                    🧾 เช็คบิล
                    {pendingBillCount > 1 && (
                        <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 99, padding: '2px 9px', fontSize: '0.75rem' }}>{pendingBillCount}</span>
                    )}
                </button>
            )}

            {/* 🛵 Delivery */}
            {deliveryNotifs.length > 0 && (
                <button
                    onClick={() => router.push('/delivery')}
                    style={{
                        position: 'fixed', bottom: 135, right: 20, zIndex: 1000,
                        background: 'linear-gradient(135deg,#db2777,#be185d)',
                        color: '#fff', border: 'none', borderRadius: 14,
                        padding: '10px 16px', fontWeight: 800, fontSize: '0.85rem',
                        cursor: 'pointer', fontFamily: 'inherit',
                        boxShadow: '0 6px 20px rgba(219,39,119,0.55)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        animation: 'genericPulse 1.5s ease-in-out infinite',
                    }}
                >
                    🛵 Delivery ใหม่{deliveryNotifs.length > 1 && <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 99, padding: '1px 7px', fontSize: '0.72rem' }}>{deliveryNotifs.length}</span>}
                </button>
            )}

            {/* Modals */}
            {currentOrderNode && (
                <PendingOrderModal
                    order={currentOrderNode.metadata}
                    onConfirm={handleConfirmOrder}
                    onClose={() => setViewingId(null)}
                />
            )}
            {currentBillNode && (
                <BillRequestModal
                    bill={currentBillNode.metadata}
                    onAck={handleAckBill}
                    onClose={() => setViewingId(null)}
                    onCancel={handleCancelBill}
                    canCancel={canCancel}
                />
            )}

            <style>{`
                @keyframes orderBadgePulse {
                    0%,100% { box-shadow: 0 6px 24px rgba(22,163,74,0.55), 0 0 0 0 rgba(22,163,74,0.35); transform: scale(1); }
                    50%     { box-shadow: 0 8px 32px rgba(22,163,74,0.85), 0 0 0 8px rgba(22,163,74,0.1); transform: scale(1.04); }
                }
                @keyframes billBadgePulse {
                    0%,100% { box-shadow: 0 6px 24px rgba(220,38,38,0.55), 0 0 0 0 rgba(220,38,38,0.3); }
                    50%     { box-shadow: 0 8px 32px rgba(220,38,38,0.9),  0 0 0 6px rgba(220,38,38,0.1); }
                }
                @keyframes genericPulse {
                    0%,100% { box-shadow: 0 6px 20px rgba(219,39,119,0.5); }
                    50%     { box-shadow: 0 6px 30px rgba(219,39,119,0.85); }
                }
            `}</style>
        </>
    )
}
