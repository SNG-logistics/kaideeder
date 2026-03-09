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

function KpiCard({ icon, label, value, sub, colorClass, borderClass, bgClass, iconBgClass, shadowClass }: {
    icon: string; label: string; value: string | number; sub?: string;
    colorClass: string; borderClass: string; bgClass: string; iconBgClass: string; shadowClass: string;
}) {
    return (
        <div className={`relative overflow-hidden rounded-2xl p-5 md:p-6 bg-white/[0.03] border ${borderClass} flex flex-col gap-2`}>
            {/* Background decorative blob */}
            <div className={`absolute -top-3 -right-3 w-20 h-20 rounded-full ${bgClass} opacity-20 blur-xl`} />

            <div className={`w-11 h-11 rounded-xl ${iconBgClass} flex items-center justify-center text-[22px] ${shadowClass}`}>
                {icon}
            </div>

            <div className="mt-2 text-[0.7rem] md:text-xs font-bold tracking-wider uppercase text-slate-400">
                {label}
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-slate-100 leading-none">
                {value}
            </div>
            {sub && <div className="text-xs text-slate-500 mt-1 leading-tight">{sub}</div>}
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
        <div className="flex flex-col gap-6 md:gap-7">
            {/* Header */}
            <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-slate-100 mb-1">
                    📊 Admin Dashboard
                </h1>
                <p className="text-xs md:text-sm text-slate-400">
                    Overview ระบบทั้งหมด — อัปเดตเรียลไทม์
                </p>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    icon="🏬"
                    label="ร้านค้า Active"
                    value={stats.tenants.active}
                    sub={`ทั้งหมด ${stats.tenants.total} ร้าน • ${stats.tenants.suspended} ถูก suspend`}
                    colorClass="text-emerald-500" borderClass="border-emerald-500/20" bgClass="bg-emerald-500"
                    iconBgClass="bg-emerald-500/10" shadowClass="shadow-[0_4px_16px_rgba(16,185,129,0.2)]"
                />
                <KpiCard
                    icon="💰"
                    label="Wallet รวม (LAK)"
                    value={fmt(stats.totalWalletLAK)}
                    sub="ยอดรวม wallet ทุก tenant"
                    colorClass="text-amber-500" borderClass="border-amber-500/20" bgClass="bg-amber-500"
                    iconBgClass="bg-amber-500/10" shadowClass="shadow-[0_4px_16px_rgba(245,158,11,0.2)]"
                />
                <KpiCard
                    icon="💳"
                    label="Topup รอ Approve"
                    value={stats.pendingTopups}
                    sub={stats.pendingTopups > 0 ? '⚠️ รอการตรวจสอบ' : '✅ ทุกรายการ clear'}
                    colorClass={stats.pendingTopups > 0 ? 'text-red-500' : 'text-indigo-500'}
                    borderClass={stats.pendingTopups > 0 ? 'border-red-500/30' : 'border-indigo-500/20'}
                    bgClass={stats.pendingTopups > 0 ? 'bg-red-500' : 'bg-indigo-500'}
                    iconBgClass={stats.pendingTopups > 0 ? 'bg-red-500/10' : 'bg-indigo-500/10'}
                    shadowClass={stats.pendingTopups > 0 ? 'shadow-[0_4px_16px_rgba(239,68,68,0.3)]' : 'shadow-[0_4px_16px_rgba(99,102,241,0.2)]'}
                />
                <KpiCard
                    icon="📦"
                    label="Plans"
                    value={stats.totalPlans}
                    sub="แผนบริการที่มีอยู่"
                    colorClass="text-purple-500" borderClass="border-purple-500/20" bgClass="bg-purple-500"
                    iconBgClass="bg-purple-500/10" shadowClass="shadow-[0_4px_16px_rgba(139,92,246,0.2)]"
                />
            </div>

            {/* Tenant status breakdown */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-4 md:mb-5">
                    <h2 className="font-bold text-slate-200 text-sm md:text-base">🏬 Tenant Status</h2>
                    <Link href="/admin/tenants" className="text-indigo-400 hover:text-indigo-300 text-xs md:text-sm font-semibold transition-colors">ดูทั้งหมด →</Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    {[
                        { label: 'Active', count: stats.tenants.active, colorClass: 'text-emerald-500', borderClass: 'border-emerald-500/30', bgClass: 'bg-emerald-500/10' },
                        { label: 'Past Due', count: stats.tenants.pastDue, colorClass: 'text-amber-500', borderClass: 'border-amber-500/30', bgClass: 'bg-amber-500/10' },
                        { label: 'Suspended', count: stats.tenants.suspended, colorClass: 'text-red-500', borderClass: 'border-red-500/30', bgClass: 'bg-red-500/10' },
                    ].map(s => (
                        <div key={s.label} className={`flex flex-col gap-1 p-3 md:p-4 rounded-xl border ${s.bgClass} ${s.borderClass}`}>
                            <p className={`text-xl md:text-2xl font-extrabold ${s.colorClass}`}>{s.count}</p>
                            <p className="text-[0.7rem] md:text-xs font-semibold text-slate-400 capitalize">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Topups */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 md:p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4 md:mb-5">
                    <h2 className="font-bold text-slate-200 text-sm md:text-base flex items-center gap-2">
                        💳 Topup รอ Approve
                        {stats.pendingTopups > 0 && (
                            <span className="bg-red-500 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full">
                                {stats.pendingTopups}
                            </span>
                        )}
                    </h2>
                    <Link href="/admin/topups" className="text-indigo-400 hover:text-indigo-300 text-xs md:text-sm font-semibold transition-colors">จัดการทั้งหมด →</Link>
                </div>

                {stats.recentTopups.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <div className="text-3xl mb-2">✅</div>
                        <p className="text-sm">ไม่มี Topup ที่รอ approve</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {stats.recentTopups.map(t => (
                            <div key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 p-3.5 md:p-4 bg-white/[0.02] border border-amber-500/20 rounded-xl">
                                <div className="flex items-center gap-3 sm:flex-1">
                                    <div className="w-10 h-10 shrink-0 rounded-[10px] bg-amber-500/10 flex items-center justify-center text-lg">
                                        💳
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-slate-200 font-semibold text-sm truncate">{t.tenant.name}</p>
                                        <p className="text-slate-400 text-[0.7rem] md:text-xs truncate">{t.user.name} • {t.channel} • {fmtDT(t.createdAt)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-1 sm:mt-0 pl-13 sm:pl-0 border-t border-white/5 pt-2 sm:border-0 sm:pt-0">
                                    <div className="text-left sm:text-right">
                                        <p className="text-emerald-500 font-bold font-mono text-sm md:text-base">+{fmt(t.amountLAK)}</p>
                                        <p className="text-slate-500 text-[0.65rem] uppercase">LAK</p>
                                    </div>
                                    <Link
                                        href="/admin/topups"
                                        className="bg-amber-500/15 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors"
                                    >Approve →</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
