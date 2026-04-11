'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────
type Step = 1 | 2 | 3
type Topping = { id: string; name: string; price: number; isActive?: boolean }
type Product = { toppingsJson?: string | null;  id: string; name: string; price: number | null; unit: string | null; categoryId: string | null; imageUrl?: string | null; isFeatured?: boolean }
type Category = { id: string; name: string; color: string | null; icon: string | null }
type Tenant = { name: string; displayName: string | null; logoUrl: string | null; currency: string; qrBankingBase64?: string | null }
type CartItem = Product & { cartId: string; quantity: number; note: string; toppingsJson?: string | null; toppingsTotal?: number }

// ── Design System ─────────────────────────────────────────────
const C = {
    bg: '#140507',
    surface: '#1c070a',
    surfaceGrad: 'linear-gradient(145deg, #2a0b12, #180508)',
    border: 'rgba(255,255,255,0.08)',
    accent: '#E11D48',
    accentLight: 'rgba(225,29,72,0.15)',
    accentGlow: '0 0 24px rgba(225,29,72,0.45)',
    accentGrad: 'linear-gradient(135deg, #E11D48, #9F1239)',
    green: '#10B981',
    greenLight: 'rgba(16,185,129,0.12)',
    text: '#FFF1F2',
    sub: '#FECDD3',
    muted: '#881337',
    danger: '#F87171',
    shadow: '0 8px 28px rgba(225,29,72,0.15)',
}
const FONT = "'Outfit','Noto Sans Thai',system-ui,sans-serif"
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  html,body { margin: 0; padding: 0; background: #0f172a; }
  ::-webkit-scrollbar { display: none; }
  @keyframes spin    { to { transform: rotate(360deg) } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
  @keyframes popIn   { 0%{transform:scale(0.75);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
  @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
`

function fmt(v: number | null, currency: string) {
    if (v === null || v === undefined) return '—'
    return `${Math.round(v).toLocaleString()} ${currency}`
}

// ── Step Indicator ───────────────────────────────────────────
function StepDots({ current }: { current: Step }) {
    const steps = [
        { n: 1, label: 'ข้อมูล' },
        { n: 2, label: 'เมนู' },
        { n: 3, label: 'ยืนยัน' },
    ]
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '12px 0 8px' }}>
            {steps.map((s, i) => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: current >= s.n ? C.accentGrad : 'rgba(255,255,255,0.06)',
                            border: `2px solid ${current >= s.n ? C.accent : 'rgba(255,255,255,0.1)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.8rem', fontWeight: 800,
                            color: current >= s.n ? '#fff' : C.muted,
                            transition: 'all 0.25s',
                            boxShadow: current === s.n ? C.accentGlow : 'none',
                        }}>
                            {current > s.n ? '✓' : s.n}
                        </div>
                        <span style={{ fontSize: '0.6rem', color: current >= s.n ? '#FDA4AF' : C.muted, fontWeight: 600 }}>{s.label}</span>
                    </div>
                    {i < steps.length - 1 && (
                        <div style={{ width: 40, height: 2, background: current > s.n ? C.accent : 'rgba(255,255,255,0.08)', margin: '0 4px', marginBottom: 20, transition: 'background 0.3s', borderRadius: 1 }} />
                    )}
                </div>
            ))}
        </div>
    )
}

// ── Input Component ───────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                {label} {required && <span style={{ color: C.danger }}>*</span>}
            </label>
            {children}
        </div>
    )
}

const inputCss: React.CSSProperties = {
    width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 12,
    color: C.text, fontSize: '0.9rem', fontFamily: FONT, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s',
}

// ─────────────────────────────────────────────────────────────
export default function DeliveryOrderPage() {
    const { tenantCode } = useParams<{ tenantCode: string }>()
    const router = useRouter()

    // ── Data ──────────────────────────────────────────────────
    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // ── Step ─────────────────────────────────────────────────
    const [step, setStep] = useState<Step>(1)

    // ── Step 1 — Customer Info ────────────────────────────────
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const [note, setNote] = useState('')
    const [step1Err, setStep1Err] = useState('')

    // ── Step 2 — Menu ─────────────────────────────────────────
    const [cart, setCart] = useState<CartItem[]>([])
    const [activeCategory, setActiveCategory] = useState('all')
    const [search, setSearch] = useState('')
    const [cartOpen, setCartOpen] = useState(false)

    // ── Step 3 — Confirm ─────────────────────────────────────
    const [submitting, setSubmitting] = useState(false)
    const [submitErr, setSubmitErr] = useState('')
    const [paymentSlipBase64, setPaymentSlipBase64] = useState<string | null>(null)

    // ── Delivery fee (fixed — fetched from tenant settings in future) ──
    // For now: free (staff can adjust from queue)
    const DELIVERY_FEE = 0

    const currency = tenant?.currency || 'LAK'
    const subtotal = cart.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0)
    const totalAmount = subtotal + DELIVERY_FEE
    const totalItems = cart.reduce((s, i) => s + i.quantity, 0)

    // ── Fetch menu ────────────────────────────────────────────
    useEffect(() => {
        fetch(`/api/public/menu/${tenantCode}`)
            .then(r => r.json())
            .then(d => {
                if (d.error) { setError(d.error); return }
                setTenant(d.tenant)
                setCategories(d.categories)
                setProducts(d.products)
            })
            .catch(() => setError('ไม่สามารถโหลดเมนูได้'))
            .finally(() => setLoading(false))
    }, [tenantCode])

    // ── Cart helpers ──────────────────────────────────────────
    const addToCart = useCallback((p: Product) => {
        setCart(prev => {
            const ex = prev.find(i => i.id === p.id)
            if (ex) return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
            return [...prev, { ...p, cartId: Math.random().toString(36).substr(2, 9), quantity: 1, note: '' }]
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

    const filtered = products.filter(p => {
        const matchCat = activeCategory === 'all' || (activeCategory === 'featured' && p.isFeatured) || p.categoryId === activeCategory
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
        return matchCat && matchSearch
    })

    // ── Step 1 → 2 ───────────────────────────────────────────
    function goToMenu() {
        setStep1Err('')
        if (!name.trim()) { setStep1Err('กรุณาระบุชื่อ'); return }
        if (!phone.trim()) { setStep1Err('กรุณาระบุเบอร์โทร'); return }
        if (!address.trim()) { setStep1Err('กรุณาระบุที่อยู่จัดส่ง'); return }
        setStep(2)
    }

    // ── Slip Upload ───────────────────────────────────────────
    const handleSlipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                const MAX = 800;
                if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
                else if (height > MAX) { width *= MAX / height; height = MAX; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                setPaymentSlipBase64(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    // ── Submit order ──────────────────────────────────────────
    async function submitOrder() {
        setSubmitErr('')
        if (cart.length === 0) { setSubmitErr('กรุณาเลือกอาหารอย่างน้อย 1 รายการ'); return }
        if (totalAmount > 0 && !paymentSlipBase64) { setSubmitErr('กรุณาแนบสลิปโอนเงิน (หากสั่งเกิน 0 บาท) เพื่อยืนยันการสั่งซื้อ'); return }
        setSubmitting(true)
        try {
            const res = await fetch('/api/public/delivery/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantCode,
                    customerName: name.trim(),
                    customerPhone: phone.trim(),
                    addressText: address.trim(),
                    items: cart.map(i => ({ productId: i.id, quantity: i.quantity, unitPrice: i.price ?? 0 })),
                    deliveryFee: DELIVERY_FEE,
                    customerNote: note.trim() || undefined,
                    paymentSlipBase64,
                }),
            })
            const j = await res.json()
            if (j.success) {
                router.push(`/d/${tenantCode}/track/${j.orderId}`)
            } else {
                setSubmitErr(j.error || 'เกิดข้อผิดพลาด')
            }
        } catch { setSubmitErr('ไม่สามารถเชื่อมต่อได้') }
        finally { setSubmitting(false) }
    }

    // ── Loading / Error ───────────────────────────────────────
    if (loading) return (
        <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ width: 44, height: 44, border: `4px solid ${C.accentLight}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: C.sub, margin: 0 }}>กำลังโหลดเมนู…</p>
        </div>
    )

    if (error) return (
        <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 28, textAlign: 'center', fontFamily: FONT }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ fontSize: '3.5rem' }}>😕</div>
            <p style={{ color: C.danger, fontWeight: 600, margin: 0 }}>{error}</p>
        </div>
    )

    return (
        <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: FONT, display: 'flex', justifyContent: 'center' }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative' }}>

                {/* ── Header ── */}
                <div style={{ background: 'linear-gradient(135deg, #4c0519, #881337)', padding: '16px 20px 8px', position: 'sticky', top: 0, zIndex: 30 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {tenant?.logoUrl && <img src={tenant.logoUrl} alt="logo" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />}
                        <div>
                            <div style={{ color: C.text, fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2 }}>{tenant?.displayName || tenant?.name}</div>
                            <div style={{ color: '#FDA4AF', fontSize: '0.72rem', fontWeight: 600 }}>🛵 สั่ง Delivery</div>
                        </div>
                    </div>
                    <StepDots current={step} />
                </div>

                {/* ══════════════ STEP 1 — ข้อมูลลูกค้า ═══════════════ */}
                {step === 1 && (
                    <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 0, animation: 'fadeUp 0.3s ease' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.text, marginBottom: 4 }}>📋 กรอกข้อมูลการจัดส่ง</div>
                        <div style={{ fontSize: '0.8rem', color: C.sub, marginBottom: 20 }}>ข้อมูลนี้ใช้สำหรับนำส่งอาหารถึงคุณ</div>

                        <Field label="ชื่อผู้รับ" required>
                            <input id="delivery-name" style={inputCss} placeholder="ชื่อ-นามสกุล..." value={name} onChange={e => setName(e.target.value)} />
                        </Field>

                        <Field label="เบอร์โทรศัพท์" required>
                            <input id="delivery-phone" style={inputCss} placeholder="+856 20..." type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                        </Field>

                        <Field label="ที่อยู่จัดส่ง" required>
                            <textarea id="delivery-address" style={{ ...inputCss, height: 80, resize: 'vertical' }}
                                placeholder="บ้านเลขที่ ซอย ถนน หมู่บ้าน..." value={address}
                                onChange={e => setAddress(e.target.value)} />
                        </Field>

                        <Field label="หมายเหตุเพิ่มเติม">
                            <input id="delivery-note" style={inputCss} placeholder="เช่น บอกทางไรเดอร์..." value={note}
                                onChange={e => setNote(e.target.value)} />
                        </Field>

                        {step1Err && (
                            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 14px', color: C.danger, fontSize: '0.83rem', fontWeight: 600, marginBottom: 12 }}>
                                ⚠️ {step1Err}
                            </div>
                        )}

                        <button id="btn-go-to-menu" onClick={goToMenu} style={{ marginTop: 'auto', width: '100%', padding: '14px', background: C.accentGrad, color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', fontSize: '0.97rem', fontWeight: 800, fontFamily: FONT, boxShadow: '0 6px 20px rgba(225,29,72,0.45)' }}>
                            เลือกเมนูอาหาร →
                        </button>
                    </div>
                )}

                {/* ══════════════ STEP 2 — เมนู ══════════════════════ */}
                {step === 2 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

                        {/* Search + Category bar */}
                        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '10px 14px', display: 'flex', gap: 8 }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาเมนู…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: '0.87rem', fontFamily: FONT }} />
                                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '1rem', padding: 0, lineHeight: 1 }}>✕</button>}
                            </div>
                            {/* Back to step 1 */}
                            <button onClick={() => setStep(1)} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '8px 12px', cursor: 'pointer', color: C.sub, fontSize: '0.82rem', fontFamily: FONT, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                ← แก้ที่อยู่
                            </button>
                        </div>

                        {/* Category pills */}
                        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 14px 8px', background: C.surface }}>
                            {[{ id: 'all', name: 'ทั้งหมด', icon: '🍽️' }, ...categories.map(c => ({ id: c.id, name: c.name, icon: c.icon || '🍴' }))].map(cat => (
                                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: '0.78rem', fontWeight: activeCategory === cat.id ? 700 : 500, whiteSpace: 'nowrap', background: activeCategory === cat.id ? C.accentGrad : 'rgba(255,255,255,0.06)', color: activeCategory === cat.id ? '#fff' : C.sub, transition: 'all 0.15s', boxShadow: activeCategory === cat.id ? '0 2px 10px rgba(225,29,72,0.4)' : 'none' }}>
                                    <span>{cat.icon}</span> {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Products */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 160px' }}>
                            {filtered.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '50px 20px', color: C.muted }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 10 }}>🍽️</div>
                                    <div>ไม่พบเมนูที่ค้นหา</div>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                {filtered.map((p, idx) => {
                                    const qty = cartQty(p.id)
                                    const catIcon = categories.find(c => c.id === p.categoryId)?.icon || '🍽️'
                                    return (
                                        <div key={p.id} style={{ background: C.surfaceGrad, borderRadius: 16, overflow: 'hidden', border: `1.5px solid ${qty > 0 ? C.accent : C.border}`, boxShadow: qty > 0 ? C.accentGlow : 'none', animation: `fadeUp 0.25s ease ${Math.min(idx, 8) * 0.04}s both`, transition: 'border-color 0.15s' }}>
                                            <div style={{ height: 110, background: 'linear-gradient(135deg, rgba(225,29,72,0.15), rgba(159,18,57,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                                {p.imageUrl ? (
                                                    <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                                ) : (
                                                    <div style={{ fontSize: '3rem', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.3))' }}>{catIcon}</div>
                                                )}
                                                {qty > 0 && (
                                                    <div style={{ position: 'absolute', top: 6, right: 6, background: C.accent, color: '#fff', borderRadius: 99, minWidth: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.78rem', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', animation: 'popIn 0.2s ease' }}>
                                                        {qty}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ padding: '9px 10px 10px' }}>
                                                <div style={{ color: C.text, fontWeight: 700, fontSize: '0.83rem', lineHeight: 1.35, marginBottom: 4, minHeight: 34, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                                                <div style={{ color: '#FDA4AF', fontWeight: 800, fontSize: '0.88rem', marginBottom: 8 }}>{fmt(p.price, currency)}</div>
                                                {qty === 0 ? (
                                                    <button onClick={() => addToCart(p)} style={{ width: '100%', padding: '7px 0', borderRadius: 10, border: 'none', background: C.accentGrad, color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 3px 10px rgba(225,29,72,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 34 }}>
                                                        <span>+</span> เพิ่ม
                                                    </button>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.accentLight, borderRadius: 10, padding: '2px 3px', minHeight: 34 }}>
                                                        <button onClick={() => removeFromCart(p.id)} style={stepBtn}>−</button>
                                                        <span style={{ color: '#FDA4AF', fontWeight: 900, fontSize: '0.95rem', minWidth: 20, textAlign: 'center' }}>{qty}</span>
                                                        <button onClick={() => addToCart(p)} style={{ ...stepBtn, background: C.accent, color: '#fff', border: 'none' }}>+</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Cart bar */}
                        {totalItems > 0 && !cartOpen && (
                            <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 398, zIndex: 40 }}>
                                <button id="btn-view-cart" onClick={() => setCartOpen(true)} style={{ width: '100%', background: C.accentGrad, color: '#fff', border: 'none', borderRadius: 16, padding: '0 6px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: FONT, boxShadow: '0 8px 28px rgba(225,29,72,0.5)', minHeight: 58, animation: 'popIn 0.2s ease' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 42, flexShrink: 0 }}>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 900 }}>{totalItems}</span>
                                        <span style={{ fontSize: '0.58rem', opacity: 0.85 }}>รายการ</span>
                                    </div>
                                    <span style={{ flex: 1, fontSize: '0.92rem' }}>ดูตะกร้าและยืนยัน</span>
                                    <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '8px 12px', fontSize: '0.88rem', fontWeight: 800, flexShrink: 0 }}>
                                        {fmt(subtotal, currency)}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Cart bottom sheet */}
                        {cartOpen && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }} onClick={() => setCartOpen(false)} />
                                <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '0 20px 40px', maxHeight: '80dvh', overflowY: 'auto', animation: 'slideUp 0.24s ease', boxShadow: '0 -16px 48px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                    <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '14px auto 16px' }} />
                                    <h2 style={{ color: C.text, fontSize: '1rem', fontWeight: 800, margin: '0 0 16px' }}>🛒 รายการที่เลือก</h2>
                                    {cart.map(item => (
                                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ color: C.text, fontWeight: 600, fontSize: '0.87rem' }}>{item.name}</div>
                                                <div style={{ color: '#FDA4AF', fontSize: '0.76rem', marginTop: 2 }}>{fmt(item.price, currency)} × {item.quantity}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.accentLight, borderRadius: 10, padding: '2px 3px' }}>
                                                <button onClick={() => removeFromCart(item.id)} style={stepBtn}>−</button>
                                                <span style={{ color: '#FDA4AF', fontWeight: 900, width: 20, textAlign: 'center', fontSize: '0.9rem' }}>{item.quantity}</span>
                                                <button onClick={() => addToCart(item)} style={{ ...stepBtn, background: C.accent, color: '#fff', border: 'none' }}>+</button>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: `1.5px solid ${C.border}` }}>
                                        <span style={{ color: C.sub, fontWeight: 600 }}>รวมอาหาร</span>
                                        <span style={{ color: '#FDA4AF', fontWeight: 900, fontSize: '1.05rem' }}>{fmt(subtotal, currency)}</span>
                                    </div>
                                    {DELIVERY_FEE > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                                            <span style={{ color: C.muted, fontSize: '0.85rem' }}>🛵 ค่าส่ง</span>
                                            <span style={{ color: C.sub, fontSize: '0.9rem', fontWeight: 600 }}>{fmt(DELIVERY_FEE, currency)}</span>
                                        </div>
                                    )}
                                    <button id="btn-confirm-order" onClick={() => { setCartOpen(false); setStep(3) }} style={{ width: '100%', background: C.accentGrad, color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontWeight: 800, fontSize: '0.97rem', cursor: 'pointer', marginTop: 10, fontFamily: FONT, boxShadow: '0 6px 20px rgba(225,29,72,0.45)' }}>
                                        ยืนยันรายการ →
                                    </button>
                                    <button onClick={() => setCartOpen(false)} style={{ width: '100%', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 13, padding: '12px', fontWeight: 500, fontSize: '0.87rem', cursor: 'pointer', marginTop: 8, fontFamily: FONT }}>
                                        ← เลือกเพิ่ม
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════ STEP 3 — ยืนยัน ════════════════════ */}
                {step === 3 && (
                    <div style={{ flex: 1, padding: '20px', animation: 'fadeUp 0.3s ease' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.text, marginBottom: 4 }}>📋 ยืนยันออเดอร์</div>
                        <div style={{ fontSize: '0.8rem', color: C.sub, marginBottom: 20 }}>ตรวจสอบรายละเอียดก่อนสั่ง</div>

                        {/* Customer info recap */}
                        <div style={{ background: C.surface, borderRadius: 14, padding: '14px 16px', border: `1px solid ${C.border}`, marginBottom: 14 }}>
                            <div style={{ fontSize: '0.72rem', color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>👤 ข้อมูลผู้รับ</div>
                            <div style={{ color: C.text, fontWeight: 700, fontSize: '0.9rem' }}>{name}</div>
                            <div style={{ color: C.sub, fontSize: '0.83rem', marginTop: 2 }}>{phone}</div>
                            <div style={{ color: C.sub, fontSize: '0.83rem', marginTop: 6, lineHeight: 1.5 }}>📍 {address}</div>
                            {note && <div style={{ color: C.muted, fontSize: '0.78rem', marginTop: 4, fontStyle: 'italic' }}>💬 {note}</div>}
                        </div>

                        {/* Items recap */}
                        <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 14 }}>
                            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: '0.72rem', color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🍽️ รายการอาหาร</div>
                            </div>
                            {cart.map((item, i) => (
                                <div key={item.id} style={{ padding: '9px 14px', display: 'flex', justifyContent: 'space-between', borderBottom: i < cart.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                    <span style={{ color: C.text, fontSize: '0.85rem' }}>{item.name} × {item.quantity}</span>
                                    <span style={{ color: '#FDA4AF', fontWeight: 600, fontSize: '0.85rem' }}>{fmt((item.price ?? 0) * item.quantity, currency)}</span>
                                </div>
                            ))}
                            {DELIVERY_FEE > 0 && (
                                <div style={{ padding: '9px 14px', display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}` }}>
                                    <span style={{ color: C.muted, fontSize: '0.83rem' }}>🛵 ค่าส่ง</span>
                                    <span style={{ color: C.sub, fontSize: '0.83rem', fontWeight: 600 }}>{fmt(DELIVERY_FEE, currency)}</span>
                                </div>
                            )}
                            <div style={{ padding: '12px 14px', background: C.accentLight, display: 'flex', justifyContent: 'space-between', borderTop: `1px solid rgba(124,58,237,0.2)` }}>
                                <span style={{ color: '#C4B5FD', fontWeight: 700 }}>รวมทั้งหมด</span>
                                <span style={{ color: '#FDA4AF', fontWeight: 900, fontSize: '1.05rem' }}>{fmt(totalAmount, currency)}</span>
                            </div>
                        </div>

                        {/* Payment Verification / Contact */}
                        {totalAmount > 0 && (
                            <div style={{ background: C.surface, borderRadius: 14, padding: '16px', border: `1px solid ${C.accent}`, marginBottom: 16 }}>
                                <div style={{ fontSize: '0.85rem', color: C.text, fontWeight: 700, marginBottom: 8 }}>💳 ชำระเงิน / Payment</div>
                                {tenant?.qrBankingBase64 ? (
                                    <div style={{ textAlign: 'center', marginBottom: 12 }}>
                                        <img src={tenant.qrBankingBase64} alt="QR Code" style={{ width: '100%', maxWidth: 220, borderRadius: 8 }} />
                                    </div>
                                ) : (
                                    <div style={{ color: C.sub, fontSize: '0.8rem', marginBottom: 12 }}>
                                        💳 โอนเงินผ่านหมายเลขบัญชีของร้านค้า หรือติดต่อเพจของร้านค้า
                                    </div>
                                )}
                                <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 12 }}>
                                    <div style={{ fontSize: '0.8rem', color: '#FDA4AF', fontWeight: 600, marginBottom: 8 }}>อัปโหลดสลิปเพื่อยืนยันการสั่งซื้อ:</div>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={handleSlipUpload}
                                        style={{ width: '100%', fontSize: '0.8rem', color: C.text, padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, border: `1px solid ${C.border}` }}
                                    />
                                </div>
                                {paymentSlipBase64 && (
                                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                                        <img src={paymentSlipBase64} alt="slip" style={{ width: 100, borderRadius: 8, border: `2px solid ${C.green}` }} />
                                        <div style={{ color: C.green, fontSize: '0.8rem', marginTop: 4, fontWeight: 600 }}>✅ แนบสลิปแล้ว</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {submitErr && (
                            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 14px', color: C.danger, fontSize: '0.83rem', fontWeight: 600, marginBottom: 14 }}>
                                ⚠️ {submitErr}
                            </div>
                        )}

                        <button id="btn-place-order" onClick={submitOrder} disabled={submitting} style={{ width: '100%', background: submitting ? C.muted : C.accentGrad, color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontWeight: 800, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: FONT, boxShadow: submitting ? 'none' : '0 6px 20px rgba(225,29,72,0.45)', transition: 'all 0.2s' }}>
                            {submitting ? '⏳ กำลังสั่ง…' : '🛵 ยืนยันสั่ง Delivery'}
                        </button>
                        <button onClick={() => setStep(2)} style={{ width: '100%', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 13, padding: '12px', fontWeight: 500, fontSize: '0.87rem', cursor: 'pointer', marginTop: 8, fontFamily: FONT }}>
                            ← แก้รายการอาหาร
                        </button>
                    </div>
                )}

            </div>
        </div>
    )
}

const stepBtn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8,
    border: '1px solid rgba(139,92,246,0.25)',
    background: 'rgba(255,255,255,0.05)', color: '#FDA4AF',
    fontWeight: 800, fontSize: '1.05rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Outfit',system-ui,sans-serif",
}
