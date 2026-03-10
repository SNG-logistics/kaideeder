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
        id: string; amountLAK: number; channel: string; createdAt: string
        tenant: { name: string; code: string }; user: { name: string }
    }[]
}

const SZ = { width: 20, height: 20, flex: '0 0 20px' }

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadStats = () => {
        setLoading(true); setError(null)
        adminFetch('/api/admin/stats')
            .then(r => r.json())
            .then(d => { if (d.success) setStats(d.data); else setError(d.error || 'API error') })
            .catch(e => setError(e.message || 'Network error'))
            .finally(() => setLoading(false))
    }
    useEffect(() => { loadStats() }, [])

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-center">
                <svg style={{ width: 40, height: 40, flex: '0 0 40px' }} className="text-blue-500 animate-spin mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <p className="text-slate-500 text-sm">Loading dashboard...</p>
            </div>
        </div>
    )

    if (error || !stats) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg style={SZ} className="text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>
                <p className="text-red-400 font-semibold mb-1">โหลดข้อมูลไม่สำเร็จ</p>
                <p className="text-slate-500 text-sm mb-4">{error || 'ไม่สามารถเชื่อมต่อ API ได้'}</p>
                <button onClick={loadStats} className="inline-flex items-center gap-2 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/25 text-blue-400 text-sm font-semibold px-4 py-2 rounded-xl transition-all">
                    <svg style={{ width: 14, height: 14, flex: '0 0 14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    ลองอีกครั้ง
                </button>
            </div>
        </div>
    )

    const kpiCards = [
        {
            color: 'emerald', label: 'ร้านค้า Active', value: stats.tenants.active,
            sub: `ทั้งหมด ${stats.tenants.total} ร้าน · ${stats.tenants.suspended} ถูก suspend`,
            icon: (
                <svg style={SZ} className="text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9" />
                </svg>
            ),
            iconBg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.15)',
        },
        {
            color: 'amber', label: 'Wallet รวม (LAK)', value: fmt(stats.totalWalletLAK),
            sub: 'ยอดรวม wallet ทุก tenant',
            icon: (
                <svg style={SZ} className="text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 7v11a2 2 0 0 0 2 2h16v-5" />
                    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
                </svg>
            ),
            iconBg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.15)',
        },
        {
            color: stats.pendingTopups > 0 ? 'red' : 'blue',
            label: 'Topup รอ Approve', value: stats.pendingTopups,
            sub: stats.pendingTopups > 0 ? 'รอการตรวจสอบ' : 'ทุกรายการ clear แล้ว',
            icon: (
                <svg style={SZ} className={stats.pendingTopups > 0 ? 'text-red-400' : 'text-blue-400'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
                </svg>
            ),
            iconBg: stats.pendingTopups > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
            border: stats.pendingTopups > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.15)',
        },
        {
            color: 'violet', label: 'Plans', value: stats.totalPlans, sub: 'แผนบริการที่มีอยู่',
            icon: (
                <svg style={SZ} className="text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
            ),
            iconBg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.15)',
        },
    ]

    return (
        <div className="flex flex-col gap-7">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight mb-0.5">Admin Dashboard</h1>
                    <p className="text-sm text-slate-500">Overview ระบบทั้งหมด — อัปเดตเรียลไทม์</p>
                </div>
                <button onClick={loadStats} className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors px-3 py-2 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06]">
                    <svg style={{ width: 14, height: 14, flex: '0 0 14px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* ── KPI Cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpiCards.map(card => (
                    <div key={card.label} className="relative overflow-hidden rounded-2xl p-5 hover:bg-white/[0.05] transition-all" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${card.border}` }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: card.iconBg }}>
                            {card.icon}
                        </div>
                        <p className="text-[0.68rem] font-bold tracking-widest uppercase text-slate-500 mb-1">{card.label}</p>
                        <p className="text-3xl font-extrabold text-white leading-none mb-1">{card.value}</p>
                        {card.sub && <p className="text-xs text-slate-600 mt-1 leading-snug">{card.sub}</p>}
                        <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-30" style={{ background: card.iconBg }} />
                    </div>
                ))}
            </div>

            {/* ── Tenant Status ───────────────────────────────────────── */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="font-bold text-white text-base">Tenant Status</h2>
                        <p className="text-slate-500 text-xs mt-0.5">สถานะร้านค้าทั้งหมดในระบบ</p>
                    </div>
                    <Link href="/admin/tenants" className="text-blue-400 hover:text-blue-300 text-xs font-semibold transition-colors flex items-center gap-1">
                        ดูทั้งหมด
                        <svg style={{ width: 13, height: 13, flex: '0 0 13px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </Link>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Active', count: stats.tenants.active, bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', text: '#34d399' },
                        { label: 'Past Due', count: stats.tenants.pastDue, bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
                        { label: 'Suspended', count: stats.tenants.suspended, bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#f87171' },
                    ].map(s => (
                        <div key={s.label} className="flex flex-col items-center justify-center p-4 rounded-xl text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                            <p className="text-2xl md:text-3xl font-extrabold leading-none mb-1" style={{ color: s.text }}>{s.count}</p>
                            <p className="text-xs font-semibold text-slate-500">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Recent Topups ───────────────────────────────────────── */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="font-bold text-white text-base flex items-center gap-2">
                            Topup รอ Approve
                            {stats.pendingTopups > 0 && <span className="bg-red-500 text-white text-[0.62rem] font-bold px-2 py-0.5 rounded-full">{stats.pendingTopups}</span>}
                        </h2>
                        <p className="text-slate-500 text-xs mt-0.5">รายการล่าสุดที่รอการอนุมัติ</p>
                    </div>
                    <Link href="/admin/topups" className="text-blue-400 hover:text-blue-300 text-xs font-semibold transition-colors flex items-center gap-1">
                        จัดการทั้งหมด
                        <svg style={{ width: 13, height: 13, flex: '0 0 13px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </Link>
                </div>

                {stats.recentTopups.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <svg style={SZ} className="text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                        <p className="text-slate-400 text-sm font-medium">ไม่มี Topup ที่รอ approve</p>
                        <p className="text-slate-600 text-xs mt-1">ทุกรายการ clear แล้ว</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {stats.recentTopups.map(t => (
                            <div key={t.id} className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/[0.04] transition-colors" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
                                <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                                    <svg style={SZ} className="text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-semibold text-sm truncate">{t.tenant.name}</p>
                                    <p className="text-slate-500 text-xs truncate">{t.user.name} · {t.channel} · {fmtDT(t.createdAt)}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-emerald-400 font-bold font-mono text-sm">+{fmt(t.amountLAK)}</p>
                                    <p className="text-slate-600 text-[0.62rem] uppercase">LAK</p>
                                </div>
                                <Link href="/admin/topups" className="shrink-0 text-amber-400 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                                    Approve
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
