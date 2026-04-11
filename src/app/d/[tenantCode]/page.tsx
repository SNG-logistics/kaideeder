'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/useT'
import { LangSwitcher } from '@/components/LangSwitcher'

// ── Types ─────────────────────────────────────────────────────
type Step = 1 | 2 | 3
type Topping = { id: string; name: string; price: number; isActive?: boolean }
type Product = { toppingsJson?: string | null;  id: string; name: string; price: number | null; unit: string | null; categoryId: string | null; imageUrl?: string | null; isFeatured?: boolean }
type Category = { id: string; name: string; color: string | null; icon: string | null }
type Tenant = { name: string; displayName: string | null; storeNameLao?: string | null; language?: string; logoUrl: string | null; currency: string; qrBankingBase64?: string | null }
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
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Noto+Sans+Thai:wght@400;500;600;700;800&family=Noto+Sans+Lao:wght@400;500;600;700&display=swap');
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
// StepDots now accepts t function and step translations from component hook

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
    const { t, lang, setLang } = useT()

    // Disable languages based on tenant setting
    const showLangSwitcher = tenant?.language === 'both'

    // ── Step ─────────────────────────────────────────────────
    const [step, setStep] = useState<Step>(1)

    // ── Step 1 — Customer Info ────────────────────────────────
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const [note, setNote] = useState('')
    const [latitude, setLatitude] = useState<number | null>(null)
    const [longitude, setLongitude] = useState<number | null>(null)
    const [locating, setLocating] = useState(false)
    const [step1Err, setStep1Err] = useState('')

    // ── Customer Profile Auto-Fill ─────────────────────────────
    type SavedProfile = { name: string; phone: string; address: string; latitude: number | null; longitude: number | null }
    const PROFILE_KEY = `delivery_profile_${tenantCode}`
    const [savedProfile, setSavedProfile] = useState<SavedProfile | null>(null)
    const [profileApplied, setProfileApplied] = useState(false)
    const [phoneLookupProfile, setPhoneLookupProfile] = useState<SavedProfile | null>(null)

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(PROFILE_KEY)
            if (raw) setSavedProfile(JSON.parse(raw))
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function applyProfile(profile: SavedProfile) {
        setName(profile.name)
        setPhone(profile.phone)
        setAddress(profile.address)
        setLatitude(profile.latitude)
        setLongitude(profile.longitude)
        setProfileApplied(true)
        setSavedProfile(null)
        setPhoneLookupProfile(null)
    }

    async function handlePhoneBlur() {
        if (phone.replace(/[^0-9]/g, '').length < 8) return
        if (name.trim()) return // already have name, skip lookup
        try {
            const res = await fetch(`/api/public/delivery/profile?phone=${encodeURIComponent(phone)}&tenant=${tenantCode}`)
            const j = await res.json()
            if (j.data && j.data.customerName) {
                setPhoneLookupProfile({
                    name: j.data.customerName,
                    phone: j.data.customerPhone,
                    address: j.data.addressText,
                    latitude: j.data.latitude ?? null,
                    longitude: j.data.longitude ?? null,
                })
            }
        } catch {}
    }

    function saveProfileToStorage() {
        try {
            localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: name.trim(), phone: phone.trim(), address: address.trim(), latitude, longitude }))
        } catch {}
    }

    // ── Step 2 — Menu ─────────────────────────────────────────
    const [cart, setCart] = useState<CartItem[]>([])
    const [activeCategory, setActiveCategory] = useState('all')
    const [search, setSearch] = useState('')
    const [cartOpen, setCartOpen] = useState(false)
    const [toppingProduct, setToppingProduct] = useState<Product | null>(null)
    const [selectedToppings, setSelectedToppings] = useState<Topping[]>([])

    // ── Step 3 — Confirm ─────────────────────────────────────
    const [submitting, setSubmitting] = useState(false)
    const [submitErr, setSubmitErr] = useState('')
    const [paymentSlipBase64, setPaymentSlipBase64] = useState<string | null>(null)

    // ── Delivery fee (fixed — fetched from tenant settings in future) ──
    // For now: free (staff can adjust from queue)
    const DELIVERY_FEE = 0

    const currency = tenant?.currency || 'LAK'
    const subtotal = cart.reduce((s, i) => s + ((i.price ?? 0) + (i.toppingsTotal ?? 0)) * i.quantity, 0)
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
            .catch(() => setError(t('menu_load_error')))
            .finally(() => setLoading(false))
    }, [tenantCode, t])

    // Apply auto-language config on tenant load
    useEffect(() => {
        if (!tenant || !tenant.language) return
        if (tenant.language === 'th') setLang('th')
        else if (tenant.language === 'lo') setLang('lo')
        // 'both' relies on useT's default behavior
    }, [tenant, setLang])

    // ── Cart helpers ──────────────────────────────────────────
    const addToCart = useCallback((p: Product) => {
        if (p.toppingsJson) {
            try {
                const active = JSON.parse(p.toppingsJson as string).filter((t: Topping) => t.isActive !== false)
                if (active.length > 0) {
                    setToppingProduct(p)
                    setSelectedToppings([])
                    return
                }
            } catch {}
        }
        internalAddToCart(p, [], 0)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const internalAddToCart = useCallback((p: Product, tops: Topping[], topTotal: number) => {
        setCart(prev => {
            const tJson = tops.length > 0 ? JSON.stringify(tops) : undefined
            const cartId = p.id + (tJson || '')
            const ex = prev.find(i => i.cartId === cartId)
            if (ex) return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i)
            const topsNote = tops.length > 0 ? '(' + tops.map(top => top.name).join(', ') + ')' : ''
            return [...prev, { ...p, cartId, quantity: 1, note: topsNote, toppingsJson: tJson, toppingsTotal: topTotal }]
        })
        setToppingProduct(null)
    }, [])

    const removeFromCart = useCallback((cartId: string) => {
        setCart(prev => {
            const item = prev.find(i => i.cartId === cartId)
            if (!item) return prev
            if (item.quantity <= 1) return prev.filter(i => i.cartId !== cartId)
            return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity - 1 } : i)
        })
    }, [])

    const cartQty = (id: string) => cart.filter(i => i.id === id).reduce((s, i) => s + i.quantity, 0)

    const filtered = products.filter(p => {
        const matchCat = activeCategory === 'all' || (activeCategory === 'featured' && p.isFeatured) || p.categoryId === activeCategory
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
        return matchCat && matchSearch
    })

    // ── Step 1 → 2 ───────────────────────────────────────────
    function goToMenu() {
        setStep1Err('')
        if (!name.trim()) { setStep1Err(t('delivery_err_name')); return }
        if (!phone.trim()) { setStep1Err(t('delivery_err_phone')); return }
        if (!address.trim()) { setStep1Err(t('delivery_err_address')); return }
        setStep(2)
    }

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert('เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่งที่ตั้ง')
            return
        }
        setLocating(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLatitude(pos.coords.latitude)
                setLongitude(pos.coords.longitude)
                setLocating(false)
            },
            (err) => {
                alert('ไม่สามารถดึงตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง หรือพิมพ์ที่อยู่ให้ชัดเจน')
                setLocating(false)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
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
        if (cart.length === 0) { setSubmitErr(t('bill_total') + ' = 0'); return }
        if (totalAmount > 0 && !paymentSlipBase64) { setSubmitErr('Please upload payment slip / กรุณาแนบสลิป'); return }
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
                    latitude,
                    longitude,
                    items: cart.map(i => ({ productId: i.id, quantity: i.quantity, unitPrice: (i.price ?? 0) + (i.toppingsTotal ?? 0), toppingsJson: i.toppingsJson, toppingsTotal: i.toppingsTotal })),
                    deliveryFee: DELIVERY_FEE,
                    customerNote: note.trim() || undefined,
                    paymentSlipBase64,
                }),
            })
            const j = await res.json()
            if (j.success) {
                saveProfileToStorage()
                router.push(`/d/${tenantCode}/track/${j.orderId}`)
            } else {
                setSubmitErr(j.error || t('error_occurred'))
            }
        } catch { setSubmitErr(t('error_connect')) }
        finally { setSubmitting(false) }
    }

    // ── Loading / Error ───────────────────────────────────────
    if (loading) return (
        <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ width: 44, height: 44, border: `4px solid ${C.accentLight}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: C.sub, margin: 0 }}>{t('loading')}...</p>
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
        <>
        <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: FONT, display: 'flex', justifyContent: 'center' }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative' }}>

                {/* ── Header ── */}
                <div style={{ background: 'linear-gradient(135deg, #4c0519, #881337)', padding: '16px 20px 8px', position: 'sticky', top: 0, zIndex: 30 }}>
                    {showLangSwitcher && (
                        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
                            <LangSwitcher lang={lang} setLang={setLang} theme="dark" />
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {tenant?.logoUrl && <img src={tenant.logoUrl} alt="logo" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />}
                        <div>
                            <div style={{ color: C.text, fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2 }}>{tenant?.name}</div>
                            <div style={{ color: '#FDA4AF', fontSize: '0.72rem', fontWeight: 600 }}>🛵 {t('delivery_badge')}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '12px 0 8px' }}>
                        {[
                            { n: 1, label: t('delivery_step1') },
                            { n: 2, label: t('delivery_step2') },
                            { n: 3, label: t('delivery_step3') },
                        ].map((s, i, a) => (
                            <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '50%',
                                        background: step >= s.n ? C.accentGrad : 'rgba(255,255,255,0.06)',
                                        border: `2px solid ${step >= s.n ? C.accent : 'rgba(255,255,255,0.1)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.8rem', fontWeight: 800,
                                        color: step >= s.n ? '#fff' : C.muted,
                                        transition: 'all 0.25s',
                                        boxShadow: step === s.n ? C.accentGlow : 'none',
                                    }}>
                                        {step > s.n ? '✓' : s.n}
                                    </div>
                                    <span style={{ fontSize: '0.6rem', color: step >= s.n ? '#FDA4AF' : C.muted, fontWeight: 600 }}>{s.label}</span>
                                </div>
                                {i < a.length - 1 && (
                                    <div style={{ width: 40, height: 2, background: step > s.n ? C.accent : 'rgba(255,255,255,0.08)', margin: '0 4px', marginBottom: 20, transition: 'background 0.3s', borderRadius: 1 }} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ══════════════ STEP 1 — ข้อมูลลูกค้า ═══════════════ */}
                {step === 1 && (
                    <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 0, animation: 'fadeUp 0.3s ease' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.text, marginBottom: 4 }}>📋 {t('delivery_info_title')}</div>
                        <div style={{ fontSize: '0.8rem', color: C.sub, marginBottom: 16 }}>{t('delivery_info_sub')}</div>

                        {/* ── Profile Banner: localStorage or phone lookup ─── */}
                        {(savedProfile || phoneLookupProfile) && !profileApplied && (() => {
                            const profile = savedProfile || phoneLookupProfile!
                            return (
                                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1.5px solid rgba(34,197,94,0.35)', borderRadius: 14, padding: '12px 14px', marginBottom: 16, animation: 'fadeUp 0.3s ease' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <span style={{ fontSize: '1.2rem' }}>👋</span>
                                        <div>
                                            <div style={{ color: C.green, fontWeight: 800, fontSize: '0.88rem' }}>{t('delivery_profile_greeting')} {profile.name}!</div>
                                            <div style={{ color: C.sub, fontSize: '0.75rem', marginTop: 1 }}>{t('delivery_profile_sub')}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: C.muted, marginBottom: 10, paddingLeft: 28 }}>
                                        📞 {profile.phone} &nbsp;•&nbsp; 📍 {profile.address.slice(0, 40)}{profile.address.length > 40 ? '…' : ''}
                                        {profile.latitude && <span style={{ color: C.green }}> &nbsp;🗺️ มีพิน</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => applyProfile(profile)} style={{ flex: 2, padding: '9px 12px', background: C.green, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', fontFamily: FONT }}>
                                            {t('delivery_profile_use')}
                                        </button>
                                        <button onClick={() => { setSavedProfile(null); setPhoneLookupProfile(null); setProfileApplied(true) }} style={{ flex: 1, padding: '9px 12px', background: 'rgba(255,255,255,0.05)', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer', fontFamily: FONT }}>
                                            {t('delivery_profile_new')}
                                        </button>
                                    </div>
                                </div>
                            )
                        })()}

                        <Field label={t('delivery_name')} required>
                            <input id="delivery-name" style={inputCss} placeholder={t('delivery_name')} value={name} onChange={e => setName(e.target.value)} />
                        </Field>

                        <Field label={t('delivery_phone')} required>
                            <input id="delivery-phone" style={inputCss} placeholder="+856 20..." type="tel" value={phone}
                                onChange={e => setPhone(e.target.value)}
                                onBlur={handlePhoneBlur} />
                        </Field>

                        <Field label={t('delivery_address')} required>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <textarea id="delivery-address" style={{ ...inputCss, height: 80, resize: 'vertical' }}
                                    placeholder={t('delivery_address')} value={address}
                                    onChange={e => setAddress(e.target.value)} />
                                <button
                                    onClick={handleGetLocation}
                                    style={{ background: latitude ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.06)', border: `1px solid ${latitude ? C.green : C.border}`, color: latitude ? C.green : C.text, padding: '10px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                >
                                    {locating ? t('delivery_locating') : (latitude ? t('delivery_pin_done') : t('delivery_pin_btn'))}
                                </button>
                                {latitude && longitude && (
                                    <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}`, height: 160, position: 'relative' }}>
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            style={{ border: 0 }}
                                            loading="lazy"
                                            allowFullScreen
                                            src={`https://maps.google.com/maps?q=${latitude},${longitude}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                                        ></iframe>
                                    </div>
                                )}
                            </div>
                        </Field>

                        <Field label={t('delivery_note')}>
                            <input id="delivery-note" style={inputCss} placeholder={t('delivery_note_placeholder')} value={note}
                                onChange={e => setNote(e.target.value)} />
                        </Field>

                        {step1Err && (
                            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 14px', color: C.danger, fontSize: '0.83rem', fontWeight: 600, marginBottom: 12 }}>
                                ⚠️ {step1Err}
                            </div>
                        )}

                        <button id="btn-go-to-menu" onClick={goToMenu} style={{ marginTop: 'auto', width: '100%', padding: '14px', background: C.accentGrad, color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', fontSize: '0.97rem', fontWeight: 800, fontFamily: FONT, boxShadow: '0 6px 20px rgba(225,29,72,0.45)' }}>
                            {t('delivery_btn_menu')} →
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
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search_menu')} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: '0.87rem', fontFamily: FONT }} />
                                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '1rem', padding: 0, lineHeight: 1 }}>✕</button>}
                            </div>
                            {/* Back to step 1 */}
                            <button onClick={() => setStep(1)} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '8px 12px', cursor: 'pointer', color: C.sub, fontSize: '0.82rem', fontFamily: FONT, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                ← {t('delivery_btn_back')}
                            </button>
                        </div>

                        {/* Category pills */}
                        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 14px 8px', background: C.surface }}>
                            {[{ id: 'all', name: t('all_menus'), icon: '🍽️' }, ...categories.map(c => ({ id: c.id, name: c.name, icon: c.icon || '🍴' }))].map(cat => (
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
                                    <div>{t('no_menu_found')}</div>
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
                                                <div style={{ color: '#FDA4AF', fontWeight: 800, fontSize: '0.88rem', marginBottom: p.toppingsJson ? 2 : 8 }}>{fmt(p.price, currency)}</div>
                                                {p.toppingsJson && <div style={{ color: '#fb923c', fontSize: '0.72rem', fontWeight: 700, marginBottom: 6 }}>+ {t('add')} {t('topping')}</div>}
                                                {qty === 0 ? (
                                                    <button onClick={() => addToCart(p)} style={{ width: '100%', padding: '7px 0', borderRadius: 10, border: 'none', background: C.accentGrad, color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 3px 10px rgba(225,29,72,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 34 }}>
                                                        <span>+</span> {t('add')}
                                                    </button>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.accentLight, borderRadius: 10, padding: '2px 3px', minHeight: 34 }}>
                                                        <button onClick={() => { if(p.toppingsJson){alert(t('topping_in_cart_alert')); return} removeFromCart(cart.find(i=>i.id===p.id)?.cartId||'') }} style={stepBtn}>−</button>
                                                        <span style={{ color: '#FDA4AF', fontWeight: 900, fontSize: '0.95rem', minWidth: 20, textAlign: 'center' }}>{qty}</span>
                                                        <button onClick={() => internalAddToCart(p, cart.find(i=>i.id===p.id)?.toppingsJson ? JSON.parse(cart.find(i=>i.id===p.id)!.toppingsJson as string) : [], cart.find(i=>i.id===p.id)?.toppingsTotal||0)} style={{ ...stepBtn, background: C.accent, color: '#fff', border: 'none' }}>+</button>
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
                                        <span style={{ fontSize: '0.58rem', opacity: 0.85 }}>{t('items_count')}</span>
                                    </div>
                                    <span style={{ flex: 1, fontSize: '0.92rem' }}>{t('view_cart')}</span>
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
                                    <h2 style={{ color: C.text, fontSize: '1rem', fontWeight: 800, margin: '0 0 16px' }}>🛒 {t('cart_title')}</h2>
                                    {cart.map(item => (
                                        <div key={item.cartId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ color: C.text, fontWeight: 600, fontSize: '0.87rem' }}>{item.name}</div>
                                                {item.note && <div style={{ color: '#fb923c', fontSize: '0.72rem', marginTop: 1 }}>{item.note}</div>}
                                                <div style={{ color: '#FDA4AF', fontSize: '0.76rem', marginTop: 2 }}>{fmt((item.price ?? 0) + (item.toppingsTotal ?? 0), currency)} × {item.quantity}{item.toppingsTotal ? ` (${t('include_topping')})` : ''}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.accentLight, borderRadius: 10, padding: '2px 3px' }}>
                                                <button onClick={() => removeFromCart(item.cartId)} style={stepBtn}>−</button>
                                                <span style={{ color: '#FDA4AF', fontWeight: 900, width: 20, textAlign: 'center', fontSize: '0.9rem' }}>{item.quantity}</span>
                                                <button onClick={() => internalAddToCart(item, item.toppingsJson ? JSON.parse(item.toppingsJson as string) : [], item.toppingsTotal || 0)} style={{ ...stepBtn, background: C.accent, color: '#fff', border: 'none' }}>+</button>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: `1.5px solid ${C.border}` }}>
                                        <span style={{ color: C.sub, fontWeight: 600 }}>{t('bill_total')}</span>
                                        <span style={{ color: '#FDA4AF', fontWeight: 900, fontSize: '1.05rem' }}>{fmt(subtotal, currency)}</span>
                                    </div>
                                    {DELIVERY_FEE > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                                            <span style={{ color: C.muted, fontSize: '0.85rem' }}>{t('delivery_fee')}</span>
                                            <span style={{ color: C.sub, fontSize: '0.9rem', fontWeight: 600 }}>{fmt(DELIVERY_FEE, currency)}</span>
                                        </div>
                                    )}
                                    <button id="btn-confirm-order" onClick={() => { setCartOpen(false); setStep(3) }} style={{ width: '100%', background: C.accentGrad, color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontWeight: 800, fontSize: '0.97rem', cursor: 'pointer', marginTop: 10, fontFamily: FONT, boxShadow: '0 6px 20px rgba(225,29,72,0.45)' }}>
                                        {t('cart_confirm')} →
                                    </button>
                                    <button onClick={() => setCartOpen(false)} style={{ width: '100%', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 13, padding: '12px', fontWeight: 500, fontSize: '0.87rem', cursor: 'pointer', marginTop: 8, fontFamily: FONT }}>
                                        ← {t('cart_add_more')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════ STEP 3 — ยืนยัน ════════════════════ */}
                {step === 3 && (
                    <div style={{ flex: 1, padding: '20px', animation: 'fadeUp 0.3s ease' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.text, marginBottom: 4 }}>📋 {t('cart_title')}</div>
                        <div style={{ fontSize: '0.8rem', color: C.sub, marginBottom: 20 }}>{t('delivery_check_details')}</div>

                        {/* Customer info recap */}
                        <div style={{ background: C.surface, borderRadius: 14, padding: '14px 16px', border: `1px solid ${C.border}`, marginBottom: 14 }}>
                            <div style={{ fontSize: '0.72rem', color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>👤 {t('delivery_info_title')}</div>
                            <div style={{ color: C.text, fontWeight: 700, fontSize: '0.9rem' }}>{name}</div>
                            <div style={{ color: C.sub, fontSize: '0.83rem', marginTop: 2 }}>{phone}</div>
                            <div style={{ color: C.sub, fontSize: '0.83rem', marginTop: 6, lineHeight: 1.5 }}>📍 {address}</div>
                            {latitude && longitude && (
                                <div style={{ color: C.green, fontSize: '0.78rem', marginTop: 4, fontWeight: 600 }}>🗺️ แนบพิกัดแผนที่แล้ว</div>
                            )}
                            {note && <div style={{ color: C.muted, fontSize: '0.78rem', marginTop: 4, fontStyle: 'italic' }}>💬 {note}</div>}
                        </div>

                        {/* Items recap */}
                        <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 14 }}>
                            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: '0.72rem', color: C.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🍽️ {t('bill_total')}</div>
                            </div>
                            {cart.map((item, i) => (
                                <div key={item.cartId} style={{ padding: '9px 14px', borderBottom: i < cart.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: C.text, fontSize: '0.85rem' }}>{item.name} × {item.quantity}</span>
                                        <span style={{ color: '#FDA4AF', fontWeight: 600, fontSize: '0.85rem' }}>{fmt(((item.price ?? 0) + (item.toppingsTotal ?? 0)) * item.quantity, currency)}</span>
                                    </div>
                                    {item.note && <div style={{ color: '#fb923c', fontSize: '0.72rem', marginTop: 2 }}>{item.note}</div>}
                                </div>
                            ))}
                            {DELIVERY_FEE > 0 && (
                                <div style={{ padding: '9px 14px', display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}` }}>
                                    <span style={{ color: C.muted, fontSize: '0.83rem' }}>{t('delivery_fee')}</span>
                                    <span style={{ color: C.sub, fontSize: '0.83rem', fontWeight: 600 }}>{fmt(DELIVERY_FEE, currency)}</span>
                                </div>
                            )}
                            <div style={{ padding: '12px 14px', background: C.accentLight, display: 'flex', justifyContent: 'space-between', borderTop: `1px solid rgba(124,58,237,0.2)` }}>
                                <span style={{ color: '#C4B5FD', fontWeight: 700 }}>{t('track_total')}</span>
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
                                        💳 {t('qr_instruction_2')}
                                    </div>
                                )}
                                <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 12 }}>
                                    <div style={{ fontSize: '0.8rem', color: '#FDA4AF', fontWeight: 600, marginBottom: 8 }}>{t('bill_upload_slip')}:</div>
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
                                        <div style={{ color: C.green, fontSize: '0.8rem', marginTop: 4, fontWeight: 600 }}>✅ {t('success')}</div>
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
                            {submitting ? '⏳ ...' : '🛵 ' + t('delivery_badge')}
                        </button>
                        <button onClick={() => setStep(2)} style={{ width: '100%', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 13, padding: '12px', fontWeight: 500, fontSize: '0.87rem', cursor: 'pointer', marginTop: 8, fontFamily: FONT }}>
                            ← {t('edit_menu')}
                        </button>
                    </div>
                )}

            </div>
        </div>

        {/* ── TOPPING MODAL ───────────────────────────────────────── */}
        {toppingProduct && toppingProduct.toppingsJson && (() => {
            let tops: Topping[] = []
            try { tops = JSON.parse(toppingProduct.toppingsJson as string) } catch {}
            tops = tops.filter(t => t.isActive !== false)
            const toppingsTotal = selectedToppings.reduce((s, t) => s + t.price, 0)
            return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, fontFamily: FONT }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={() => setToppingProduct(null)} />
                    <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 20px 40px', maxHeight: '85dvh', overflowY: 'auto', animation: 'slideUp 0.24s ease', boxShadow: '0 -16px 48px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 16px' }} />
                        <div style={{ color: C.text, fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>🧂 {t('topping')}</div>
                        <div style={{ color: C.sub, fontSize: '0.78rem', marginBottom: 16 }}>{toppingProduct.name}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                            {tops.map(t => {
                                const isSel = selectedToppings.some(st => st.id === t.id)
                                return (
                                    <div key={t.id} onClick={() => {
                                        if (isSel) setSelectedToppings(p => p.filter(st => st.id !== t.id))
                                        else setSelectedToppings(p => [...p, t])
                                    }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: `2px solid ${isSel ? C.accent : C.border}`, background: isSel ? C.accentLight : 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                        <span style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${isSel ? C.accent : 'rgba(255,255,255,0.2)'}`, background: isSel ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', color: '#fff', fontWeight: 800 }}>{isSel ? '✓' : ''}</span>
                                        <span style={{ flex: 1, color: C.text, fontWeight: 600, fontSize: '0.88rem' }}>{t.name}</span>
                                        <span style={{ color: isSel ? '#FDA4AF' : C.sub, fontWeight: 700, fontSize: '0.83rem' }}>+{fmt(t.price, currency)}</span>
                                    </div>
                                )
                            })}
                        </div>
                        {toppingsTotal > 0 && (
                            <div style={{ background: C.accentLight, border: `1px solid ${C.accent}`, borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: C.text, fontSize: '0.82rem', fontWeight: 600 }}>{t('topping_total')}</span>
                                <span style={{ color: '#FDA4AF', fontWeight: 800, fontSize: '0.92rem' }}>+{fmt(toppingsTotal, currency)}</span>
                            </div>
                        )}
                        <button onClick={() => internalAddToCart(toppingProduct, selectedToppings, toppingsTotal)} style={{ width: '100%', padding: '15px', borderRadius: 14, border: 'none', background: C.accentGrad, color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', fontFamily: FONT, marginBottom: 8, boxShadow: '0 6px 20px rgba(225,29,72,0.45)' }}>
                            {t('confirm')} {toppingsTotal > 0 ? `(${fmt((toppingProduct.price ?? 0) + toppingsTotal, currency)})` : ''}
                        </button>
                        <button onClick={() => setToppingProduct(null)} style={{ width: '100%', padding: '12px', borderRadius: 13, border: `1px solid ${C.border}`, background: 'transparent', color: C.sub, fontWeight: 500, fontSize: '0.87rem', cursor: 'pointer', fontFamily: FONT }}>{t('cancel')}</button>
                    </div>
                </div>
            )
        })()}
        </>
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
