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

const STATUS_COLOR: Record<string, string> = {
    ACTIVE: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
    PAST_DUE: 'bg-amber-900/50  text-amber-300  border-amber-700',
    SUSPENDED: 'bg-red-900/50    text-red-300    border-red-700',
}

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        adminFetch('/api/admin/tenants')
            .then(r => r.json())
            .then(d => setTenants(d.data ?? []))
            .finally(() => setLoading(false))
    }, [])

    const filtered = tenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Tenants</h1>
                <Link
                    href="/admin/tenants/new"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                    + New Tenant
                </Link>
            </div>

            <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or code…"
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-full max-w-sm focus:outline-none focus:border-blue-500"
            />

            {loading ? (
                <p className="text-gray-500">Loading…</p>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-800 text-gray-400 text-left">
                                <th className="px-5 py-3 font-medium">Tenant</th>
                                <th className="px-5 py-3 font-medium">Status</th>
                                <th className="px-5 py-3 font-medium">Plan</th>
                                <th className="px-5 py-3 font-medium text-right">Wallet (LAK)</th>
                                <th className="px-5 py-3 font-medium">Expires</th>
                                <th className="px-5 py-3 font-medium"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {filtered.map(t => (
                                <tr key={t.id} className="hover:bg-gray-800/50 transition">
                                    <td className="px-5 py-4">
                                        <p className="font-medium text-white">{t.name}</p>
                                        <p className="text-gray-500 text-xs font-mono">{t.code}</p>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[t.status]}`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-gray-300">{t.activePlan?.name ?? <span className="text-gray-600">—</span>}</td>
                                    <td className="px-5 py-4 text-right font-mono text-white">{t.walletLAK.toLocaleString()}</td>
                                    <td className="px-5 py-4 text-gray-400 text-xs">
                                        {t.activeSubEndAt ? new Date(t.activeSubEndAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <Link href={`/admin/tenants/${t.id}`} className="text-blue-400 hover:text-blue-300 text-xs font-medium">
                                            View →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <p className="text-center text-gray-600 py-12">No tenants found</p>
                    )}
                </div>
            )}
        </div>
    )
}
