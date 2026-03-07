'use client'
import { useEffect, useState, useCallback } from 'react'
import { adminFetch } from '@/lib/admin-fetch'

type Plan = {
    id: string
    code: string
    name: string
    priceLAK: number
    durationDays: number
    isActive: boolean
    _count?: { subs: number }
}

const fmt = (n: number) => n.toLocaleString()

const PLAN_ICONS = ['📦', '🥈', '🥇', '💎', '🚀', '⭐']

const defaultForm = { code: '', name: '', priceLAK: 0, durationDays: 30 }

export default function PlansPage() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(defaultForm)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await adminFetch('/api/admin/plans')
        const d = await res.json()
        setPlans(d.data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const res = await adminFetch('/api/admin/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, priceLAK: Number(form.priceLAK), durationDays: Number(form.durationDays) }),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            setMsg({ ok: true, text: `✅ สร้าง Plan "${form.name}" แล้ว` })
            setForm(defaultForm)
            setShowModal(false)
            load()
        } else {
            setMsg({ ok: false, text: d.error ?? 'Error' })
        }
    }

    const inputStyle = {
        width: '100%', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10, padding: '0.6rem 1rem',
        fontSize: '0.875rem', color: '#e2e8f0', outline: 'none',
        boxSizing: 'border-box' as const,
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>📦 Plans</h1>
                    <p style={{ color: '#475569', fontSize: '0.875rem' }}>{plans.length} แผนบริการในระบบ</p>
                </div>
                <button
                    onClick={() => { setShowModal(true); setMsg(null) }}
                    style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border: 'none', color: '#fff', fontWeight: 700,
                        padding: '0.6rem 1.25rem', borderRadius: 10,
                        fontSize: '0.875rem', cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                    }}
                >+ New Plan</button>
            </div>

            {/* Toast */}
            {msg && (
                <div style={{
                    padding: '0.875rem 1.25rem', borderRadius: 12, fontSize: '0.875rem',
                    background: msg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: msg.ok ? '#10b981' : '#ef4444',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    {msg.text}
                    <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, fontSize: '1rem' }}>✕</button>
                </div>
            )}

            {/* Plan Cards */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>⏳ Loading...</div>
            ) : plans.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '4rem',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 16, color: '#334155',
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>📦</div>
                    <p style={{ color: '#475569' }}>ยังไม่มี Plan — กด New Plan เพื่อสร้าง</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                    {plans.map((p, i) => (
                        <div key={p.id} style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: p.isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 16, padding: '1.5rem',
                            display: 'flex', flexDirection: 'column', gap: 12,
                            position: 'relative', overflow: 'hidden',
                        }}>
                            {/* Active glow */}
                            {p.isActive && (
                                <div style={{
                                    position: 'absolute', top: 0, right: 0,
                                    width: 120, height: 120,
                                    background: 'radial-gradient(circle, rgba(99,102,241,0.12), transparent)',
                                    pointerEvents: 'none',
                                }} />
                            )}

                            {/* Plan icon + status */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12,
                                    background: p.isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 24,
                                }}>{PLAN_ICONS[i % PLAN_ICONS.length]}</div>
                                <span style={{
                                    fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.75rem',
                                    borderRadius: 999, border: '1px solid',
                                    color: p.isActive ? '#10b981' : '#475569',
                                    background: p.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                                    borderColor: p.isActive ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)',
                                }}>{p.isActive ? '✅ Active' : 'Inactive'}</span>
                            </div>

                            {/* Name + code */}
                            <div>
                                <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.1rem' }}>{p.name}</p>
                                <p style={{ color: '#475569', fontSize: '0.75rem', fontFamily: 'monospace' }}>{p.code}</p>
                            </div>

                            {/* Price */}
                            <div style={{
                                background: 'rgba(245,158,11,0.06)',
                                border: '1px solid rgba(245,158,11,0.15)',
                                borderRadius: 10, padding: '0.75rem 1rem',
                            }}>
                                <p style={{ color: '#f59e0b', fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace' }}>
                                    {fmt(p.priceLAK)}
                                </p>
                                <p style={{ color: '#64748b', fontSize: '0.72rem' }}>LAK / {p.durationDays} วัน</p>
                            </div>

                            {/* Subs count */}
                            {p._count !== undefined && (
                                <p style={{ color: '#64748b', fontSize: '0.78rem' }}>
                                    🏬 {p._count.subs} ร้านใช้งานอยู่
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create plan modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 999,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem',
                }} onClick={() => setShowModal(false)}>
                    <form
                        onSubmit={handleCreate}
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#0f1221', border: '1px solid rgba(99,102,241,0.4)',
                            borderRadius: 20, padding: '2rem',
                            width: '100%', maxWidth: 480,
                            display: 'flex', flexDirection: 'column', gap: 20,
                            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '1.25rem' }}>📦 สร้าง Plan ใหม่</h2>
                            <button type="button" onClick={() => setShowModal(false)}
                                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            {[
                                { key: 'code', label: 'Plan Code', placeholder: 'MONTHLY', type: 'text' },
                                { key: 'name', label: 'Plan Name', placeholder: 'Monthly Plan', type: 'text' },
                                { key: 'priceLAK', label: 'ราคา (LAK)', placeholder: '200000', type: 'number' },
                                { key: 'durationDays', label: 'ระยะเวลา (วัน)', placeholder: '30', type: 'number' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: 6, fontWeight: 600 }}>{f.label}</label>
                                    <input
                                        type={f.type}
                                        placeholder={f.placeholder}
                                        value={(form as any)[f.key]}
                                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                            ))}
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                border: 'none', color: '#fff', fontWeight: 700,
                                padding: '0.75rem', borderRadius: 12,
                                fontSize: '0.95rem', cursor: saving ? 'not-allowed' : 'pointer',
                                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                            }}
                        >{saving ? '⏳ กำลังสร้าง...' : '📦 สร้าง Plan'}</button>
                    </form>
                </div>
            )}
        </div>
    )
}
