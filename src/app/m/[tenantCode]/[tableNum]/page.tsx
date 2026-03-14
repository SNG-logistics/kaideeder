'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Product = { id: string; name: string; nameEn: string | null; price: number | null; unit: string | null; categoryId: string | null; imageUrl?: string | null }
type Category = { id: string; name: string; nameEn: string | null; color: string | null; icon: string | null }
type Tenant = { name: string; displayName: string | null; logoUrl: string | null; currency: string }
type CartItem = Product & { quantity: number; note: string }

const C = {
    bg: '#0a0f1a',
    card: '#111827',
    border: 'rgba(255,255,255,0.06)',
    accent: '#f59e0b',
    text: '#f1f5f9',
    muted: '#64748b',
}

function fmtPrice(v: number | null, currency: string) {
    if (v === null || v === undefined) return '—'
    return `${Math.round(v).toLocaleString()} ${currency}`
}

export default function MenuPage() {
    const params = useParams<{ tenantCode: string; tableNum: string }>()
    const router = useRouter()

    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [cart, setCart] = useState<CartItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [orderNumber, setOrderNumber] = useState('')
    const [cartOpen, setCartOpen] = useState(false)

    const tableNum = Number(params.tableNum)

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

    const addToCart = useCallback((p: Product) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === p.id)
            if (existing) return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
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
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.nameEn || '').toLowerCase().includes(search.toLowerCase())
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
                        productId: i.id,
                        name: i.name,
                        quantity: i.quantity,
                        unitPrice: i.price ?? 0,
                        note: i.note || undefined,
                    })),
                }),
            })
            const json = await res.json()
            if (!res.ok) { alert(json.error || 'เกิดข้อผิดพลาด'); return }
            setOrderNumber(json.orderNumber)
            setSubmitted(true)
            setCart([])
        } catch { alert('เกิดข้อผิดพลาดในการส่งออเดอร์') }
        finally { setSubmitting(false) }
    }

    // ── Loading ────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: C.muted, fontSize: '0.85rem' }}>กำลังโหลดเมนู…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    if (error) return (
        <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24 }}>
            <span style={{ fontSize: '3rem' }}>😕</span>
            <p style={{ color: '#f87171', fontWeight: 600 }}>{error}</p>
        </div>
    )

    // ── Order Success ──────────────────────────────────────────────
    if (submitted) return (
        <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', animation: 'bounce 0.6s ease' }}>✅</div>
            <h1 style={{ color: C.text, fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>สั่งอาหารเรียบร้อยแล้ว!</h1>
            <p style={{ color: C.muted, margin: 0, fontSize: '0.88rem', lineHeight: 1.6 }}>
                ออเดอร์ของคุณจะถูกยืนยันโดยพนักงาน<br />กรุณารอสักครู่
            </p>
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '14px 24px', marginTop: 8 }}>
                <div style={{ color: C.muted, fontSize: '0.72rem', marginBottom: 4 }}>เลขออเดอร์</div>
                <div style={{ color: C.accent, fontWeight: 800, fontSize: '1.2rem', fontFamily: 'monospace' }}>{orderNumber}</div>
            </div>
            <p style={{ color: '#374151', fontSize: '0.75rem', marginTop: 4 }}>โต๊ะ {tableNum}</p>
            <style>{`@keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}`}</style>
        </div>
    )

    const currency = tenant?.currency || 'LAK'

    return (
        <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: "'Noto Sans Thai', 'Inter', system-ui, sans-serif", maxWidth: 480, margin: '0 auto', position: 'relative' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,#1e3a6e,#0a1628)', padding: '16px 20px 14px', position: 'sticky', top: 0, zIndex: 30, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#60a5fa', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>โต๊ะ {tableNum}</div>
                        <h1 style={{ color: C.text, fontWeight: 800, fontSize: '1.05rem', margin: 0, lineHeight: 1.2 }}>
                            {tenant?.displayName || tenant?.name}
                        </h1>
                    </div>
                    {/* Cart button */}
                    <button onClick={() => setCartOpen(true)} style={{
                        position: 'relative', background: totalItems > 0 ? C.accent : 'rgba(255,255,255,0.08)',
                        border: 'none', borderRadius: 12, padding: '8px 14px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                    }}>
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={totalItems > 0 ? '#fff' : C.muted} strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                        {totalItems > 0 && (
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>{totalItems}</span>
                        )}
                    </button>
                </div>

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
            <div style={{ padding: '14px 14px 120px' }}>
                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 48, color: C.muted }}>ไม่พบเมนู</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {filtered.map(p => {
                        const qty = cartQty(p.id)
                        return (
                            <div key={p.id} style={{ background: C.card, border: `1px solid ${qty > 0 ? 'rgba(245,158,11,0.4)' : C.border}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                                {/* Image placeholder */}
                                <div style={{ height: 100, background: 'linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.07))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                                    {categories.find(c => c.id === p.categoryId)?.icon || '🍽️'}
                                </div>
                                <div style={{ padding: '10px 12px' }}>
                                    <div style={{ color: C.text, fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
                                    {p.nameEn && <div style={{ color: C.muted, fontSize: '0.68rem', marginBottom: 6 }}>{p.nameEn}</div>}
                                    <div style={{ color: C.accent, fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>
                                        {fmtPrice(p.price, currency)}
                                    </div>
                                    {/* Qty stepper */}
                                    {qty === 0 ? (
                                        <button onClick={() => addToCart(p)} style={{ width: '100%', padding: '7px', borderRadius: 9, border: 'none', background: 'rgba(245,158,11,0.15)', color: C.accent, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            + เพิ่ม
                                        </button>
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

            {/* Floating cart bottom bar */}
            {totalItems > 0 && !cartOpen && (
                <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: 16, zIndex: 40 }}>
                    <button onClick={() => setCartOpen(true)} style={{ width: '100%', background: C.accent, color: '#fff', border: 'none', borderRadius: 14, padding: '14px 20px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(245,158,11,0.4)' }}>
                        <span style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '2px 10px', fontSize: '0.82rem' }}>{totalItems} รายการ</span>
                        <span>ดูตะกร้า →</span>
                        <span>{Math.round(totalPrice).toLocaleString()} {currency}</span>
                    </button>
                </div>
            )}

            {/* Cart Drawer */}
            {cartOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={() => setCartOpen(false)} />
                    <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#111827', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '6px 20px 32px', maxHeight: '80dvh', overflowY: 'auto' }}>
                        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '8px auto 16px' }} />
                        <h2 style={{ color: C.text, fontSize: '1rem', fontWeight: 700, marginBottom: 14 }}>🛒 รายการสั่งอาหาร — โต๊ะ {tableNum}</h2>

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
                                    {submitting ? '⏳ กำลังส่ง…' : '🍽️ ยืนยันสั่งอาหาร'}
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
    fontSize: '0.75rem', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap',
})

const stepBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.07)', color: C.text, fontWeight: 700, fontSize: '1rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
}

const C: Record<string, string> = {
    bg: '#0a0f1a', card: '#111827', border: 'rgba(255,255,255,0.06)',
    accent: '#f59e0b', text: '#f1f5f9', muted: '#64748b',
}
