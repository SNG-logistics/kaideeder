'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'

// ─── Types ────────────────────────────────────────────────────────────────────
type Plan = { id: string; code: string; name: string; priceLAK: number; durationDays: number }

type Sub = {
    id: string
    startAt: string
    endAt: string
    status: 'ACTIVE' | 'ENDED' | 'CANCELLED'
    autoRenew: boolean
    plan: Plan
}

type LedgerRow = {
    id: string
    type: string
    amountLAK: number
    note: string | null
    createdAt: string
}

type Tenant = {
    id: string
    code: string
    name: string
    status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED'
    subEndsAt: string | null
    graceEndsAt: string | null
    createdAt: string
    wallet: { balanceLAK: number; ledger: LedgerRow[] } | null
    subs: Sub[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
    PAST_DUE: 'bg-amber-900/50  text-amber-300  border-amber-700',
    SUSPENDED: 'bg-red-900/50    text-red-300    border-red-700',
}
const SUB_COLOR: Record<string, string> = {
    ACTIVE: 'text-emerald-400',
    ENDED: 'text-gray-500',
    CANCELLED: 'text-red-400',
}
const LEDGER_COLOR: Record<string, string> = {
    TOPUP: 'text-emerald-400',
    RENT_FEE: 'text-red-400',
    ADJUST: 'text-blue-400',
    REFUND: 'text-amber-400',
}
const fmt = (n: number) => n.toLocaleString()
const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { dateStyle: 'medium' })
const fmtDT = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TenantDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    // change-status modal state
    const [newStatus, setNewStatus] = useState<'ACTIVE' | 'SUSPENDED' | ''>('')
    const [note, setNote] = useState('')

    // grant-plan modal
    const [showPlan, setShowPlan] = useState(false)
    const [selectedPlan, setSelectedPlan] = useState('')
    const [planDays, setPlanDays] = useState(30)

    const load = useCallback(async () => {
        setLoading(true)
        const [tRes, pRes] = await Promise.all([
            adminFetch(`/api/admin/tenants/${id}`),
            adminFetch('/api/admin/plans'),
        ])
        const tData = await tRes.json()
        const pData = await pRes.json()
        setTenant(tData.data ?? null)
        setPlans(pData.data ?? [])
        setLoading(false)
    }, [id])

    useEffect(() => { load() }, [load])

    // ── Change status ────────────────────────────────────────────────────────
    async function handleStatusChange() {
        if (!newStatus) return
        setSaving(true)
        const res = await fetch(`/api/admin/tenants/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, note }),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            setMsg({ ok: true, text: `Status changed to ${newStatus}` })
            setNewStatus('')
            setNote('')
            load()
        } else {
            setMsg({ ok: false, text: d.error ?? 'Error' })
        }
    }

    // ── Grant plan (create new subscription via PATCH subEndsAt) ────────────
    async function handleGrantPlan() {
        if (!selectedPlan) return
        const plan = plans.find(p => p.id === selectedPlan)
        if (!plan) return
        setSaving(true)
        const endAt = new Date(Date.now() + planDays * 86400_000).toISOString()
        const res = await fetch(`/api/admin/tenants/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subEndsAt: endAt, status: 'ACTIVE', note: `Grant plan ${plan.code} for ${planDays}d` }),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            setMsg({ ok: true, text: `Plan updated — expires ${fmtDate(endAt)}` })
            setShowPlan(false)
            load()
        } else {
            setMsg({ ok: false, text: d.error ?? 'Error' })
        }
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    if (loading) return <p className="text-gray-500 p-8">Loading…</p>
    if (!tenant) return <p className="text-red-400 p-8">Tenant not found</p>

    const activeSub = tenant.subs.find(s => s.status === 'ACTIVE')

    return (
        <div className="space-y-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link href="/admin/tenants" className="hover:text-white transition">Tenants</Link>
                <span>/</span>
                <span className="text-white font-medium">{tenant.name}</span>
            </div>

            {/* Toast */}
            {msg && (
                <div className={`px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                    {msg.text}
                    <button onClick={() => setMsg(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
                </div>
            )}

            {/* ── Header card ─────────────────────────────────────────────────── */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">{tenant.name}</h1>
                    <p className="text-gray-500 font-mono text-sm">{tenant.code}</p>
                    <p className="text-gray-600 text-xs">Created {fmtDate(tenant.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${STATUS_COLOR[tenant.status]}`}>
                        {tenant.status}
                    </span>
                    {/* Change status */}
                    <div className="flex items-center gap-2">
                        <select
                            value={newStatus}
                            onChange={e => setNewStatus(e.target.value as any)}
                            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
                        >
                            <option value="">Change status…</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                            <option value="PAST_DUE">PAST_DUE</option>
                        </select>
                        {newStatus && (
                            <button
                                onClick={handleStatusChange}
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition"
                            >
                                {saving ? '…' : 'Apply'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Info grid ───────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Wallet */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Wallet Balance</p>
                    <p className="text-3xl font-bold text-white">
                        {fmt(tenant.wallet?.balanceLAK ?? 0)}
                        <span className="text-sm text-gray-500 ml-1">LAK</span>
                    </p>
                </div>
                {/* Active plan */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active Plan</p>
                    <p className="text-xl font-semibold text-white">{activeSub?.plan.name ?? <span className="text-gray-600">No plan</span>}</p>
                    {activeSub && <p className="text-xs text-gray-500 mt-1">Expires {fmtDate(activeSub.endAt)}</p>}
                    <button
                        onClick={() => setShowPlan(true)}
                        className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition"
                    >
                        + Grant / extend plan
                    </button>
                </div>
                {/* Grace */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Grace Ends At</p>
                    <p className="text-xl font-semibold text-white">
                        {tenant.graceEndsAt ? fmtDate(tenant.graceEndsAt) : <span className="text-gray-600">—</span>}
                    </p>
                    {tenant.subEndsAt && <p className="text-xs text-gray-500 mt-1">Sub ends {fmtDate(tenant.subEndsAt)}</p>}
                </div>
            </div>

            {/* ── Grant plan modal (inline) ──────────────────────────────────── */}
            {showPlan && (
                <div className="bg-gray-900 border border-blue-700 rounded-xl p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Grant / Extend Plan</h2>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Plan</label>
                            <select
                                value={selectedPlan}
                                onChange={e => setSelectedPlan(e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Select plan…</option>
                                {plans.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} — {fmt(p.priceLAK)} LAK / {p.durationDays}d</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Duration (days)</label>
                            <input
                                type="number" min={1} max={3650}
                                value={planDays}
                                onChange={e => setPlanDays(Number(e.target.value))}
                                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-28 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleGrantPlan}
                                disabled={!selectedPlan || saving}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
                            >
                                {saving ? '…' : 'Confirm'}
                            </button>
                            <button
                                onClick={() => setShowPlan(false)}
                                className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Subscription history ────────────────────────────────────────── */}
            <section>
                <h2 className="text-lg font-semibold mb-3">Subscription History</h2>
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-800 text-gray-400 text-left">
                                <th className="px-5 py-3 font-medium">Plan</th>
                                <th className="px-5 py-3 font-medium">Start</th>
                                <th className="px-5 py-3 font-medium">End</th>
                                <th className="px-5 py-3 font-medium">Auto-renew</th>
                                <th className="px-5 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {tenant.subs.length === 0 ? (
                                <tr><td colSpan={5} className="text-center text-gray-600 py-10">No subscriptions</td></tr>
                            ) : tenant.subs.map(s => (
                                <tr key={s.id} className="hover:bg-gray-800/30">
                                    <td className="px-5 py-3 font-medium">{s.plan.name}
                                        <span className="ml-2 text-xs text-gray-500 font-mono">{s.plan.code}</span>
                                    </td>
                                    <td className="px-5 py-3 text-gray-400 text-xs">{fmtDate(s.startAt)}</td>
                                    <td className="px-5 py-3 text-gray-400 text-xs">{fmtDate(s.endAt)}</td>
                                    <td className="px-5 py-3 text-xs">{s.autoRenew ? '✅' : '—'}</td>
                                    <td className={`px-5 py-3 text-xs font-semibold ${SUB_COLOR[s.status]}`}>{s.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── Wallet ledger ───────────────────────────────────────────────── */}
            <section>
                <h2 className="text-lg font-semibold mb-3">Wallet Ledger <span className="text-gray-500 text-sm font-normal">(last 50)</span></h2>
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-800 text-gray-400 text-left">
                                <th className="px-5 py-3 font-medium">Time</th>
                                <th className="px-5 py-3 font-medium">Type</th>
                                <th className="px-5 py-3 font-medium text-right">Amount (LAK)</th>
                                <th className="px-5 py-3 font-medium">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {(tenant.wallet?.ledger?.length ?? 0) === 0 ? (
                                <tr><td colSpan={4} className="text-center text-gray-600 py-10">No transactions</td></tr>
                            ) : tenant.wallet!.ledger.map(row => (
                                <tr key={row.id} className="hover:bg-gray-800/30">
                                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDT(row.createdAt)}</td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-mono font-semibold ${LEDGER_COLOR[row.type] ?? 'text-gray-300'}`}>{row.type}</span>
                                    </td>
                                    <td className={`px-5 py-3 text-right font-mono font-semibold ${row.amountLAK >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {row.amountLAK >= 0 ? '+' : ''}{fmt(row.amountLAK)}
                                    </td>
                                    <td className="px-5 py-3 text-gray-500 text-xs">{row.note ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Back */}
            <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-white transition">← Back</button>
        </div>
    )
}
