'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'

type Plan = { id: string; code: string; name: string; priceLAK: number; durationDays: number }
type Sub = { id: string; startAt: string; endAt: string; status: 'ACTIVE' | 'ENDED' | 'CANCELLED'; autoRenew: boolean; plan: Plan }
type LedgerRow = { id: string; type: string; amountLAK: number; note: string | null; createdAt: string }
type User = { id: string; username: string; name: string; role: string; isActive: boolean; createdAt: string }
type Tenant = {
    id: string; code: string; name: string; status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED'
    subEndsAt: string | null; graceEndsAt: string | null; createdAt: string
    wallet: { balanceLAK: number; ledger: LedgerRow[] } | null
    subs: Sub[]; users: User[]
}

const STATUS: Record<string, { color: string; bg: string; border: string; label: string; dot: string }> = {
    ACTIVE: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', label: 'Active', dot: '#10b981' },
    PAST_DUE: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', label: 'Past Due', dot: '#f59e0b' },
    SUSPENDED: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', label: 'Suspended', dot: '#ef4444' },
}
const LEDGER_COLOR: Record<string, string> = { TOPUP: '#10b981', RENT_FEE: '#ef4444', ADJUST: '#6366f1', REFUND: '#f59e0b' }
const fmt = (n: number) => n.toLocaleString()
const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { dateStyle: 'medium' })
const fmtDT = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

// ── Shared style tokens ──
const C = {
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20 },
    label: { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#475569' },
    input: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 14px', fontSize: '0.85rem', color: '#e2e8f0', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const },
    btn: (color: string) => ({ padding: '8px 18px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.12s' }),
    ghost: { padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' },
    th: { padding: '11px 16px', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#475569', textAlign: 'left' as const, borderBottom: '1px solid rgba(255,255,255,0.05)' },
    td: { padding: '12px 16px', fontSize: '0.83rem', borderBottom: '1px solid rgba(255,255,255,0.03)' },
}

export default function TenantDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [newStatus, setNewStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'PAST_DUE' | ''>('')
    const [note, setNote] = useState('')
    const [showPlan, setShowPlan] = useState(false)
    const [selectedPlan, setSelectedPlan] = useState('')
    const [planDays, setPlanDays] = useState(30)
    const [resetUser, setResetUser] = useState<User | null>(null)
    const [newPass, setNewPass] = useState('')
    const [resetting, setResetting] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const [tRes, pRes] = await Promise.all([adminFetch(`/api/admin/tenants/${id}`), adminFetch('/api/admin/plans')])
        setTenant((await tRes.json()).data ?? null)
        setPlans((await pRes.json()).data ?? [])
        setLoading(false)
    }, [id])
    useEffect(() => { load() }, [load])

    async function handleStatusChange() {
        if (!newStatus) return
        setSaving(true)
        const res = await adminFetch(`/api/admin/tenants/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus, note }) })
        const d = await res.json()
        setSaving(false)
        if (d.success) { setMsg({ ok: true, text: `Status → ${newStatus}` }); setNewStatus(''); setNote(''); load() }
        else setMsg({ ok: false, text: d.error ?? 'Error' })
    }

    async function handleGrantPlan() {
        if (!selectedPlan) return
        const plan = plans.find(p => p.id === selectedPlan)
        if (!plan) return
        setSaving(true)
        const endAt = new Date(Date.now() + planDays * 86_400_000).toISOString()
        const res = await adminFetch(`/api/admin/tenants/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subEndsAt: endAt, status: 'ACTIVE', note: `Grant plan ${plan.code} for ${planDays}d` }) })
        const d = await res.json()
        setSaving(false)
        if (d.success) { setMsg({ ok: true, text: `Plan granted — expires ${fmtDate(endAt)}` }); setShowPlan(false); load() }
        else setMsg({ ok: false, text: d.error ?? 'Error' })
    }

    async function handleResetPassword() {
        if (!resetUser || !newPass) return
        setResetting(true)
        const res = await adminFetch(`/api/admin/users/${resetUser.id}/password`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: newPass }) })
        const d = await res.json()
        setResetting(false)
        if (res.ok) { setMsg({ ok: true, text: `Password for ${resetUser.name} reset OK` }); setResetUser(null); setNewPass('') }
        else setMsg({ ok: false, text: d.error ?? 'Failed' })
    }

    if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#475569', fontSize: '0.9rem' }}>⏳ Loading...</div>
    if (!tenant) return <div style={{ padding: '4rem', textAlign: 'center', color: '#ef4444' }}>Tenant not found</div>

    const s = STATUS[tenant.status]
    const activeSub = tenant.subs.find(s => s.status === 'ACTIVE')
    const walletBal = tenant.wallet?.balanceLAK ?? 0

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontFamily: "'Inter',system-ui,sans-serif" }}>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#475569' }}>
                <Link href="/admin/tenants" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>← Tenants</Link>
                <span>/</span>
                <span style={{ color: '#e2e8f0' }}>{tenant.name}</span>
            </div>

            {/* Toast */}
            {msg && (
                <div style={{ padding: '12px 18px', borderRadius: 12, background: msg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, color: msg.ok ? '#10b981' : '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{msg.ok ? '✅' : '⚠️'} {msg.text}</span>
                    <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}>✕</button>
                </div>
            )}

            {/* ── Hero Header ─────────────────────────────────────── */}
            <div style={{ ...C.card, padding: '24px 28px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)', borderColor: 'rgba(99,102,241,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        {/* Avatar */}
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 8px 24px rgba(99,102,241,0.3)', flexShrink: 0 }}>
                            🏪
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em' }}>{tenant.name}</h1>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '2px 10px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)' }}>{tenant.code}</span>
                                <span style={{ fontSize: '0.72rem', color: '#475569' }}>สร้าง {fmtDate(tenant.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    {/* Status badge + controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 99, fontSize: '0.78rem', fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot }} />
                            {s.label}
                        </span>
                        <select value={newStatus} onChange={e => setNewStatus(e.target.value as any)}
                            style={{ ...C.input, width: 'auto', padding: '7px 12px', fontSize: '0.8rem' }}>
                            <option value="">เปลี่ยน status...</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                            <option value="PAST_DUE">PAST_DUE</option>
                        </select>
                        {newStatus && <button onClick={handleStatusChange} disabled={saving} style={{ ...C.btn('#6366f1'), opacity: saving ? 0.5 : 1 }}>{saving ? '...' : 'Apply'}</button>}
                    </div>
                </div>
            </div>

            {/* ── Stat Cards ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                {/* Wallet */}
                <div style={{ ...C.card, padding: '20px 22px', background: walletBal > 0 ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.025)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: '1.4rem' }}>💰</span>
                        <span style={C.label}>Wallet</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '1.9rem', fontWeight: 900, color: walletBal > 0 ? '#10b981' : '#475569', lineHeight: 1 }}>{fmt(walletBal)}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#475569' }}>LAK</p>
                </div>
                {/* Plan */}
                <div style={{ ...C.card, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: '1.4rem' }}>📋</span>
                        <span style={C.label}>Active Plan</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: activeSub ? '#e2e8f0' : '#475569' }}>{activeSub?.plan.name ?? 'ไม่มี plan'}</p>
                    {activeSub && <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#10b981' }}>หมดอายุ {fmtDate(activeSub.endAt)}</p>}
                    <button onClick={() => setShowPlan(!showPlan)} style={{ marginTop: 10, background: 'none', border: '1px dashed rgba(99,102,241,0.4)', borderRadius: 8, padding: '4px 10px', color: '#6366f1', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                        + {showPlan ? 'ยกเลิก' : 'Grant / Extend Plan'}
                    </button>
                </div>
                {/* Subscription dates */}
                <div style={{ ...C.card, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: '1.4rem' }}>📅</span>
                        <span style={C.label}>Expires</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0' }}>{tenant.subEndsAt ? fmtDate(tenant.subEndsAt) : '—'}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#475569' }}>Grace: {tenant.graceEndsAt ? fmtDate(tenant.graceEndsAt) : '—'}</p>
                </div>
                {/* Users count */}
                <div style={{ ...C.card, padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: '1.4rem' }}>👥</span>
                        <span style={C.label}>Users</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '1.9rem', fontWeight: 900, color: '#6366f1', lineHeight: 1 }}>{tenant.users.length}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#475569' }}>ผู้ใช้ในระบบ</p>
                </div>
            </div>

            {/* ── Grant Plan inline panel ─────────────────────────────── */}
            {showPlan && (
                <div style={{ ...C.card, padding: '22px 24px', borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>🎯 Grant / Extend Plan</h3>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: '2 1 200px' }}>
                            <p style={{ ...C.label, marginBottom: 6 }}>Plan</p>
                            <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)} style={{ ...C.input }}>
                                <option value="">เลือก plan...</option>
                                {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.priceLAK)} LAK / {p.durationDays}d</option>)}
                            </select>
                        </div>
                        <div style={{ flex: '1 1 100px' }}>
                            <p style={{ ...C.label, marginBottom: 6 }}>จำนวนวัน</p>
                            <input type="number" min={1} max={3650} value={planDays} onChange={e => setPlanDays(Number(e.target.value))} style={{ ...C.input }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleGrantPlan} disabled={!selectedPlan || saving} style={{ ...C.btn('#6366f1'), opacity: (!selectedPlan || saving) ? 0.5 : 1 }}>{saving ? '...' : '✅ Confirm'}</button>
                            <button onClick={() => setShowPlan(false)} style={C.ghost}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Users Table ─────────────────────────────────────────── */}
            <div style={C.card}>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.1rem' }}>👥</span>
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>Users Management</h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                        <thead>
                            <tr>
                                {['Username', 'Name', 'Role', 'Status', 'Actions'].map(h => <th key={h} style={C.th}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {tenant.users.length === 0 ? (
                                <tr><td colSpan={5} style={{ ...C.td, textAlign: 'center', color: '#475569', padding: '32px' }}>ไม่มีผู้ใช้</td></tr>
                            ) : tenant.users.map(u => (
                                <tr key={u.id}>
                                    <td style={{ ...C.td, fontFamily: 'monospace', color: '#94a3b8' }}>{u.username}</td>
                                    <td style={{ ...C.td, fontWeight: 600, color: '#e2e8f0' }}>{u.name}</td>
                                    <td style={C.td}>
                                        <span style={{ background: u.role === 'OWNER' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.05)', color: u.role === 'OWNER' ? '#818cf8' : '#64748b', fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 8, border: `1px solid ${u.role === 'OWNER' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td style={C.td}>
                                        <span style={{ color: u.isActive ? '#10b981' : '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {u.isActive ? '● Active' : '● Inactive'}
                                        </span>
                                    </td>
                                    <td style={C.td}>
                                        <button onClick={() => { setResetUser(u); setNewPass('') }} style={{ ...C.ghost, fontSize: '0.72rem', padding: '5px 12px' }}>
                                            🔑 Reset Password
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Subscription History ─────────────────────────────────── */}
            <div style={C.card}>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.1rem' }}>📋</span>
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>Subscription History</h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                        <thead>
                            <tr>
                                {['Plan', 'Start', 'End', 'Status'].map(h => <th key={h} style={C.th}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {tenant.subs.length === 0 ? (
                                <tr><td colSpan={4} style={{ ...C.td, textAlign: 'center', color: '#475569', padding: '32px' }}>ไม่มีประวัติ</td></tr>
                            ) : tenant.subs.map(sub => {
                                const sc = { ACTIVE: '#10b981', ENDED: '#475569', CANCELLED: '#ef4444' }[sub.status] || '#475569'
                                return (
                                    <tr key={sub.id}>
                                        <td style={{ ...C.td, fontWeight: 600, color: '#e2e8f0' }}>
                                            {sub.plan.name} <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#475569' }}>{sub.plan.code}</span>
                                        </td>
                                        <td style={{ ...C.td, color: '#64748b', fontSize: '0.78rem' }}>{fmtDate(sub.startAt)}</td>
                                        <td style={{ ...C.td, color: '#64748b', fontSize: '0.78rem' }}>{fmtDate(sub.endAt)}</td>
                                        <td style={{ ...C.td, color: sc, fontWeight: 700, fontSize: '0.75rem' }}>{sub.status}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Wallet Ledger ──────────────────────────────────────────── */}
            <div style={C.card}>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.1rem' }}>💳</span>
                        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#e2e8f0' }}>Wallet Ledger</h2>
                    </div>
                    <span style={{ ...C.label }}>last 50 txns</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
                        <thead>
                            <tr>
                                {['Time', 'Type', 'Amount (LAK)', 'Note'].map((h, i) => (
                                    <th key={h} style={{ ...C.th, textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(tenant.wallet?.ledger?.length ?? 0) === 0 ? (
                                <tr><td colSpan={4} style={{ ...C.td, textAlign: 'center', color: '#475569', padding: '32px' }}>ไม่มีธุรกรรม</td></tr>
                            ) : tenant.wallet!.ledger.map(row => (
                                <tr key={row.id}>
                                    <td style={{ ...C.td, color: '#475569', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{fmtDT(row.createdAt)}</td>
                                    <td style={C.td}>
                                        <span style={{ color: LEDGER_COLOR[row.type] ?? '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700 }}>{row.type}</span>
                                    </td>
                                    <td style={{ ...C.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: row.amountLAK >= 0 ? '#10b981' : '#ef4444' }}>
                                        {row.amountLAK >= 0 ? '+' : ''}{fmt(row.amountLAK)}
                                    </td>
                                    <td style={{ ...C.td, color: '#475569', fontSize: '0.78rem' }}>{row.note ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Back */}
            <button onClick={() => router.back()} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#475569', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← กลับ</button>

            {/* ── Reset Password Modal ──────────────────────────────── */}
            {resetUser && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50, backdropFilter: 'blur(4px)' }}>
                    <div style={{ ...C.card, padding: '28px 32px', width: '100%', maxWidth: 400, boxShadow: '0 24px 80px rgba(0,0,0,0.5)', background: '#0f1117', borderColor: 'rgba(255,255,255,0.1)' }}>
                        <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9' }}>🔑 Reset Password</h2>
                        <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: '#64748b' }}>
                            {resetUser.name} <span style={{ fontFamily: 'monospace', color: '#6366f1' }}>@{resetUser.username}</span>
                        </p>
                        <input type="text" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="รหัสผ่านใหม่ (อย่างน้อย 4 ตัว)" style={{ ...C.input, marginBottom: 16 }} />
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => setResetUser(null)} style={C.ghost}>ยกเลิก</button>
                            <button onClick={handleResetPassword} disabled={!newPass || resetting} style={{ ...C.btn('#6366f1'), opacity: (!newPass || resetting) ? 0.5 : 1 }}>
                                {resetting ? '⏳ ...' : '✅ Confirm Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
