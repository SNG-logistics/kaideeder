'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

type Product = { id: string; name: string; price: number | null; unit: string | null; categoryId: string | null; imageUrl?: string | null }
type Category = { id: string; name: string; color: string | null; icon: string | null }
type Tenant = { name: string; displayName: string | null; logoUrl: string | null; currency: string }
type CartItem = Product & { quantity: number; note: string }

type BillRound = {
    round: number; orderId: string; orderNumber: string
    status: 'OPEN' | 'PENDING_CONFIRM'; openedAt: string
    items: { name: string; quantity: number; unitPrice: number; note: string | null }[]
    subtotal: number
}
type BillData = {
    hasOrder: boolean; currency: string; tableNumber?: number; storeName?: string
    totalRounds?: number; hasOpenRound?: boolean; hasPending?: boolean
    billRequested?: boolean; rounds?: BillRound[]; grandTotal?: number
}

const C = { bg: '#080d18', card: '#0e1628', border: 'rgba(255,255,255,0.07)', accent: '#f59e0b', text: '#f1f5f9', muted: '#64748b', green: '#10b981' }

function fmtPrice(v: number | null, currency: string) {
    if (v === null || v === undefined) return '—'
    return `${Math.round(v).toLocaleString()} ${currency}`
}

export default function MenuPage() {
    const params = useParams<{ tenantCode: string; tableNum: string }>()
    const tableNum = Number(params.tableNum)

    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [cart, setCart] = useState<CartItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [cartOpen, setCartOpen] = useState(false)

    // Post-submit state
    const [submitted, setSubmitted] = useState(false)
    const [submittedRound, setSubmittedRound] = useState(1)
    const [orderNumber, setOrderNumber] = useState('')
    const [isAddon, setIsAddon] = useState(false)

    // Bill state
    const [bill, setBill] = useState<BillData | null>(null)
    const [viewBill, setViewBill] = useState(false)
    const [billLoading, setBillLoading] = useState(false)
    const [billRequesting, setBillRequesting] = useState(false)
    const [billDone, setBillDone] = useState(false)

    // Load menu
    useEffect(() => {
        fetch(`/api/public/menu/${params.tenantCode}`)
            .then(r => r.json())
            .then(d => {
                if (d.error) { setError(d.error); return }
                setTenant(d.tenant)
                setCategories(d.categories)
                setProducts(d.products)
            })
            .catch(() => setError('ไม่สามารถโหลดเมนูได้'))
            .finally(() => setLoading(false))
    }, [params.tenantCode])

    // Load unified table bill
    const loadBill = useCallback(async () => {
        setBillLoading(true)
        try {
            const r = await fetch(`/api/public/bill/${params.tenantCode}/${params.tableNum}`)
            const d = await r.json()
            setBill(d)
            if (d.billRequested) setBillDone(true)
        } catch {}
        finally { setBillLoading(false) }
    }, [params.tenantCode, params.tableNum])

    useEffect(() => { loadBill() }, [loadBill])

    // Derived
    const hasAnyOrder = bill?.hasOrder ?? false
    const totalRounds = bill?.totalRounds ?? 0
    const hasOpenRound = bill?.hasOpenRound ?? false
    const hasPending = bill?.hasPending ?? false

    const addToCart = useCallback((p: Product) => {
        setCart(prev => {
            const ex = prev.find(i => i.id === p.id)
            if (ex) return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
            return [...prev, { ...p, quantity: 1, note: '' }]
        })
    }, [])

    const removeFromCart = useCallback((id: string) => {
        setCart(prev => {
            const item = prev.find(i => i.id === id)
            if (!item) return prev
            if (item.quantity <= 1) return prev.filter(i => i.id !== id)
            return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i)
        })
    }, [])

    const cartQty = (id: string) => cart.find(i => i.id === id)?.quantity ?? 0
    const totalItems = cart.reduce((s, i) => s + i.quantity, 0)
    const totalPrice = cart.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0)
    const filtered = products.filter(p => {
        const matchCat = activeCategory === 'all' || p.categoryId === activeCategory
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
        return matchCat && matchSearch
    })

    async function submitOrder() {
        if (cart.length === 0) return
        setSubmitting(true)
        try {
            const res = await fetch('/api/public/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantCode: params.tenantCode,
                    tableNumber: tableNum,
                    items: cart.map(i => ({
                        productId: i.id, name: i.name, quantity: i.quantity,
                        unitPrice: i.price ?? 0, note: i.note || undefined,
                    })),
                }),
            })
            const json = await res.json()
            if (!res.ok) { setError(json.error || 'เกิดข้อผิดพลาด'); setCartOpen(false); return }
            setOrderNumber(json.orderNumber)
            setIsAddon(json.isAddon ?? false)
            setCart([])
            setCartOpen(false)
            await loadBill()
            // Round number = current rounds + 1 (before reload) but after load it's updated
            setSubmittedRound((bill?.totalRounds ?? 0) + 1)
            setSubmitted(true)
        } catch { setError('เกิดข้อผิดพลาดในการส่งออเดอร์') }
        finally { setSubmitting(false) }
    }

    async function requestBill() {
        setBillRequesting(true)
        try {
            const res = await fetch(`/api/public/bill/${params.tenantCode}/${params.tableNum}`, { method: 'POST' })
            const json = await res.json()
            if (res.ok) { setBillDone(true); await loadBill() }
            else setError(json.error || 'ไม่สามารถส่งคำขอได้')
        } catch { setError('เกิดข้อผิดพลาด') }
        finally { setBillRequesting(false) }
    }

    const currency = bill?.currency || tenant?.currency || 'LAK'

    // ── Loading ──────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: C.muted, fontSize: '0.85rem' }}>กำลังโหลดเมนู…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    if (error && !submitted) return (
        <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
            <span style={{ fontSize: '3rem' }}>😕</span>
            <p style={{ color: '#f87171', fontWeight: 600, textAlign: 'center' }}>{error}</p>
            <button onClick={() => setError('')} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ลองใหม่
            </button>
        </div>
    )

    // ── Unified Bill View ─────────────────────────────────────────────
    if (viewBill) return (
        <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Noto Sans Thai','Inter',system-ui,sans-serif", maxWidth: 480, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#1e3a6e,#0a1628)', padding: '16px 20px 14px', position: 'sticky', top: 0, zIndex: 30, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setViewBill(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: '7px 14px', color: C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem' }}>← กลับ</button>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.62rem', color: '#60a5fa', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>โต๊ะ {tableNum}</div>
                        <div style={{ color: C.text, fontWeight: 800, fontSize: '1rem' }}>🧾 บิลรวมทั้งหมด</div>
                    </div>
                    {totalRounds > 0 && (
                        <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '5px 12px', textAlign: 'center' }}>
                            <div style={{ color: C.accent, fontWeight: 800, fontSize: '1.1rem', lineHeight: 1 }}>{totalRounds}</div>
                            <div style={{ color: '#92400e', fontSize: '0.58rem', fontWeight: 700 }}>รอบ</div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ padding: '16px 16px 140px' }}>
                {billLoading ? (
                    <p style={{ color: C.muted, textAlign: 'center', padding: 40 }}>กำลังโหลด…</p>
                ) : !bill?.hasOrder ? (
                    <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
                        <div>ยังไม่มีออเดอร์ที่โต๊ะนี้</div>
                    </div>
                ) : (
                    <>
                        {/* Per-round breakdown */}
                        {bill.rounds?.map(round => (
                            <div key={round.orderId} style={{ background: C.card, border: `1px solid ${round.status === 'PENDING_CONFIRM' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.15)'}`, borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
                                {/* Round header */}
                                <div style={{ padding: '10px 16px', background: round.status === 'PENDING_CONFIRM' ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '1rem' }}>{round.status === 'OPEN' ? '✅' : '🕐'}</span>
                                        <div>
                                            <div style={{ color: C.text, fontWeight: 700, fontSize: '0.82rem' }}>รอบที่ {round.round}</div>
                                            <div style={{ color: C.muted, fontSize: '0.65rem', fontFamily: 'monospace' }}>{round.orderNumber}</div>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.65rem', fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                                        color: round.status === 'OPEN' ? '#4ade80' : C.accent,
                                        background: round.status === 'OPEN' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                                        border: `1px solid ${round.status === 'OPEN' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                    }}>
                                        {round.status === 'OPEN' ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
                                    </span>
                                </div>

                                {/* Items */}
                                {round.items.map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid rgba(255,255,255,0.03)`, alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ color: C.text, fontSize: '0.82rem', fontWeight: 500 }}>{item.name}</span>
                                            {item.note && <div style={{ color: C.muted, fontSize: '0.68rem' }}>{item.note}</div>}
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                                            <div style={{ color: C.muted, fontSize: '0.75rem' }}>×{item.quantity}</div>
                                            <div style={{ color: C.accent, fontSize: '0.78rem', fontWeight: 600 }}>{Math.round(item.quantity * item.unitPrice).toLocaleString()}</div>
                                        </div>
                                    </div>
                                ))}

                                {/* Round subtotal */}
                                <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                                    <span style={{ color: C.muted, fontSize: '0.75rem' }}>รวมรอบนี้</span>
                                    <span style={{ color: C.text, fontWeight: 700, fontSize: '0.82rem' }}>{Math.round(round.subtotal).toLocaleString()} {currency}</span>
                                </div>
                            </div>
                        ))}

                        {/* Grand total */}
                        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <div style={{ color: C.muted, fontSize: '0.72rem' }}>รวมทั้งหมด ({totalRounds} รอบ)</div>
                                <div style={{ color: C.text, fontSize: '0.75rem', marginTop: 2 }}>
                                    {hasPending && <span style={{ color: C.accent }}>⚠️ รอยืนยัน {bill.rounds?.filter(r => r.status === 'PENDING_CONFIRM').length} รอบ</span>}
                                </div>
                            </div>
                            <span style={{ color: C.accent, fontWeight: 900, fontSize: '1.4rem' }}>
                                {Math.round(bill.grandTotal ?? 0).toLocaleString()} {currency}
                            </span>
                        </div>

                        {/* Bill request */}
                        {hasOpenRound && (
                            billDone || bill.billRequested ? (
                                <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 14, padding: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>✅</div>
                                    <div style={{ color: '#4ade80', fontWeight: 700 }}>ส่งคำขอเช็คบิลแล้ว</div>
                                    <div style={{ color: C.muted, fontSize: '0.78rem', marginTop: 4 }}>พนักงานจะมาหาคุณที่โต๊ะเร็วๆ นี้</div>
                                </div>
                            ) : (
                                <button onClick={requestBill} disabled={billRequesting} style={{ width: '100%', background: billRequesting ? '#374151' : 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontWeight: 800, fontSize: '1.05rem', cursor: billRequesting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 24px rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    {billRequesting ? '⏳ กำลังส่ง…' : '🧾 เรียกเช็คบิล'}
                                </button>
                            )
                        )}

                        {!hasOpenRound && hasPending && (
                            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '12px 16px', textAlign: 'center', fontSize: '0.82rem', color: C.accent }}>
                                🕐 กรุณารอพนักงานยืนยันออเดอร์ก่อนจึงจะเรียกเช็คบิลได้
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Floating: order more */}
            {hasAnyOrder && (
                <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '0 16px 20px', zIndex: 40 }}>
                    <button onClick={() => setViewBill(false)} style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: 14, padding: '13px', fontWeight: 600, fontSize: '0.9rem', color: C.text, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ➕ สั่งอาหารเพิ่ม
                    </button>
                </div>
            )}
        </div>
    )

    // ── Order Success screen ──────────────────────────────────────────
    if (submitted) return (
        <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center', fontFamily: "'Noto Sans Thai','Inter',system-ui,sans-serif" }}>
            <div style={{ fontSize: '4rem', animation: 'bounce 0.6s ease' }}>{isAddon ? '➕' : '✅'}</div>
            <h1 style={{ color: C.text, fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
                {isAddon ? `สั่งเพิ่มรอบที่ ${submittedRound} แล้ว!` : 'สั่งอาหารเรียบร้อยแล้ว!'}
            </h1>
            <p style={{ color: C.muted, margin: 0, fontSize: '0.88rem', lineHeight: 1.7 }}>
                {isAddon ? (
                    <>ออเดอร์เพิ่มโต๊ะ <b style={{ color: C.accent }}>{tableNum}</b><br />รอการยืนยันจากพนักงาน</>
                ) : (
                    <>ออเดอร์ของคุณจะถูกยืนยันโดยพนักงาน<br />กรุณารอสักครู่</>
                )}
            </p>

            {/* Order number */}
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '12px 28px' }}>
                <div style={{ color: C.muted, fontSize: '0.68rem', marginBottom: 3 }}>เลขออเดอร์</div>
                <div style={{ color: C.accent, fontWeight: 800, fontSize: '1.2rem', fontFamily: 'monospace' }}>{orderNumber}</div>
            </div>

            {/* Total rounds badge */}
            {totalRounds > 0 && (
                <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.2rem' }}>📋</span>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ color: '#818cf8', fontWeight: 700, fontSize: '0.85rem' }}>สั่งทั้งหมด {totalRounds} รอบ</div>
                        <div style={{ color: C.muted, fontSize: '0.72rem' }}>ยอดรวม {Math.round(bill?.grandTotal ?? 0).toLocaleString()} {currency}</div>
                    </div>
                </div>
            )}

            <p style={{ color: '#334155', fontSize: '0.72rem' }}>โต๊ะ {tableNum}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
                <button onClick={() => { setSubmitted(false); setViewBill(true) }} style={{ width: '100%', background: 'rgba(245,158,11,0.15)', color: C.accent, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>
                    🧾 ดูบิลรวม {totalRounds} รอบ
                </button>
                <button onClick={() => setSubmitted(false)} style={{ width: '100%', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 12, padding: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                    ← สั่งอาหารเพิ่ม
                </button>
            </div>
            <style>{`@keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}`}</style>
        </div>
    )

    // ── Main menu ─────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Noto Sans Thai','Inter',system-ui,sans-serif", maxWidth: 480, margin: '0 auto', position: 'relative' }}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#1e3a6e,#0a1628)', padding: '16px 20px 12px', position: 'sticky', top: 0, zIndex: 30, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.63rem', color: '#60a5fa', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                            โต๊ะ {tableNum}
                            {hasAnyOrder && <span style={{ background: 'rgba(245,158,11,0.15)', color: C.accent, borderRadius: 99, padding: '1px 7px', fontSize: '0.6rem', fontWeight: 800 }}>{totalRounds} รอบ</span>}
                        </div>
                        <h1 style={{ color: C.text, fontWeight: 800, fontSize: '1rem', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tenant?.displayName || tenant?.name}
                        </h1>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {/* Bill button */}
                        {hasAnyOrder && (
                            <button onClick={() => { setViewBill(true) }} style={{ background: billDone ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)', border: `1px solid ${billDone ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 10, padding: '7px 11px', cursor: 'pointer', color: billDone ? '#4ade80' : C.accent, fontSize: '0.75rem', fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                🧾 {totalRounds} รอบ{billDone && ' ✓'}
                            </button>
                        )}
                        {/* Cart */}
                        <button onClick={() => setCartOpen(true)} style={{ position: 'relative', background: totalItems > 0 ? C.accent : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={totalItems > 0 ? '#fff' : C.muted} strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                            {totalItems > 0 && <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>{totalItems}</span>}
                        </button>
                    </div>
                </div>

                {/* Table status banner */}
                {hasAnyOrder && (
                    <div style={{ marginTop: 8, background: hasPending ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${hasPending ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius: 8, padding: '6px 12px', fontSize: '0.73rem', color: hasPending ? C.accent : '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {hasPending ? '🕐 มีออเดอร์รอยืนยัน' : '✅ ออเดอร์ยืนยันแล้ว'}
                        <span style={{ color: C.muted }}>— สั่งเพิ่มได้เลย ➕</span>
                    </div>
                )}

                {/* Search */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '7px 12px' }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาเมนู…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: '0.85rem', fontFamily: 'inherit' }} />
                </div>

                {/* Category tabs */}
                <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginTop: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
                    <button onClick={() => setActiveCategory('all')} style={tabStyle(activeCategory === 'all')}>ทั้งหมด</button>
                    {categories.map(c => (
                        <button key={c.id} onClick={() => setActiveCategory(c.id)} style={tabStyle(activeCategory === c.id)}>
                            {c.icon && <span style={{ marginRight: 3 }}>{c.icon}</span>}{c.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div style={{ padding: '14px 14px 160px' }}>
                {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 48, color: C.muted }}>ไม่พบเมนู</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {filtered.map(p => {
                        const qty = cartQty(p.id)
                        return (
                            <div key={p.id} style={{ background: C.card, border: `1px solid ${qty > 0 ? 'rgba(245,158,11,0.4)' : C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                                <div style={{ height: 100, background: 'linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.07))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', overflow: 'hidden', position: 'relative' }}>
                                    {p.imageUrl ? (
                                        <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                                    ) : (
                                        categories.find(c => c.id === p.categoryId)?.icon || '🍽️'
                                    )}
                                </div>
                                <div style={{ padding: '9px 12px' }}>
                                    <div style={{ color: C.text, fontWeight: 600, fontSize: '0.80rem', lineHeight: 1.3, marginBottom: 3 }}>{p.name}</div>
                                    <div style={{ color: C.accent, fontWeight: 700, fontSize: '0.88rem', marginBottom: 7 }}>{fmtPrice(p.price, currency)}</div>
                                    {qty === 0 ? (
                                        <button onClick={() => addToCart(p)} style={{ width: '100%', padding: '7px', borderRadius: 9, border: 'none', background: 'rgba(245,158,11,0.15)', color: C.accent, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>+ เพิ่ม</button>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <button onClick={() => removeFromCart(p.id)} style={stepBtn}>−</button>
                                            <span style={{ color: C.text, fontWeight: 700, fontSize: '0.9rem' }}>{qty}</span>
                                            <button onClick={() => addToCart(p)} style={{ ...stepBtn, background: C.accent, color: '#fff', border: 'none' }}>+</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Floating bottom bar */}
            <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '0 16px 16px', zIndex: 40, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* เรียกเช็คบิล — when has open order and no item in cart */}
                {hasOpenRound && totalItems === 0 && (
                    billDone || bill?.billRequested ? (
                        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 14, padding: '11px', textAlign: 'center', color: '#4ade80', fontWeight: 600, fontSize: '0.82rem' }}>
                            ✅ ส่งคำขอเช็คบิลแล้ว — พนักงานกำลังมา
                        </div>
                    ) : (
                        <button onClick={requestBill} disabled={billRequesting} style={{ width: '100%', background: billRequesting ? '#374151' : 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', border: 'none', borderRadius: 14, padding: '13px 20px', fontWeight: 800, fontSize: '0.95rem', cursor: billRequesting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            {billRequesting ? '⏳ กำลังส่ง…' : `🧾 เรียกเช็คบิล (${totalRounds} รอบ · ${Math.round(bill?.grandTotal ?? 0).toLocaleString()} ${currency})`}
                        </button>
                    )
                )}
                {/* Cart bar */}
                {totalItems > 0 && !cartOpen && (
                    <button onClick={() => setCartOpen(true)} style={{ width: '100%', background: C.accent, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 20px', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(245,158,11,0.4)' }}>
                        <span style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '2px 10px', fontSize: '0.8rem' }}>{totalItems} รายการ</span>
                        <span>{isAddon || hasAnyOrder ? 'ยืนยันสั่งเพิ่ม →' : 'ดูตะกร้า →'}</span>
                        <span>{Math.round(totalPrice).toLocaleString()} {currency}</span>
                    </button>
                )}
            </div>

            {/* Cart Drawer */}
            {cartOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={() => setCartOpen(false)} />
                    <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '6px 20px 32px', maxHeight: '80dvh', overflowY: 'auto' }}>
                        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '8px auto 16px' }} />
                        <h2 style={{ color: C.text, fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>
                            {hasAnyOrder ? `➕ สั่งเพิ่ม รอบ ${totalRounds + 1}` : '🛒 รายการสั่งอาหาร'} — โต๊ะ {tableNum}
                        </h2>
                        {hasAnyOrder && (
                            <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: 12 }}>สั่งไปแล้ว {totalRounds} รอบ · ยอดเก่า {Math.round(bill?.grandTotal ?? 0).toLocaleString()} {currency}</div>
                        )}
                        {cart.map(item => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: C.text, fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</div>
                                    <div style={{ color: C.accent, fontSize: '0.78rem' }}>{fmtPrice(item.price, currency)} × {item.quantity}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <button onClick={() => removeFromCart(item.id)} style={stepBtn}>−</button>
                                    <span style={{ color: C.text, fontWeight: 700, width: 20, textAlign: 'center' }}>{item.quantity}</span>
                                    <button onClick={() => addToCart(item)} style={{ ...stepBtn, background: C.accent, color: '#fff', border: 'none' }}>+</button>
                                </div>
                            </div>
                        ))}
                        {cart.length === 0 && <p style={{ color: C.muted, textAlign: 'center', padding: 24 }}>ยังไม่มีรายการ</p>}
                        {cart.length > 0 && (
                            <>
                                <div style={{ marginTop: 14, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: C.muted }}>รวมรอบนี้</span>
                                    <span style={{ color: C.accent, fontWeight: 800, fontSize: '1.05rem' }}>{Math.round(totalPrice).toLocaleString()} {currency}</span>
                                </div>
                                <button onClick={submitOrder} disabled={submitting} style={{ width: '100%', background: submitting ? '#374151' : C.accent, color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontWeight: 800, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: 10, fontFamily: 'inherit', boxShadow: submitting ? 'none' : '0 6px 20px rgba(245,158,11,0.35)' }}>
                                    {submitting ? '⏳ กำลังส่ง…' : hasAnyOrder ? `➕ ยืนยันสั่งเพิ่ม (รอบ ${totalRounds + 1})` : '🍽️ ยืนยันสั่งอาหาร'}
                                </button>
                                <button onClick={() => setCartOpen(false)} style={{ width: '100%', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 12, padding: '11px', fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }}>
                                    ← ดูเมนูต่อ
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

const tabStyle = (active: boolean): React.CSSProperties => ({
    flexShrink: 0, padding: '5px 13px', borderRadius: 20, border: 'none', cursor: 'pointer',
    background: active ? C.accent : 'rgba(255,255,255,0.07)',
    color: active ? '#fff' : C.muted, fontWeight: active ? 700 : 500,
    fontSize: '0.75rem', fontFamily: 'inherit', whiteSpace: 'nowrap',
})

const stepBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.07)', color: '#f1f5f9', fontWeight: 700, fontSize: '1rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
}
