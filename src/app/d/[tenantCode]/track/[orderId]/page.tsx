'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useT } from '@/lib/i18n/useT'
import { LangSwitcher } from '@/components/LangSwitcher'

type DeliveryStatus = 'RECEIVED' | 'PREPARING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'

interface TrackData {
    orderId: string
    orderNumber: string
    storeName: string
    currency: string
    logoUrl?: string
    deliveryStatus: DeliveryStatus
    estimatedAt?: string
    deliveredAt?: string
    customerName: string
    customerPhone: string
    addressText: string
    driverNote?: string
    subtotal: number
    deliveryFee: number
    totalAmount: number
    isPrepaid: boolean
    items: { name: string; quantity: number; unitPrice: number; total: number }[]
    openedAt: string
}

// ── Constants ─────────────────────────────────────────────────
const FONT = "'Outfit','Noto Sans Thai',system-ui,sans-serif"
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html,body { margin: 0; padding: 0; background: #140507; }
  ::-webkit-scrollbar { display: none; }
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
  @keyframes ripple { 0%{transform:scale(0.8);opacity:1} 100%{transform:scale(2.4);opacity:0} }
  @keyframes bounce { 0%,100%{transform:scale(1)} 45%{transform:scale(1.18)} 70%{transform:scale(0.94)} }
`

// STEPS are now translated inside the component
// statusIdx is also computed inside the component

function fmt(v: number, currency: string) {
    return `${Math.round(v).toLocaleString()} ${currency}`
}

function elapsedMin(iso: string) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function TrackPage() {
    const { tenantCode, orderId } = useParams<{ tenantCode: string; orderId: string }>()
    const [data, setData] = useState<TrackData | null>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [lastPoll, setLastPoll] = useState(Date.now())
    const { t, lang, setLang } = useT()

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`/api/public/delivery/${orderId}/track`)
            const j = await res.json()
            if (j.success) { setData(j); setError('') }
            else setError(j.error || t('error_occurred'))
        } catch { setError(t('error_connect')) }
        finally { setLoading(false); setLastPoll(Date.now()) }
    }, [orderId, t])

    useEffect(() => { fetchStatus() }, [fetchStatus])
    useEffect(() => {
        if (data?.deliveryStatus === 'DELIVERED' || data?.deliveryStatus === 'CANCELLED') return
        const timer = setInterval(fetchStatus, 30_000)
        return () => clearInterval(timer)
    }, [fetchStatus, data?.deliveryStatus])

    // Build translated steps
    const STEPS = [
        { key: 'RECEIVED' as DeliveryStatus,         label: t('track_received'),   sub: t('track_received_sub'),   icon: '📥', color: '#3B82F6' },
        { key: 'PREPARING' as DeliveryStatus,        label: t('track_preparing'),  sub: t('track_preparing_sub'),  icon: '🍳', color: '#F59E0B' },
        { key: 'OUT_FOR_DELIVERY' as DeliveryStatus, label: t('track_out'),        sub: t('track_out_sub'),        icon: '🛵', color: '#e11d48' },
        { key: 'DELIVERED' as DeliveryStatus,        label: t('track_delivered'),  sub: t('track_delivered_sub'),  icon: '✅', color: '#10B981' },
    ]

    if (loading) return (
        <div style={{ minHeight: '100dvh', background: '#140507', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ width: 44, height: 44, border: '4px solid rgba(225,29,72,0.2)', borderTopColor: '#e11d48', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#94A3B8', margin: 0, fontSize: '0.9rem' }}>{t('track_loading')}</p>
        </div>
    )

    if (error || !data) return (
        <div style={{ minHeight: '100dvh', background: '#140507', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, fontFamily: FONT, textAlign: 'center' }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ fontSize: '3.5rem' }}>😕</div>
            <p style={{ color: '#F87171', fontWeight: 600, margin: 0 }}>{error || t('track_title')}</p>
            <a href={`/d/${tenantCode}`} style={{ color: '#e11d48', fontSize: '0.9rem', marginTop: 8 }}>← {t('delivery_badge')}</a>
        </div>
    )

    const curIdx = STEPS.findIndex(x => x.key === data.deliveryStatus)  < 0 ? 0 : STEPS.findIndex(x => x.key === data.deliveryStatus)
    const isCancelled = data.deliveryStatus === 'CANCELLED'
    const isDone = data.deliveryStatus === 'DELIVERED'
    const curStep = STEPS[curIdx] ?? STEPS[0]
    const elapsed = elapsedMin(data.openedAt)

    return (
        <div style={{ minHeight: '100dvh', background: '#140507', fontFamily: FONT, display: 'flex', justifyContent: 'center' }}>
            <style>{GLOBAL_CSS}</style>
            <div style={{ width: '100%', maxWidth: 430, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

                {/* ── Header ── */}
                <div style={{ background: 'linear-gradient(135deg,#4c0519,#881337)', padding: '20px 20px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'radial-gradient(circle at 50% 50%,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
                    <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10 }}>
                        <LangSwitcher lang={lang} setLang={setLang} theme="dark" />
                    </div>
                    {data.logoUrl && (
                        <img src={data.logoUrl} alt="logo" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', marginBottom: 8, border: '2px solid rgba(255,255,255,0.2)' }} />
                    )}
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{data.storeName}</div>
                    <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.15rem', marginTop: 4 }}>🛵 {t('track_title')}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: 4, fontFamily: 'monospace' }}>{data.orderNumber}</div>
                </div>

                {/* ── Status Hero ── */}
                <div style={{ padding: '24px 20px', textAlign: 'center', animation: 'fadeUp 0.4s ease' }}>
                    {isCancelled ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>❌</div>
                            <div style={{ color: '#F87171', fontWeight: 800, fontSize: '1.2rem' }}>{t('track_cancelled')}</div>
                            <div style={{ color: '#64748B', fontSize: '0.85rem' }}>{t('track_cancelled_sub')}</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            {/* Pulse ring */}
                            <div style={{ position: 'relative', width: 88, height: 88 }}>
                                {!isDone && (
                                    <>
                                        <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: `2px solid ${curStep.color}`, animation: 'ripple 1.6s ease-out infinite', opacity: 0.5 }} />
                                        <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${curStep.color}`, animation: 'ripple 1.6s ease-out 0.5s infinite', opacity: 0.3 }} />
                                    </>
                                )}
                                <div style={{ width: 88, height: 88, borderRadius: '50%', background: `${curStep.color}20`, border: `3px solid ${curStep.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8rem', animation: isDone ? 'bounce 0.6s ease' : 'none', boxShadow: `0 0 32px ${curStep.color}40` }}>
                                    {curStep.icon}
                                </div>
                            </div>
                            <div style={{ color: '#F1F5F9', fontWeight: 800, fontSize: '1.2rem' }}>{curStep.label}</div>
                            <div style={{ color: '#94A3B8', fontSize: '0.85rem' }}>{curStep.sub}</div>
                            {!isDone && elapsed > 0 && (
                                <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '4px 14px', fontSize: '0.75rem', color: '#64748B' }}>
                                    ⏱ {elapsed} {t('track_elapsed')}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Progress Steps ── */}
                {!isCancelled && (
                    <div style={{ margin: '0 20px', background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '16px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {STEPS.map((step, i) => {
                            const done = i <= curIdx
                            const active = i === curIdx
                            return (
                                <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', position: 'relative' }}>
                                    {i < STEPS.length - 1 && (
                                        <div style={{ position: 'absolute', left: 19, top: 36, width: 2, height: 20, background: done && i < curIdx ? step.color : 'rgba(255,255,255,0.1)', transition: 'background 0.4s', borderRadius: 1 }} />
                                    )}
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: done ? `${step.color}20` : 'rgba(255,255,255,0.05)', border: `2px solid ${done ? step.color : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, boxShadow: active ? `0 0 16px ${step.color}50` : 'none', transition: 'all 0.3s', }}>
                                        {done ? step.icon : <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'block' }} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: done ? '#F1F5F9' : '#475569', fontWeight: done ? 700 : 400, fontSize: '0.88rem', transition: 'color 0.3s' }}>{step.label}</div>
                                        {active && !isDone && <div style={{ color: step.color, fontSize: '0.72rem', marginTop: 1, animation: 'pulse 2s infinite' }}>● {t('loading').replace('…','')}</div>}
                                    </div>
                                    {done && !active && <div style={{ color: '#10B981', fontSize: '0.8rem', fontWeight: 700 }}>✓</div>}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* ── Order Summary ── */}
                <div style={{ margin: '16px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('track_order_summary')}</span>
                        <span style={{ color: '#64748B', fontSize: '0.72rem' }}>{data.items.length} {t('items_count')}</span>
                    </div>
                    {data.items.map((item, i) => (
                        <div key={i} style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ color: '#CBD5E1', fontSize: '0.85rem' }}>{item.name} × {item.quantity}</span>
                            <span style={{ color: '#94A3B8', fontSize: '0.83rem', fontWeight: 600 }}>{fmt(item.total, data.currency)}</span>
                        </div>
                    ))}
                    <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B', fontSize: '0.8rem' }}>{t('delivery_fee')}</span>
                        <span style={{ color: '#94A3B8', fontSize: '0.83rem', fontWeight: 600 }}>{fmt(data.deliveryFee, data.currency)}</span>
                    </div>
                    <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', background: 'rgba(225,29,72,0.08)', borderTop: '1px solid rgba(225,29,72,0.15)' }}>
                        <span style={{ color: '#FECDD3', fontWeight: 700, fontSize: '0.9rem' }}>{t('track_total')}</span>
                        <span style={{ color: '#FDA4AF', fontWeight: 900, fontSize: '1.05rem' }}>{fmt(data.totalAmount, data.currency)}</span>
                    </div>
                    {data.isPrepaid && (
                        <div style={{ padding: '8px 16px', background: 'rgba(16,185,129,0.08)', textAlign: 'center' }}>
                            <span style={{ color: '#34D399', fontSize: '0.78rem', fontWeight: 700 }}>{t('track_paid')}</span>
                        </div>
                    )}
                </div>

                {/* ── Address ── */}
                <div style={{ margin: '0 20px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{t('track_address')}</div>
                    <div style={{ color: '#CBD5E1', fontSize: '0.85rem', lineHeight: 1.6 }}>{data.customerName} — {data.customerPhone}</div>
                    <div style={{ color: '#94A3B8', fontSize: '0.82rem', lineHeight: 1.6, marginTop: 4 }}>{data.addressText}</div>
                    {data.driverNote && <div style={{ color: '#64748B', fontSize: '0.78rem', fontStyle: 'italic', marginTop: 6 }}>💬 {data.driverNote}</div>}
                </div>

                {/* ── Footer ── */}
                <div style={{ margin: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={fetchStatus} style={{ width: '100%', padding: '11px', background: 'rgba(255,255,255,0.06)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, cursor: 'pointer', fontSize: '0.85rem', fontFamily: FONT, fontWeight: 600 }}>
                        {t('track_refresh')}
                    </button>
                    <a href={`/d/${tenantCode}`} style={{ display: 'block', textAlign: 'center', padding: '11px', background: 'linear-gradient(135deg,#E11D48,#9F1239)', color: '#fff', borderRadius: 12, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700 }}>
                        {t('delivery_badge')}
                    </a>
                    <div style={{ textAlign: 'center', color: '#334155', fontSize: '0.7rem', marginTop: 4 }}>
                        {t('track_live')} · {new Date(lastPoll).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                </div>

            </div>
        </div>
    )
}
