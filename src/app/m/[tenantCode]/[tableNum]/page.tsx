'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

type Product = { id: string; name: string; price: number | null; unit: string | null; categoryId: string | null; imageUrl?: string | null }
type Category = { id: string; name: string; color: string | null; icon: string | null }
type Tenant = { name: string; displayName: string | null; logoUrl: string | null; currency: string }
type CartItem = Product & { quantity: number; note: string }
type BillItem = { name: string; quantity: number; unitPrice: number; note: string | null; kitchenStatus: string }
type BillData = {
    hasOrder: boolean; status?: string; orderNumber?: string; orderId?: string
    tableNumber?: number; currency: string; storeName?: string
    billRequested?: boolean; items?: BillItem[]; subtotal?: number
}

const C = { bg: '#0a0f1a', card: '#111827', border: 'rgba(255,255,255,0.06)', accent: '#f59e0b', text: '#f1f5f9', muted: '#64748b' }

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
    const [orderNumber, setOrderNumber] = useState('')
    const [isAddon, setIsAddon] = useState(false)

    // Bill view state
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

    // Load bill data on mount (to know if table already has an order)
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

    const hasOpenOrder = bill?.hasOrder && bill.status === 'OPEN'

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
            if (!res.ok) {
                // Show inline error, not alert
                setError(json.error || 'เกิดข้อผิดพลาด')
                setCartOpen(false)
                return
            }
            setOrderNumber(json.orderNumber)
            setIsAddon(json.isAddon ?? false)
            setSubmitted(true)
            setCart([])
            setCartOpen(false)
            // Refresh bill
            await loadBill()
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

    const currency = tenant?.currency || 'LAK'

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

    // ── Bill Request Success overlay ─────────────────────────────────
    if (viewBill && bill) return (
        <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Noto Sans Thai','Inter',system-ui,sans-serif", maxWidth: 480, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#1e3a6e,#0a1628)', padding: '16px 20px 14px', position: 'sticky', top: 0, zIndex: 30 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setViewBill(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: '6px 12px', color: C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem' }}>← กลับ</button>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#60a5fa', fontWeight: 600, letterSpacing: '0.1em' }}>โต๊ะ {tableNum}</div>
                        <div style={{ color: C.text, fontWeight: 800, fontSize: '1rem' }}>🧾 บิลของฉัน</div>
                    </div>
                </div>
            </div>

            <div style={{ padding: '20px 16px 120px' }}>
                {billLoading ? (
                    <p style={{ color: C.muted, textAlign: 'center', padding: 40 }}>กำลังโหลด…</p>
                ) : !bill.hasOrder ? (
                    <div style={{ textAlign: 'center', padding: 48, color: C.muted }}>ยังไม่มีออเดอร์ที่เปิดอยู่</div>
                ) : (
                    <>
                        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 16 }}>
                            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: C.muted }}>
                                <span>เลขออเดอร์: <span style={{ color: C.accent, fontFamily: 'monospace', fontWeight: 700 }}>{bill.orderNumber}</span></span>
                                <span style={{ background: bill.status === 'OPEN' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: bill.status === 'OPEN' ? '#4ade80' : C.accent, borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                                    {bill.status === 'OPEN' ? '✅ เปิดอยู่' : '🕐 รอยืนยัน'}
                                </span>
                            </div>
                            {bill.items?.map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid rgba(255,255,255,0.03)`, alignItems: 'center' }}>
                                    <div>
                                        <div style={{ color: C.text, fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</div>
                                        {item.note && <div style={{ color: C.muted, fontSize: '0.7rem' }}>หมายเหตุ: {item.note}</div>}
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                                        <div style={{ color: C.text, fontSize: '0.82rem' }}>×{item.quantity}</div>
                                        <div style={{ color: C.accent, fontSize: '0.78rem', fontWeight: 700 }}>{Math.round(item.quantity * item.unitPrice).toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: C.muted, fontWeight: 600 }}>รวมทั้งหมด</span>
                                <span style={{ color: C.accent, fontWeight: 800, fontSize: '1.15rem' }}>{Math.round(bill.subtotal ?? 0).toLocaleString()} {currency}</span>
                            </div>
                        </div>

                        {/* Request Bill button */}
                        {bill.status === 'OPEN' && (
                            billDone || bill.billRequested ? (
                                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, padding: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>✅</div>
                                    <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.9rem' }}>ส่งคำขอเช็คบิลแล้ว</div>
                                    <div style={{ color: C.muted, fontSize: '0.78rem', marginTop: 4 }}>พนักงานจะมาหาคุณที่โต๊ะเร็วๆ นี้</div>
                                </div>
                            ) : (
                                <button onClick={requestBill} disabled={billRequesting} style={{ width: '100%', background: billRequesting ? '#374151' : 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontWeight: 800, fontSize: '1rem', cursor: billRequesting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 20px rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    {billRequesting ? '⏳ กำลังส่ง…' : '🧾 เรียกเช็คบิล'}
                                </button>
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    )

    // ── Order Success screen ─────────────────────────────────────────
    if (submitted) return (
        <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center', fontFamily: "'Noto Sans Thai','Inter',system-ui,sans-serif" }}>
            <div style={{ fontSize: '4rem', animation: 'bounce 0.6s ease' }}>{isAddon ? '➕' : '✅'}</div>
            <h1 style={{ color: C.text, fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
                {isAddon ? 'สั่งอาหารเพิ่มเรียบร้อย!' : 'สั่งอาหารเรียบร้อยแล้ว!'}
            </h1>
            <p style={{ color: C.muted, margin: 0, fontSize: '0.88rem', lineHeight: 1.7 }}>
                {isAddon ? (
                    <>ออเดอร์เพิ่มโต๊ะ <b style={{ color: C.accent }}>{tableNum}</b> รอการยืนยันจากพนักงาน</>
                ) : (
                    <>ออเดอร์ของคุณจะถูกยืนยันโดยพนักงาน<br />กรุณารอสักครู่</>
                )}
            </p>
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '14px 24px' }}>
                <div style={{ color: C.muted, fontSize: '0.72rem', marginBottom: 4 }}>เลขออเดอร์</div>
                <div style={{ color: C.accent, fontWeight: 800, fontSize: '1.2rem', fontFamily: 'monospace' }}>{orderNumber}</div>
            </div>
            <p style={{ color: '#374151', fontSize: '0.75rem' }}>โต๊ะ {tableNum}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
                <button onClick={() => { setSubmitted(false); setViewBill(true) }} style={{ width: '100%', background: 'rgba(245,158,11,0.15)', color: C.accent, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' }}>
                    🧾 ดูบิลของฉัน
                </button>
                <button onClick={() => setSubmitted(false)} style={{ width: '100%', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 12, padding: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                    ← สั่งอาหารเพิ่ม
                </button>
            </div>
            <style>{`@keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}`}</style>
        </div>
    )

    // ── Main menu ────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Noto Sans Thai','Inter',system-ui,sans-serif", maxWidth: 480, margin: '0 auto', position: 'relative' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#1e3a6e,#0a1628)', padding: '16px 20px 14px', position: 'sticky', top: 0, zIndex: 30, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#60a5fa', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            โต๊ะ {tableNum} {hasOpenOrder && <span style={{ color: C.accent }}>· กำลังเปิดออเดอร์</span>}
                        </div>
                        <h1 style={{ color: C.text, fontWeight: 800, fontSize: '1.05rem', margin: 0, lineHeight: 1.2 }}>
                            {tenant?.displayName || tenant?.name}
                        </h1>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {/* Bill button */}
                        {hasOpenOrder && (
                            <button onClick={() => setViewBill(true)} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', color: '#4ade80', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                                🧾 บิล{billDone && ' ✓'}
                            </button>
                        )}
                        {/* Cart button */}
                        <button onClick={() => setCartOpen(true)} style={{ position: 'relative', background: totalItems > 0 ? C.accent : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={totalItems > 0 ? '#fff' : C.muted} strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                            {totalItems > 0 && <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>{totalItems}</span>}
                        </button>
                    </div>
                </div>

                {/* Add-on banner */}
                {hasOpenOrder && (
                    <div style={{ marginTop: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', color: C.accent }}>
                        ➕ สั่งอาหารเพิ่มได้เลย — พนักงานจะนำมาให้ที่โต๊ะ
                    </div>
                )}

                {/* Search */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '7px 12px' }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาเมนู…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: '0.85rem', fontFamily: 'inherit' }} />
                </div>

                {/* Category tabs */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10, paddingBottom: 2, scrollbarWidth: 'none' }}>
                    <button onClick={() => setActiveCategory('all')} style={tabStyle(activeCategory === 'all')}>ทั้งหมด</button>
                    {categories.map(c => (
                        <button key={c.id} onClick={() => setActiveCategory(c.id)} style={tabStyle(activeCategory === c.id)}>
                            {c.icon && <span style={{ marginRight: 3 }}>{c.icon}</span>}{c.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div style={{ padding: '14px 14px 140px' }}>
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
                                <div style={{ padding: '10px 12px' }}>
                                    <div style={{ color: C.text, fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
                                    <div style={{ color: C.accent, fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>{fmtPrice(p.price, currency)}</div>
                                    {qty === 0 ? (
                                        <button onClick={() => addToCart(p)} style={{ width: '100%', padding: '7px', borderRadius: 9, border: 'none', background: 'rgba(245,158,11,0.15)', color: C.accent, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>+ เพิ่ม</button>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <button onClick={() => removeFromCart(p.id)} style={stepBtn}>−</button>
                                            <span style={{ color: C.text, fontWeight: 700, fontSize: '0.9rem' }}>{qty}</span>
                                            <button onClick={() => addToCart(p)} style={{ ...stepBtn, background: C.accent, color: '#fff' }}>+</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Floating bottom bar: bill request OR cart */}
            <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '0 16px 16px', zIndex: 40, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* เรียกเช็คบิล — only when open order and no items in cart */}
                {hasOpenOrder && totalItems === 0 && (
                    billDone || bill?.billRequested ? (
                        <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, padding: '12px', textAlign: 'center', color: '#4ade80', fontWeight: 700, fontSize: '0.85rem' }}>
                            ✅ ส่งคำขอเช็คบิลแล้ว — พนักงานจะมาหาคุณเร็วๆ นี้
                        </div>
                    ) : (
                        <button onClick={requestBill} disabled={billRequesting} style={{ width: '100%', background: billRequesting ? '#374151' : 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 20px', fontWeight: 800, fontSize: '1rem', cursor: billRequesting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            {billRequesting ? '⏳ กำลังส่ง…' : '🧾 เรียกเช็คบิล'}
                        </button>
                    )
                )}
                {/* Cart bar */}
                {totalItems > 0 && !cartOpen && (
                    <button onClick={() => setCartOpen(true)} style={{ width: '100%', background: C.accent, color: '#fff', border: 'none', borderRadius: 14, padding: '14px 20px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(245,158,11,0.4)' }}>
                        <span style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '2px 10px', fontSize: '0.82rem' }}>{totalItems} รายการ</span>
                        <span>ดูตะกร้า →</span>
                        <span>{Math.round(totalPrice).toLocaleString()} {currency}</span>
                    </button>
                )}
            </div>

            {/* Cart Drawer */}
            {cartOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={() => setCartOpen(false)} />
                    <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '6px 20px 32px', maxHeight: '80dvh', overflowY: 'auto' }}>
                        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '8px auto 16px' }} />
                        <h2 style={{ color: C.text, fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>
                            {hasOpenOrder ? '➕ สั่งเพิ่ม' : '🛒 รายการสั่งอาหาร'} — โต๊ะ {tableNum}
                        </h2>
                        {cart.length === 0 ? (
                            <p style={{ color: C.muted, textAlign: 'center', padding: 24 }}>ยังไม่มีรายการ</p>
                        ) : (
                            <>
                                {cart.map(item => (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: C.text, fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</div>
                                            <div style={{ color: C.accent, fontSize: '0.78rem' }}>{fmtPrice(item.price, currency)} × {item.quantity}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <button onClick={() => removeFromCart(item.id)} style={stepBtn}>−</button>
                                            <span style={{ color: C.text, fontWeight: 700, width: 20, textAlign: 'center' }}>{item.quantity}</span>
                                            <button onClick={() => addToCart(item)} style={{ ...stepBtn, background: C.accent, color: '#fff' }}>+</button>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ marginTop: 16, padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: C.muted }}>รวมทั้งหมด</span>
                                    <span style={{ color: C.accent, fontWeight: 800, fontSize: '1.1rem' }}>{Math.round(totalPrice).toLocaleString()} {currency}</span>
                                </div>
                                <button onClick={submitOrder} disabled={submitting} style={{ width: '100%', background: submitting ? '#374151' : C.accent, color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontWeight: 800, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: 12, fontFamily: 'inherit', boxShadow: submitting ? 'none' : '0 6px 20px rgba(245,158,11,0.35)' }}>
                                    {submitting ? '⏳ กำลังส่ง…' : hasOpenOrder ? '➕ ยืนยันสั่งเพิ่ม' : '🍽️ ยืนยันสั่งอาหาร'}
                                </button>
                                <button onClick={() => setCartOpen(false)} style={{ width: '100%', background: 'transparent', color: C.muted, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '11px', fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }}>
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
    width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.07)', color: '#f1f5f9', fontWeight: 700, fontSize: '1rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
}
