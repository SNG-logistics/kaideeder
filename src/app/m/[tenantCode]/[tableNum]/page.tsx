'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

type Product = { id: string; name: string; price: number | null; unit: string | null; categoryId: string | null; imageUrl?: string | null; isFeatured?: boolean }
type Category = { id: string; name: string; color: string | null; icon: string | null }
type Tenant = { name: string; displayName: string | null; logoUrl: string | null; currency: string; hasBanner?: boolean; qrBankingBase64?: string | null }
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

// ── Color System ───────────────────────────────────────────────────────────
const C = {
    bg: '#f5f7f5',
    card: '#ffffff',
    border: 'rgba(0,0,0,0.07)',
    accent: '#2a9d50',
    accentDark: '#1e7a3c',
    accentLight: '#e6f4eb',
    accentMid: 'rgba(42,157,80,0.15)',
    gold: '#f59e0b',
    goldLight: 'rgba(245,158,11,0.12)',
    text: '#1a1a1a',
    subtext: '#374151',
    muted: '#9ca3af',
    danger: '#ef4444',
    shadow: '0 2px 16px rgba(0,0,0,0.08)',
    shadowGreen: '0 8px 28px rgba(42,157,80,0.35)',
}

const FONT = "'Outfit','Noto Sans Thai',system-ui,sans-serif"

function fmtPrice(v: number | null, currency: string) {
    if (v === null || v === undefined) return '—'
    return `${Math.round(v).toLocaleString()} ${currency}`
}

// ── Global Styles ──────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  html,body { margin: 0; padding: 0; background: #e8eceb; height: 100%; }
  ::-webkit-scrollbar { display: none; }
  @keyframes spin    { to { transform: rotate(360deg) } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(22px) } to { opacity:1; transform:translateY(0) } }
  @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
  @keyframes popIn   { 0%{transform:scale(0.72);opacity:0} 60%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
  @keyframes bounce  { 0%,100%{transform:scale(1)} 45%{transform:scale(1.22)} 70%{transform:scale(0.94)} }
  @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
`

// ── Session Expired / Table Not Open Screen ────────────────────────────────
function SessionExpiredScreen({ tableNum, tenantCode, onOpened }: {
    tableNum: number; tenantCode: string; onOpened: () => void
}) {
    const [opening, setOpening] = useState(false)
    const [openError, setOpenError] = useState('')
    const [openDone, setOpenDone] = useState(false)

    async function handleOpen() {
        setOpening(true); setOpenError('')
        try {
            const res = await fetch(`/api/public/open-table/${tenantCode}/${tableNum}`, { method: 'POST' })
            const json = await res.json()
            if (res.ok && json.success) {
                setOpenDone(true)
                setTimeout(() => onOpened(), 1000)
            } else if (res.status === 401 || res.status === 403) {
                setOpenError('กรุณา Login ก่อนเปิดโต๊ะ — เปิดหน้า Dashboard แล้วลองใหม่')
            } else {
                setOpenError(json.error || 'เกิดข้อผิดพลาด')
            }
        } catch { setOpenError('ไม่สามารถเชื่อมต่อได้') }
        finally { setOpening(false) }
    }

    return (
        <div style={{ minHeight: '100dvh', background: '#fdf2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 0, padding: 28, textAlign: 'center', fontFamily: FONT }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{
                width: 96, height: 96, borderRadius: '50%',
                background: openDone ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)' : 'linear-gradient(135deg,#fee2e2,#fecaca)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '3rem', marginBottom: 24,
                boxShadow: openDone ? '0 8px 32px rgba(16,185,129,0.25)' : '0 8px 32px rgba(239,68,68,0.2)',
                animation: 'popIn 0.4s ease', transition: 'all 0.4s ease',
            }}>{openDone ? '✅' : '🔒'}</div>
            <h1 style={{ color: openDone ? '#065f46' : '#7f1d1d', fontWeight: 900, fontSize: '1.35rem', margin: '0 0 12px', lineHeight: 1.3 }}>
                {openDone ? 'เปิดโต๊ะสำเร็จแล้ว!' : 'QR นี้หมดอายุแล้ว'}
            </h1>
            {!openDone && (
                <>
                    <p style={{ color: '#991b1b', fontSize: '0.92rem', lineHeight: 1.75, margin: '0 0 8px', fontWeight: 500 }}>
                        โต๊ะ <b>{tableNum}</b> ยังไม่ได้เปิดบริการ
                    </p>
                    <p style={{ color: '#b91c1c', fontSize: '0.82rem', lineHeight: 1.7, margin: '0 0 24px' }}>
                        ลิงก์นี้ใช้ได้เฉพาะเมื่อนั่งโต๊ะที่ร้านเท่านั้น<br />
                        กรุณาแจ้งพนักงานเพื่อเปิดโต๊ะ
                    </p>

                    {/* Staff open button */}
                    <button
                        onClick={handleOpen}
                        disabled={opening}
                        style={{
                            background: opening ? '#d1d5db' : 'linear-gradient(135deg,#059669,#10b981)',
                            color: '#fff', border: 'none', borderRadius: 16,
                            padding: '14px 32px', fontSize: '1rem', fontWeight: 800,
                            cursor: opening ? 'not-allowed' : 'pointer', fontFamily: FONT,
                            boxShadow: opening ? 'none' : '0 6px 20px rgba(16,185,129,0.4)',
                            marginBottom: 12, width: '100%', maxWidth: 280,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {opening ? '⏳ กำลังเปิด...' : '🔓 เปิดโต๊ะ (พนักงาน)'}
                    </button>

                    {openError && (
                        <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0 0 16px', maxWidth: 280, lineHeight: 1.5 }}>
                            ⚠️ {openError}
                        </p>
                    )}

                    <div style={{
                        background: '#fff', borderRadius: 18, padding: '14px 20px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        border: '1px solid rgba(239,68,68,0.15)',
                        maxWidth: 300, width: '100%',
                    }}>
                        <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: 0, lineHeight: 1.7 }}>
                            🪑 นั่งที่โต๊ะ → กด <b>เปิดโต๊ะ</b> ด้านบน<br />
                            📱 สแกน QR ใหม่อีกครั้ง → สั่งได้เลย
                        </p>
                    </div>
                </>
            )}
            {openDone && (
                <p style={{ color: '#065f46', fontSize: '0.9rem', margin: 0 }}>กำลังโหลดเมนู…</p>
            )}
        </div>
    )
}

export default function MenuPage() {
    const params = useParams<{ tenantCode: string; tableNum: string }>()
    const tenantCode = params.tenantCode
    const tableNum = Number(params.tableNum)

    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [cart, setCart] = useState<CartItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [catDropdownOpen, setCatDropdownOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [cartOpen, setCartOpen] = useState(false)
    const [sessionExpired, setSessionExpired] = useState(false)

    const [submitted, setSubmitted] = useState(false)
    const [submittedRound, setSubmittedRound] = useState(1)
    const [orderNumber, setOrderNumber] = useState('')
    const [isAddon, setIsAddon] = useState(false)

    const [bill, setBill] = useState<BillData | null>(null)
    const [viewBill, setViewBill] = useState(false)
    const [billLoading, setBillLoading] = useState(false)
    const [billRequesting, setBillRequesting] = useState(false)
    const [billDone, setBillDone] = useState(false)

    useEffect(() => {
        const tc = params.tenantCode
        const menuPromise = fetch(`/api/public/menu/${tc}`).then(r => r.json())
        const bannerPromise = fetch(`/api/public/banner/${tc}`, { method: 'HEAD' })
            .then(r => r.status === 200).catch(() => false)
        Promise.all([menuPromise, bannerPromise])
            .then(([d, hasBanner]) => {
                if (d.error) { setError(d.error); return }
                setTenant(d.tenant ? { ...d.tenant, hasBanner } : null)
                setCategories(d.categories)
                setProducts(d.products)
            })
            .catch(() => setError('ไม่สามารถโหลดเมนูได้'))
            .finally(() => setLoading(false))
    }, [params.tenantCode])

    const loadBill = useCallback(async () => {
        setBillLoading(true)
        try {
            const r = await fetch(`/api/public/bill/${params.tenantCode}/${params.tableNum}`)
            const d = await r.json()
            setBill(d)
            if (d.billRequested) setBillDone(true)
        } catch { }
        finally { setBillLoading(false) }
    }, [params.tenantCode, params.tableNum])

    useEffect(() => { loadBill() }, [loadBill])

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
        const matchCat = activeCategory === 'all'
            || (activeCategory === 'featured' && p.isFeatured)
            || p.categoryId === activeCategory
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
                // Session expired = table not open / customer already left
                if (res.status === 403 && json.error === 'SESSION_EXPIRED') {
                    setCartOpen(false)
                    setSessionExpired(true)
                    return
                }
                setError(json.error || 'เกิดข้อผิดพลาด')
                setCartOpen(false)
                return
            }
            setOrderNumber(json.orderNumber)
            setIsAddon(json.isAddon ?? false)
            setCart([])
            setCartOpen(false)
            await loadBill()
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

    // ── Session Expired Screen OR Table Not Open ───────────────────────
    // Show immediately if bill loaded and no open order (not just after failed submit)
    const tableNotOpen = !loading && !billLoading && bill !== null && !hasOpenRound
    if (sessionExpired || tableNotOpen) return (
        <SessionExpiredScreen
            tableNum={tableNum}
            tenantCode={tenantCode}
            onOpened={() => { setSessionExpired(false); loadBill() }}
        />
    )

    // ── Loading ────────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ minHeight: '100dvh', background: '#e8eceb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ width: 44, height: 44, border: `4px solid ${C.accentLight}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: C.muted, fontSize: '0.88rem', margin: 0 }}>กำลังโหลดเมนู…</p>
        </div>
    )

    if (error && !submitted) return (
        <div style={{ minHeight: '100dvh', background: '#e8eceb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, fontFamily: FONT }}>
            <style>{GLOBAL_CSS}</style>
            <span style={{ fontSize: '3rem' }}>😕</span>
            <p style={{ color: C.danger, fontWeight: 600, textAlign: 'center', margin: 0 }}>{error}</p>
            <button onClick={() => setError('')} style={{ background: C.accent, color: '#fff', border: 'none', borderRadius: 14, padding: '11px 28px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, fontSize: '0.95rem' }}>ลองใหม่</button>
        </div>
    )

    // ── Bill View ──────────────────────────────────────────────────────
    if (viewBill) return (
        <div style={{ minHeight: '100dvh', background: '#e8eceb', fontFamily: FONT, display: 'flex', justifyContent: 'center' }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', background: '#f7f8f7' }}>
                <div style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 30, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={() => setViewBill(false)} style={{ background: C.accentLight, border: 'none', borderRadius: 10, padding: '8px 14px', color: C.accent, cursor: 'pointer', fontFamily: FONT, fontSize: '0.83rem', fontWeight: 600 }}>← กลับ</button>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.62rem', color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>โต๊ะ {tableNum}</div>
                            <div style={{ color: C.text, fontWeight: 800, fontSize: '1.05rem' }}>🧾 บิลรวมทั้งหมด</div>
                        </div>
                        {totalRounds > 0 && (
                            <div style={{ background: C.accentLight, border: `1px solid ${C.accentMid}`, borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
                                <div style={{ color: C.accent, fontWeight: 800, fontSize: '1.1rem', lineHeight: 1 }}>{totalRounds}</div>
                                <div style={{ color: C.accent, fontSize: '0.58rem', fontWeight: 600 }}>รอบ</div>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ padding: '16px 16px 160px' }}>
                    {billLoading ? (
                        <div style={{ textAlign: 'center', padding: 60 }}>
                            <div style={{ width: 36, height: 36, border: `3px solid ${C.accentLight}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                            <p style={{ color: C.muted, margin: 0, fontSize: '0.85rem' }}>กำลังโหลด…</p>
                        </div>
                    ) : !bill?.hasOrder ? (
                        <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
                            <div>ยังไม่มีออเดอร์ที่โต๊ะนี้</div>
                        </div>
                    ) : (
                        <>
                            {bill.rounds?.map(round => (
                                <div key={round.orderId} style={{ background: C.card, border: `1px solid ${round.status === 'PENDING_CONFIRM' ? 'rgba(245,158,11,0.3)' : 'rgba(42,157,80,0.2)'}`, borderRadius: 16, overflow: 'hidden', marginBottom: 12, boxShadow: C.shadow }}>
                                    <div style={{ padding: '10px 16px', background: round.status === 'PENDING_CONFIRM' ? 'rgba(245,158,11,0.06)' : 'rgba(42,157,80,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '1rem' }}>{round.status === 'OPEN' ? '✅' : '🕐'}</span>
                                            <div>
                                                <div style={{ color: C.text, fontWeight: 700, fontSize: '0.85rem' }}>รอบที่ {round.round}</div>
                                                <div style={{ color: C.muted, fontSize: '0.65rem', fontFamily: 'monospace' }}>{round.orderNumber}</div>
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '4px 10px', borderRadius: 99, color: round.status === 'OPEN' ? '#fff' : C.gold, background: round.status === 'OPEN' ? C.accent : C.goldLight }}>
                                            {round.status === 'OPEN' ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
                                        </span>
                                    </div>
                                    {round.items.map((item, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1 }}>
                                                <span style={{ color: C.text, fontSize: '0.85rem', fontWeight: 500 }}>{item.name}</span>
                                                {item.note && <div style={{ color: C.muted, fontSize: '0.7rem', marginTop: 2 }}>{item.note}</div>}
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                                                <div style={{ color: C.muted, fontSize: '0.75rem' }}>×{item.quantity}</div>
                                                <div style={{ color: C.accent, fontSize: '0.82rem', fontWeight: 700 }}>{Math.round(item.quantity * item.unitPrice).toLocaleString()}</div>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ padding: '9px 16px', display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.02)' }}>
                                        <span style={{ color: C.muted, fontSize: '0.78rem' }}>รวมรอบนี้</span>
                                        <span style={{ color: C.text, fontWeight: 700, fontSize: '0.85rem' }}>{Math.round(round.subtotal).toLocaleString()} {currency}</span>
                                    </div>
                                </div>
                            ))}
                            <div style={{ background: C.accentLight, border: `1px solid rgba(42,157,80,0.25)`, borderRadius: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div>
                                    <div style={{ color: C.muted, fontSize: '0.75rem' }}>รวมทั้งหมด ({totalRounds} รอบ)</div>
                                    {hasPending && <div style={{ color: C.gold, fontSize: '0.72rem', marginTop: 2, fontWeight: 600 }}>⚠️ รอยืนยัน {bill.rounds?.filter(r => r.status === 'PENDING_CONFIRM').length} รอบ</div>}
                                </div>
                                <span style={{ color: C.accent, fontWeight: 900, fontSize: '1.5rem' }}>{Math.round(bill.grandTotal ?? 0).toLocaleString()} {currency}</span>
                            </div>
                            {/* QR Banking — แสดงเมื่อมีรูป */}
                            {tenant?.qrBankingBase64 && (
                                <div style={{ textAlign: 'center', margin: '0 0 14px', padding: '16px', background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
                                    <div style={{ fontSize: '0.72rem', color: C.muted, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 8 }}>📲 ໂອນເງິນ · โอนเงิน</div>
                                    <img
                                        src={`data:image/jpeg;base64,${tenant.qrBankingBase64}`}
                                        alt="QR Banking"
                                        style={{ width: 180, height: 180, objectFit: 'contain', borderRadius: 10 }}
                                    />
                                </div>
                            )}
                            {hasOpenRound && (
                                billDone || bill.billRequested ? (
                                    <div style={{ background: C.accentLight, border: `1px solid rgba(42,157,80,0.3)`, borderRadius: 16, padding: '18px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: 6 }}>✅</div>
                                        <div style={{ color: C.accent, fontWeight: 700, fontSize: '0.95rem' }}>ส่งคำขอเช็คบิลแล้ว</div>
                                        <div style={{ color: C.muted, fontSize: '0.8rem', marginTop: 4 }}>พนักงานจะมาหาคุณที่โต๊ะเร็วๆ นี้</div>
                                    </div>
                                ) : (
                                    <button onClick={requestBill} disabled={billRequesting} style={{ width: '100%', background: billRequesting ? '#d1d5db' : `linear-gradient(135deg,${C.accent},${C.accentDark})`, color: '#fff', border: 'none', borderRadius: 16, padding: '16px', fontWeight: 800, fontSize: '1rem', cursor: billRequesting ? 'not-allowed' : 'pointer', fontFamily: FONT, boxShadow: billRequesting ? 'none' : C.shadowGreen, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        {billRequesting ? '⏳ กำลังส่ง…' : '🧾 เรียกเช็คบิล'}
                                    </button>
                                )
                            )}
                            {!hasOpenRound && hasPending && (
                                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '12px 16px', textAlign: 'center', fontSize: '0.83rem', color: '#92400e' }}>
                                    🕐 กรุณารอพนักงานยืนยันออเดอร์ก่อน
                                </div>
                            )}
                        </>
                    )}
                </div>
                {hasAnyOrder && (
                    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, padding: '0 16px 24px', zIndex: 40 }}>
                        <button onClick={() => setViewBill(false)} style={{ width: '100%', background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '14px', fontWeight: 700, fontSize: '0.92rem', color: C.text, cursor: 'pointer', fontFamily: FONT, boxShadow: C.shadow }}>
                            ➕ สั่งอาหารเพิ่ม
                        </button>
                    </div>
                )}
            </div>
        </div>
    )

    // ── Success Screen ─────────────────────────────────────────────────
    if (submitted) return (
        <div style={{ minHeight: '100dvh', background: '#e8eceb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 18, padding: 32, textAlign: 'center', fontFamily: FONT }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ width: 88, height: 88, background: C.accentLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.6rem', animation: 'bounce 0.6s ease', boxShadow: C.shadowGreen }}>
                {isAddon ? '➕' : '✅'}
            </div>
            <h1 style={{ color: C.text, fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                {isAddon ? `สั่งเพิ่มรอบที่ ${submittedRound} แล้ว!` : 'สั่งอาหารเรียบร้อยแล้ว!'}
            </h1>
            <p style={{ color: C.muted, margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                {isAddon ? (
                    <>ออเดอร์เพิ่มโต๊ะ <b style={{ color: C.accent }}>{tableNum}</b><br />รอการยืนยันจากพนักงาน</>
                ) : (
                    <>ออเดอร์ของคุณจะถูกยืนยันโดยพนักงาน<br />กรุณารอสักครู่</>
                )}
            </p>
            <div style={{ background: C.card, border: `1.5px solid ${C.accentLight}`, borderRadius: 16, padding: '14px 32px', boxShadow: C.shadow }}>
                <div style={{ color: C.muted, fontSize: '0.7rem', marginBottom: 4, fontWeight: 600, letterSpacing: '0.06em' }}>เลขออเดอร์</div>
                <div style={{ color: C.accent, fontWeight: 900, fontSize: '1.3rem', fontFamily: 'monospace' }}>{orderNumber}</div>
            </div>
            {totalRounds > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: C.shadow, width: '100%', maxWidth: 320 }}>
                    <span style={{ fontSize: '1.3rem' }}>📋</span>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ color: C.accent, fontWeight: 700, fontSize: '0.88rem' }}>สั่งทั้งหมด {totalRounds} รอบ</div>
                        <div style={{ color: C.muted, fontSize: '0.75rem' }}>ยอดรวม {Math.round(bill?.grandTotal ?? 0).toLocaleString()} {currency}</div>
                    </div>
                </div>
            )}
            <p style={{ color: C.muted, fontSize: '0.75rem', margin: 0 }}>โต๊ะ {tableNum}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
                <button onClick={() => { setSubmitted(false); setViewBill(true) }} style={{ width: '100%', background: `linear-gradient(135deg,${C.accent},${C.accentDark})`, color: '#fff', border: 'none', borderRadius: 14, padding: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: FONT, fontSize: '0.92rem', boxShadow: C.shadowGreen }}>
                    🧾 ดูบิลรวม {totalRounds} รอบ
                </button>
                <button onClick={() => setSubmitted(false)} style={{ width: '100%', background: '#fff', color: C.muted, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: FONT, fontSize: '0.88rem' }}>
                    ← สั่งอาหารเพิ่ม
                </button>
            </div>
        </div>
    )

    // ── Main Menu (App Style) ──────────────────────────────────────────
    return (
        <div style={{ minHeight: '100dvh', background: '#e8eceb', fontFamily: FONT, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', background: '#f7f8f7', position: 'relative', overflowX: 'hidden' }}>

                {/* ── STICKY HEADER ─────────────────────────────────── */}
                <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>

                    {/* Banner / Hero */}
                    <div style={{ position: 'relative', overflow: 'hidden' }}>
                        {tenant?.hasBanner ? (
                            <div style={{ position: 'relative' }}>
                                <img src={`/api/public/banner/${tenantCode}`} alt="banner"
                                    style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)' }} />
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', borderRadius: 99, padding: '5px 12px 5px 8px', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(255,255,255,0.25)' }}>
                                        <span style={{ fontSize: '0.8rem' }}>🪑</span>
                                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>โต๊ะ {tableNum}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {hasAnyOrder && (
                                            <button onClick={() => setViewBill(true)} style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 99, padding: '6px 12px', cursor: 'pointer', color: '#fff', fontSize: '0.78rem', fontWeight: 700, fontFamily: FONT }}>
                                                🧾 {totalRounds} รอบ{billDone && ' ✓'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 14px' }}>
                                    <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.2, textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
                                        {tenant?.displayName || tenant?.name || 'เมนูร้าน'}
                                    </div>
                                    {hasAnyOrder && (
                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: 500 }}>
                                            {hasPending ? '🕐 มีออเดอร์รอยืนยัน' : '✅ ออเดอร์ยืนยันแล้ว — สั่งเพิ่มได้เลย'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: '#fff', padding: '14px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ color: C.accent, fontWeight: 900, fontSize: '1.2rem', lineHeight: 1.1 }}>{tenant?.displayName || tenant?.name || 'เมนูร้าน'}</div>
                                        <div style={{ color: C.muted, fontSize: '0.72rem', marginTop: 1 }}>🪑 โต๊ะ {tableNum}</div>
                                    </div>
                                    {hasAnyOrder && (
                                        <button onClick={() => setViewBill(true)} style={{ background: C.accentLight, border: `1.5px solid ${C.accent}`, borderRadius: 12, padding: '7px 14px', cursor: 'pointer', color: C.accent, fontSize: '0.78rem', fontWeight: 700, fontFamily: FONT }}>
                                            🧾 {totalRounds} รอบ{billDone && ' ✓'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Search + Category */}
                    <div style={{ background: '#fff', boxShadow: '0 3px 12px rgba(0,0,0,0.06)' }}>
                        <div style={{ padding: '10px 14px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f3f4f6', borderRadius: 14, padding: '9px 14px', flex: 1 }}>
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาเมนู…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: '0.88rem', fontFamily: FONT }} />
                                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '1rem', padding: 0 }}>✕</button>}
                            </div>
                            {/* Dropdown trigger */}
                            <button onClick={() => setCatDropdownOpen(o => !o)} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: catDropdownOpen ? C.accent : '#f3f4f6',
                                border: 'none', borderRadius: 14, padding: '9px 14px',
                                color: catDropdownOpen ? '#fff' : C.text, fontFamily: FONT,
                                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                                whiteSpace: 'nowrap', transition: 'all 0.15s',
                            }}>
                                <span style={{ fontSize: '1rem' }}>
                                    {activeCategory === 'all' ? '🍽️'
                                        : activeCategory === 'featured' ? '⭐'
                                        : categories.find(c => c.id === activeCategory)?.icon || '🍴'}
                                </span>
                                <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {activeCategory === 'all' ? 'ทั้งหมด'
                                        : activeCategory === 'featured' ? 'เมนูแนะนำ'
                                        : categories.find(c => c.id === activeCategory)?.name || 'หมวด'}
                                </span>
                                <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>{catDropdownOpen ? '▲' : '▼'}</span>
                            </button>
                        </div>

                        {/* Dropdown menu */}
                        {catDropdownOpen && (
                            <div onClick={() => setCatDropdownOpen(false)} style={{
                                position: 'fixed', inset: 0, zIndex: 60,
                            }}>
                                <div onClick={e => e.stopPropagation()} style={{
                                    position: 'absolute', top: 'auto', right: 14, left: 14,
                                    background: '#fff', borderRadius: 18,
                                    boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
                                    overflow: 'hidden', zIndex: 61,
                                    marginTop: 4,
                                    maxHeight: '70dvh', overflowY: 'auto',
                                }}>
                                    {/* Header */}
                                    <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6' }}>
                                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>หมวดหมู่ทั้งหมด</div>
                                        <button onClick={() => setCatDropdownOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: C.muted }}>✕</button>
                                    </div>
                                    {/* เมนูแนะนำ */}
                                    {products.some(p => p.isFeatured) && (
                                        <div onClick={() => { setActiveCategory('featured'); setCatDropdownOpen(false) }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '13px 16px', cursor: 'pointer',
                                                background: activeCategory === 'featured' ? C.goldLight : '#fff',
                                                borderBottom: '1px solid #f9fafb',
                                            }}
                                        >
                                            <span style={{ fontSize: '1.3rem' }}>⭐</span>
                                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: activeCategory === 'featured' ? C.gold : C.text }}>เมนูแนะนำ</span>
                                            {activeCategory === 'featured' && <span style={{ marginLeft: 'auto', color: C.gold, fontSize: '1rem' }}>✓</span>}
                                        </div>
                                    )}
                                    {/* ทั้งหมด */}
                                    <div onClick={() => { setActiveCategory('all'); setCatDropdownOpen(false) }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '13px 16px', cursor: 'pointer',
                                            background: activeCategory === 'all' ? C.accentLight : '#fff',
                                            borderBottom: '1px solid #f9fafb',
                                        }}
                                    >
                                        <span style={{ fontSize: '1.3rem' }}>🍽️</span>
                                        <span style={{ fontWeight: activeCategory === 'all' ? 700 : 500, fontSize: '0.92rem', color: activeCategory === 'all' ? C.accent : C.text }}>ทั้งหมด</span>
                                        {activeCategory === 'all' && <span style={{ marginLeft: 'auto', color: C.accent, fontSize: '1rem' }}>✓</span>}
                                    </div>
                                    {/* หมวดหมู่ */}
                                    {categories.map(c => (
                                        <div key={c.id} onClick={() => { setActiveCategory(c.id); setCatDropdownOpen(false) }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '13px 16px', cursor: 'pointer',
                                                background: activeCategory === c.id ? C.accentLight : '#fff',
                                                borderBottom: '1px solid #f9fafb',
                                            }}
                                        >
                                            <span style={{ fontSize: '1.3rem' }}>{c.icon || '🍴'}</span>
                                            <span style={{ fontWeight: activeCategory === c.id ? 700 : 500, fontSize: '0.92rem', color: activeCategory === c.id ? C.accent : C.text }}>{c.name}</span>
                                            {activeCategory === c.id && <span style={{ marginLeft: 'auto', color: C.accent, fontSize: '1rem' }}>✓</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── PRODUCT GRID ───────────────────────────────────── */}
                <div style={{ padding: '14px 12px 160px' }}>
                    {filtered.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🍽️</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>ไม่พบเมนู</div>
                            <div style={{ fontSize: '0.82rem', marginTop: 4 }}>{search ? `"${search}" ไม่มีในเมนู` : 'ยังไม่มีสินค้าในหมวดนี้'}</div>
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {filtered.map((p, idx) => {
                            const qty = cartQty(p.id)
                            const catIcon = categories.find(c => c.id === p.categoryId)?.icon || '🍽️'
                            return (
                                <div key={p.id} style={{
                                    background: '#fff',
                                    borderRadius: 18,
                                    overflow: 'hidden',
                                    boxShadow: qty > 0 ? `0 6px 22px rgba(42,157,80,0.2)` : '0 2px 10px rgba(0,0,0,0.07)',
                                    border: `2px solid ${qty > 0 ? C.accent : 'transparent'}`,
                                    transition: 'all 0.2s ease',
                                    animation: `fadeUp 0.28s ease ${Math.min(idx, 8) * 0.04}s both`,
                                }}>
                                    {/* Food image */}
                                    <div style={{ position: 'relative', height: 120, background: 'linear-gradient(135deg,#f0faf3,#e0f2e9)', overflow: 'hidden' }}>
                                        {p.imageUrl ? (
                                            <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                                                <span style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.12))' }}>{catIcon}</span>
                                            </div>
                                        )}
                                        {qty > 0 && (
                                            <div style={{ position: 'absolute', top: 8, right: 8, background: C.accent, color: '#fff', borderRadius: 99, minWidth: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.82rem', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', animation: 'popIn 0.25s ease' }}>
                                                {qty}
                                            </div>
                                        )}
                                    </div>
                                    {/* Info */}
                                    <div style={{ padding: '10px 11px 12px' }}>
                                        <div style={{ color: '#111', fontWeight: 700, fontSize: '0.86rem', lineHeight: 1.35, marginBottom: 5, minHeight: 36, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {p.name}
                                        </div>
                                        <div style={{ color: C.accent, fontWeight: 800, fontSize: '0.92rem', marginBottom: 9 }}>
                                            {fmtPrice(p.price, currency)}
                                        </div>
                                        {qty === 0 ? (
                                            <button onClick={() => addToCart(p)} style={{ width: '100%', padding: '8px 0', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${C.accent},${C.accentDark})`, color: '#fff', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, boxShadow: '0 3px 12px rgba(42,157,80,0.3)', minHeight: 36 }}>
                                                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                                เพิ่ม
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.accentLight, borderRadius: 12, padding: '3px', minHeight: 36 }}>
                                                <button onClick={() => removeFromCart(p.id)} style={stepBtn}>−</button>
                                                <span style={{ color: C.accent, fontWeight: 900, fontSize: '1rem', minWidth: 22, textAlign: 'center' }}>{qty}</span>
                                                <button onClick={() => addToCart(p)} style={{ ...stepBtn, background: C.accent, color: '#fff', border: 'none' }}>+</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* ── BOTTOM BAR ────────────────────────────────────── */}
                <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 40, pointerEvents: 'none' }}>
                    <div style={{ padding: '0 12px 20px', display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
                        {hasOpenRound && totalItems === 0 && (
                            billDone || bill?.billRequested ? (
                                <div style={{ background: '#fff', borderRadius: 18, padding: '14px 18px', textAlign: 'center', color: C.accent, fontWeight: 600, fontSize: '0.88rem', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: `1.5px solid rgba(42,157,80,0.2)` }}>
                                    ✅ ส่งคำขอเช็คบิลแล้ว
                                </div>
                            ) : (
                                <button onClick={requestBill} disabled={billRequesting} style={{ width: '100%', background: billRequesting ? '#d1d5db' : `linear-gradient(135deg,${C.accent},${C.accentDark})`, color: '#fff', border: 'none', borderRadius: 18, padding: '16px 20px', fontWeight: 800, fontSize: '0.97rem', cursor: billRequesting ? 'not-allowed' : 'pointer', fontFamily: FONT, boxShadow: billRequesting ? 'none' : C.shadowGreen, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    {billRequesting ? '⏳ กำลังส่ง…' : `🧾 เรียกเช็คบิล (${totalRounds} รอบ · ${Math.round(bill?.grandTotal ?? 0).toLocaleString()} ${currency})`}
                                </button>
                            )
                        )}
                        {totalItems > 0 && !cartOpen && (
                            <button onClick={() => setCartOpen(true)}
                                style={{ width: '100%', background: `linear-gradient(135deg,${C.accent},${C.accentDark})`, color: '#fff', border: 'none', borderRadius: 18, padding: '0 6px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: FONT, boxShadow: '0 8px 28px rgba(42,157,80,0.4)', minHeight: 60, animation: 'popIn 0.22s ease', gap: 8 }}>
                                <div style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 12, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 42, flexShrink: 0 }}>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>{totalItems}</span>
                                    <span style={{ fontSize: '0.58rem', opacity: 0.85, fontWeight: 500, lineHeight: 1 }}>รายการ</span>
                                </div>
                                <span style={{ flex: 1, fontSize: '0.95rem', fontWeight: 700 }}>
                                    {isAddon || hasAnyOrder ? 'ยืนยันสั่งเพิ่ม →' : 'ดูตะกร้า →'}
                                </span>
                                <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: '8px 12px', fontSize: '0.88rem', fontWeight: 800, flexShrink: 0 }}>
                                    {Math.round(totalPrice).toLocaleString()} {currency}
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── CART BOTTOM SHEET ─────────────────────────────── */}
                {cartOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)' }} onClick={() => setCartOpen(false)} />
                        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: '0 20px 40px', maxHeight: '84dvh', overflowY: 'auto', animation: 'slideUp 0.26s ease', boxShadow: '0 -12px 48px rgba(0,0,0,0.18)' }}>
                            <div style={{ width: 36, height: 4, background: '#dde1e0', borderRadius: 2, margin: '14px auto 16px' }} />
                            <h2 style={{ color: C.text, fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px' }}>
                                {hasAnyOrder ? `➕ สั่งเพิ่ม รอบ ${totalRounds + 1}` : '🛒 รายการสั่งอาหาร'} — โต๊ะ {tableNum}
                            </h2>
                            {hasAnyOrder && (
                                <div style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 14 }}>สั่งไปแล้ว {totalRounds} รอบ · ยอดเก่า {Math.round(bill?.grandTotal ?? 0).toLocaleString()} {currency}</div>
                            )}
                            {cart.map(item => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${C.border}` }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: C.text, fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                                        <div style={{ color: C.accent, fontSize: '0.78rem', marginTop: 2 }}>{fmtPrice(item.price, currency)} × {item.quantity}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.accentLight, borderRadius: 12, padding: '2px 4px' }}>
                                        <button onClick={() => removeFromCart(item.id)} style={stepBtn}>−</button>
                                        <span style={{ color: C.accent, fontWeight: 900, width: 22, textAlign: 'center', fontSize: '0.95rem' }}>{item.quantity}</span>
                                        <button onClick={() => addToCart(item)} style={{ ...stepBtn, background: C.accent, color: '#fff', border: 'none' }}>+</button>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && <p style={{ color: C.muted, textAlign: 'center', padding: 32, margin: 0 }}>ยังไม่มีรายการ</p>}
                            {cart.length > 0 && (
                                <>
                                    <div style={{ marginTop: 16, padding: '14px 0', borderTop: `1.5px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: C.subtext, fontWeight: 600 }}>รวมรอบนี้</span>
                                        <span style={{ color: C.accent, fontWeight: 900, fontSize: '1.1rem' }}>{Math.round(totalPrice).toLocaleString()} {currency}</span>
                                    </div>
                                    <button onClick={submitOrder} disabled={submitting} style={{ width: '100%', background: submitting ? '#d1d5db' : `linear-gradient(135deg,${C.accent},${C.accentDark})`, color: '#fff', border: 'none', borderRadius: 18, padding: '16px', fontWeight: 800, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: 10, fontFamily: FONT, boxShadow: submitting ? 'none' : C.shadowGreen }}>
                                        {submitting ? '⏳ กำลังส่ง…' : hasAnyOrder ? `➕ ยืนยันสั่งเพิ่ม (รอบ ${totalRounds + 1})` : '🍽️ ยืนยันสั่งอาหาร'}
                                    </button>
                                    <button onClick={() => setCartOpen(false)} style={{ width: '100%', background: 'transparent', color: C.muted, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: '12px', fontWeight: 500, fontSize: '0.88rem', cursor: 'pointer', marginTop: 8, fontFamily: FONT }}>← ดูเมนูต่อ</button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// Category tab — circular icon + label
const catTabStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '4px 10px', cursor: 'pointer', background: 'none', border: 'none',
    fontFamily: FONT, minWidth: 58, flexShrink: 0, transition: 'transform 0.15s',
})
const catCircleStyle = (active: boolean): React.CSSProperties => ({
    width: 48, height: 48, borderRadius: '50%',
    background: active ? C.accent : '#f3f4f6',
    border: active ? `2px solid ${C.accentDark}` : '2px solid transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.4rem',
    boxShadow: active ? `0 4px 14px rgba(42,157,80,0.35)` : 'none',
    transition: 'all 0.18s ease',
})
const catLabelStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '0.68rem', fontWeight: active ? 700 : 500,
    color: active ? C.accent : C.muted, whiteSpace: 'nowrap', fontFamily: FONT,
})

const stepBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 10,
    border: `1px solid rgba(42,157,80,0.2)`,
    background: '#fff', color: C.accent,
    fontWeight: 800, fontSize: '1.1rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: FONT,
}
