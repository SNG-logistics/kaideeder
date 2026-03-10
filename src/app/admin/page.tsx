'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'

const fmt = (n: number) => n.toLocaleString()
const fmtDT = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

type Stats = {
    tenants: { total: number; active: number; suspended: number; pastDue: number }
    pendingTopups: number; totalPlans: number; totalWalletLAK: number
    recentTopups: { id: string; amountLAK: number; channel: string; createdAt: string; tenant: { name: string; code: string }; user: { name: string } }[]
}

// ── Tiny SVG helper ───────────────────────────────────────────────────────────
function I({ size = 16, color = 'currentColor', children, vb = '0 0 24 24' }: { size?: number; color?: string; children: React.ReactNode; vb?: string }) {
    return <svg width={size} height={size} viewBox={vb} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>{children}</svg>
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ iconEl, label, value, sub, accent }: { iconEl: React.ReactNode; label: string; value: string | number; sub?: string; accent: string }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${accent}22`, borderRadius: 16, padding: '20px', position: 'relative', overflow: 'hidden', transition: 'background 0.15s' }}>
            {/* icon circle */}
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                {iconEl}
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1, marginBottom: 4 }}>{value}</div>
            {sub && <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>{sub}</div>}
            {/* glow */}
            <div style={{ position: 'absolute', top: -16, right: -16, width: 64, height: 64, borderRadius: '50%', background: `${accent}25`, filter: 'blur(20px)', pointerEvents: 'none' }} />
        </div>
    )
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = () => {
        setLoading(true); setError(null)
        adminFetch('/api/admin/stats').then(r => r.json())
            .then(d => { if (d.success) setStats(d.data); else setError(d.error || 'API error') })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }
    useEffect(() => { load() }, [])

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 12 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" style={{ animation: 'adminSpin 0.9s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading...</p>
            <style>{`@keyframes adminSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    if (error || !stats) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <I size={24} color="#f87171"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></I>
            </div>
            <p style={{ color: '#f87171', fontWeight: 600, fontSize: '0.9rem' }}>โหลดข้อมูลไม่สำเร็จ</p>
            <p style={{ color: '#64748b', fontSize: '0.8rem' }}>{error}</p>
            <button onClick={load} style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', color: '#93c5fd', borderRadius: 10, padding: '8px 16px', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                ลองอีกครั้ง
            </button>
        </div>
    )

    const kpis = [
        { label: 'ร้านค้า Active', value: stats.tenants.active, sub: `ทั้งหมด ${stats.tenants.total} ร้าน · ${stats.tenants.suspended} suspend`, accent: '#10b981', iconEl: <I size={20} color="#34d399"><path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9" /></I> },
        { label: 'Wallet รวม (LAK)', value: fmt(stats.totalWalletLAK), sub: 'ยอดรวมทุก tenant', accent: '#f59e0b', iconEl: <I size={20} color="#fbbf24"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 7v11a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" /></I> },
        { label: 'Topup รอ Approve', value: stats.pendingTopups, sub: stats.pendingTopups > 0 ? 'รอการตรวจสอบ' : 'ทุกรายการ clear แล้ว', accent: stats.pendingTopups > 0 ? '#ef4444' : '#3b82f6', iconEl: <I size={20} color={stats.pendingTopups > 0 ? '#f87171' : '#60a5fa'}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></I> },
        { label: 'Plans', value: stats.totalPlans, sub: 'แผนบริการที่มีอยู่', accent: '#8b5cf6', iconEl: <I size={20} color="#a78bfa"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></I> },
    ]

    const tenantStatus = [
        { label: 'Active', count: stats.tenants.active, color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
        { label: 'Past Due', count: stats.tenants.pastDue, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
        { label: 'Suspended', count: stats.tenants.suspended, color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
            <style>{`@keyframes adminSpin{to{transform:rotate(360deg)}}
                .admin-kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
                .admin-section { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07); border-radius: 18px; padding: 22px; }
                .admin-topup-row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: rgba(245,158,11,0.04); border: 1px solid rgba(245,158,11,0.12); border-radius: 12px; }
                @media(max-width:1100px){ .admin-kpi-grid { grid-template-columns: repeat(2,1fr) !important; } }
                @media(max-width:600px){ .admin-kpi-grid { grid-template-columns: 1fr !important; } .admin-section { padding: 16px !important; } .admin-topup-row { flex-wrap: wrap; } }
            `}</style>

            {/* ── Header ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>Admin Dashboard</h1>
                    <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '4px 0 0' }}>Overview ระบบทั้งหมด</p>
                </div>
                <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 14px', color: '#64748b', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                    <I size={13} color="currentColor"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></I>
                    Refresh
                </button>
            </div>

            {/* ── KPI Grid ─────────────────────────────────────────── */}
            <div className="admin-kpi-grid">
                {kpis.map(k => <KpiCard key={k.label} {...k} />)}
            </div>

            {/* ── Two-col row ─────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>

                {/* Tenant Status */}
                <div className="admin-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Tenant Status</h2>
                            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '2px 0 0' }}>สถานะร้านค้า</p>
                        </div>
                        <Link href="/admin/tenants" style={{ fontSize: '0.72rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>ดูทั้งหมด →</Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {tenantStatus.map(s => (
                            <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '10px 14px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>{s.label}</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Topups */}
                <div className="admin-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Topup รอ Approve</h2>
                            {stats.pendingTopups > 0 && <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>{stats.pendingTopups}</span>}
                        </div>
                        <Link href="/admin/topups" style={{ fontSize: '0.72rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>จัดการทั้งหมด →</Link>
                    </div>

                    {stats.recentTopups.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '28px 0' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                                <I size={22} color="#34d399"><polyline points="20 6 9 17 4 12" /></I>
                            </div>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>ไม่มี Topup ที่รอ approve</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {stats.recentTopups.map(t => (
                                <div key={t.id} className="admin-topup-row">
                                    <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <I size={18} color="#fbbf24"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></I>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.tenant.name}</p>
                                        <p style={{ color: '#64748b', fontSize: '0.72rem', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.user.name} · {t.channel} · {fmtDT(t.createdAt)}</p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ color: '#34d399', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.9rem', margin: 0 }}>+{fmt(t.amountLAK)}</p>
                                        <p style={{ color: '#475569', fontSize: '0.62rem', textTransform: 'uppercase', margin: '2px 0 0' }}>LAK</p>
                                    </div>
                                    <Link href="/admin/topups" style={{ flexShrink: 0, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}>
                                        Approve
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Responsive fix for 2-col */}
            <style>{`@media(max-width:900px){.admin-two-col{grid-template-columns:1fr !important;}}`}</style>
        </div>
    )
}
