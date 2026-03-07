'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'

const fmt = (n: number) => n.toLocaleString()
const fmtDT = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

type Stats = {
    tenants: { total: number; active: number; suspended: number; pastDue: number }
    pendingTopups: number
    totalPlans: number
    totalWalletLAK: number
    recentTopups: {
        id: string
        amountLAK: number
        channel: string
        createdAt: string
        tenant: { name: string; code: string }
        user: { name: string }
    }[]
}

function KpiCard({ icon, label, value, sub, color }: {
    icon: string; label: string; value: string | number; sub?: string; color: string
}) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: 8,
            position: 'relative', overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute', top: -12, right: -12,
                width: 80, height: 80, borderRadius: '50%',
                background: color, opacity: 0.12,
            }} />
            <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: color, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 22,
                boxShadow: `0 4px 16px ${color}40`,
            }}>{icon}</div>
            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</p>
            <p style={{ color: '#f1f5f9', fontSize: '1.75rem', fontWeight: 800, lineHeight: 1 }}>{value}</p>
            {sub && <p style={{ color: '#475569', fontSize: '0.75rem' }}>{sub}</p>}
        </div>
    )
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadStats = () => {
        setLoading(true)
        setError(null)
        adminFetch('/api/admin/stats')
            .then(r => r.json())
            .then(d => {
                if (d.success) setStats(d.data)
                else setError(d.error || 'API returned error')
            })
            .catch(e => setError(e.message || 'Network error'))
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadStats() }, [])

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#475569' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
                <p>Loading dashboard...</p>
            </div>
        </div>
    )

    if (!stats) return (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
            <p style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>
                โหลดข้อมูลไม่สำเร็จ
            </p>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 20 }}>
                {error || 'ไม่สามารถเชื่อมต่อ API ได้'}
            </p>
            <button
                onClick={loadStats}
                style={{
                    padding: '8px 24px', borderRadius: 8, border: 'none',
                    background: '#6366f1', color: '#fff', fontWeight: 600,
                    cursor: 'pointer', fontSize: '0.9rem',
                }}
            >
                🔄 ลองอีกครั้ง
            </button>
        </div>
    )


    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
                    📊 Admin Dashboard
                </h1>
                <p style={{ color: '#475569', fontSize: '0.875rem' }}>
                    Overview ระบบทั้งหมด — อัปเดตเรียลไทม์
                </p>
            </div>

            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <KpiCard
                    icon="🏬"
                    label="ร้านค้า Active"
                    value={stats.tenants.active}
                    sub={`ทั้งหมด ${stats.tenants.total} ร้าน • ${stats.tenants.suspended} ถูก suspend`}
                    color="rgba(16,185,129,1)"
                />
                <KpiCard
                    icon="💰"
                    label="Wallet รวม (LAK)"
                    value={fmt(stats.totalWalletLAK)}
                    sub="ยอดรวม wallet ทุก tenant"
                    color="rgba(245,158,11,1)"
                />
                <KpiCard
                    icon="💳"
                    label="Topup รอ Approve"
                    value={stats.pendingTopups}
                    sub={stats.pendingTopups > 0 ? '⚠️ รอการตรวจสอบ' : '✅ ทุกรายการ clear'}
                    color={stats.pendingTopups > 0 ? 'rgba(239,68,68,1)' : 'rgba(99,102,241,1)'}
                />
                <KpiCard
                    icon="📦"
                    label="Plans"
                    value={stats.totalPlans}
                    sub="แผนบริการที่มีอยู่"
                    color="rgba(139,92,246,1)"
                />
            </div>

            {/* Tenant status breakdown */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '1rem' }}>🏬 Tenant Status</h2>
                    <Link href="/admin/tenants" style={{ color: '#6366f1', fontSize: '0.8rem', textDecoration: 'none' }}>ดูทั้งหมด →</Link>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Active', count: stats.tenants.active, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
                        { label: 'Past Due', count: stats.tenants.pastDue, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
                        { label: 'Suspended', count: stats.tenants.suspended, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
                    ].map(s => (
                        <div key={s.label} style={{
                            flex: 1, minWidth: 100,
                            background: s.bg, border: `1px solid ${s.border}`,
                            borderRadius: 12, padding: '1rem',
                            display: 'flex', flexDirection: 'column', gap: 4,
                        }}>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.count}</p>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Topups */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '1rem' }}>
                        💳 Topup รอ Approve
                        {stats.pendingTopups > 0 && (
                            <span style={{
                                marginLeft: 8, background: '#ef4444', color: '#fff',
                                fontSize: '0.65rem', fontWeight: 700,
                                padding: '2px 8px', borderRadius: 999,
                            }}>{stats.pendingTopups}</span>
                        )}
                    </h2>
                    <Link href="/admin/topups" style={{ color: '#6366f1', fontSize: '0.8rem', textDecoration: 'none' }}>จัดการทั้งหมด →</Link>
                </div>

                {stats.recentTopups.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                        <p>ไม่มี Topup ที่รอ approve</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {stats.recentTopups.map(t => (
                            <div key={t.id} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '0.875rem 1rem',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(245,158,11,0.2)',
                                borderRadius: 12,
                            }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: 'rgba(245,158,11,0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                                }}>💳</div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.875rem' }}>{t.tenant.name}</p>
                                    <p style={{ color: '#64748b', fontSize: '0.75rem' }}>{t.user.name} • {t.channel} • {fmtDT(t.createdAt)}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>+{fmt(t.amountLAK)}</p>
                                    <p style={{ color: '#475569', fontSize: '0.7rem' }}>LAK</p>
                                </div>
                                <Link
                                    href="/admin/topups"
                                    style={{
                                        background: 'rgba(245,158,11,0.15)',
                                        border: '1px solid rgba(245,158,11,0.3)',
                                        color: '#f59e0b', fontSize: '0.75rem',
                                        padding: '0.35rem 0.75rem', borderRadius: 8,
                                        textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap',
                                    }}
                                >Approve →</Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
