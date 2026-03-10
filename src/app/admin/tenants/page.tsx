'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'

type Tenant = {
    id: string
    code: string
    name: string
    status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED'
    walletLAK: number
    activePlan: { code: string; name: string } | null
    activeSubEndAt: string | null
}

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; dot: string }> = {
    ACTIVE: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', dot: '#10b981' },
    PAST_DUE: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', dot: '#f59e0b' },
    SUSPENDED: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', dot: '#ef4444' },
}
const fmt = (n: number) => n.toLocaleString()

type Tab = 'ALL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED'

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [tab, setTab] = useState<Tab>('ALL')
    const [suspending, setSuspending] = useState<string | null>(null)

    async function load() {
        setLoading(true)
        const res = await adminFetch('/api/admin/tenants')
        const d = await res.json()
        setTenants(d.data ?? [])
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    async function toggleSuspend(t: Tenant) {
        const next = t.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
        if (!confirm(`${next === 'SUSPENDED' ? 'Suspend' : 'Activate'} ร้าน "${t.name}"?`)) return
        setSuspending(t.id)
        await adminFetch(`/api/admin/tenants/${t.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: next, note: `Manual ${next.toLowerCase()} from admin` }),
        })
        setSuspending(null)
        load()
    }

    const counts = {
        ALL: tenants.length,
        ACTIVE: tenants.filter(t => t.status === 'ACTIVE').length,
        PAST_DUE: tenants.filter(t => t.status === 'PAST_DUE').length,
        SUSPENDED: tenants.filter(t => t.status === 'SUSPENDED').length,
    }

    const filtered = tenants.filter(t => {
        const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.code.toLowerCase().includes(search.toLowerCase())
        const matchTab = tab === 'ALL' || t.status === tab
        return matchSearch && matchTab
    })

    const TABS: { key: Tab; label: string; color: string }[] = [
        { key: 'ALL', label: `All (${counts.ALL})`, color: '#6366f1' },
        { key: 'ACTIVE', label: `✅ Active (${counts.ACTIVE})`, color: '#10b981' },
        { key: 'PAST_DUE', label: `⚠️ Past Due (${counts.PAST_DUE})`, color: '#f59e0b' },
        { key: 'SUSPENDED', label: `🚫 Suspended (${counts.SUSPENDED})`, color: '#ef4444' },
    ]

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-100 mb-1">🏬 Tenants</h1>
                    <p className="text-slate-400 text-sm">{tenants.length} ร้านค้าในระบบ</p>
                </div>
                <Link
                    href="/admin/tenants/new"
                    className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition hover:opacity-90"
                >+ New Tenant</Link>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Active', count: counts.ACTIVE, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
                    { label: 'Past Due', count: counts.PAST_DUE, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-500' },
                    { label: 'Suspended', count: counts.SUSPENDED, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' },
                ].map(s => (
                    <div key={s.label} className={`border rounded-xl p-4 flex items-center gap-4 ${s.bg} ${s.border}`}>
                        <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px] ${s.dot}`} style={{ boxShadow: `0 0 8px currentColor` }} />
                        <div>
                            <p className={`text-xl font-extrabold leading-tight ${s.color}`}>{s.count}</p>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter + Search */}
            <div className="flex gap-3 flex-wrap items-center">
                {/* Tabs */}
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs transition-all ${tab === t.key ? 'font-bold bg-white/10' : 'text-slate-400 hover:text-slate-200'}`}
                            style={tab === t.key ? { color: t.color } : {}}
                        >{t.label}</button>
                    ))}
                </div>
                {/* Search */}
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 ค้นหาชื่อหรือ code..."
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-slate-200 text-sm outline-none w-full md:w-auto min-w-[220px] focus:border-indigo-500 transition"
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center py-12 text-slate-400">⏳ Loading...</div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-x-auto">
                    <table className="w-full text-sm min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/10">
                                {['Tenant', 'Status', 'Plan', 'Wallet (LAK)', 'Expires', 'Actions'].map(h => (
                                    <th key={h} className={`py-3.5 px-5 text-slate-400 font-semibold text-xs tracking-wider uppercase ${h === 'Wallet (LAK)' ? 'text-right' : 'text-left'}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-slate-500">
                                    <div className="text-3xl mb-2">🔍</div>
                                    <p>ไม่พบ tenant</p>
                                </td></tr>
                            ) : filtered.map(t => {
                                const s = STATUS_STYLE[t.status]
                                return (
                                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                                        <td className="py-4 px-5">
                                            <p className="text-slate-100 font-semibold">{t.name}</p>
                                            <p className="text-slate-400 text-xs font-mono">{t.code}</p>
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border" style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}>
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-5 text-slate-400">
                                            {t.activePlan?.name ?? <span className="text-slate-600">—</span>}
                                        </td>
                                        <td className="py-4 px-5 text-right font-mono text-slate-200 font-semibold">
                                            {fmt(t.walletLAK)}
                                        </td>
                                        <td className="py-4 px-5 text-slate-500 text-xs text-nowrap">
                                            {t.activeSubEndAt ? new Date(t.activeSubEndAt).toLocaleDateString('th-TH') : '—'}
                                        </td>
                                        <td className="py-4 px-5">
                                            <div className="flex gap-2 items-center">
                                                <Link href={`/admin/tenants/${t.id}`} className="text-indigo-400 text-xs font-semibold px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition">
                                                    View
                                                </Link>
                                                <button
                                                    onClick={() => toggleSuspend(t)}
                                                    disabled={suspending === t.id}
                                                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${t.status === 'SUSPENDED'
                                                            ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                                                            : 'text-red-500 bg-red-500/10 border-red-500/20 hover:bg-red-500/20'
                                                        } ${suspending === t.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {suspending === t.id ? '...' : t.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
