'use client'
import { useEffect, useState, useCallback } from 'react'
import { adminFetch } from '@/lib/admin-fetch'

type Log = {
    id: string
    actorType: 'ADMIN' | 'TENANT_USER'
    action: string
    createdAt: string
    ip: string | null
    payload: any
    admin: { name: string; role: string } | null
    user: { name: string; username: string } | null
    tenant: { code: string; name: string } | null
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<Log[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [action, setAction] = useState('')
    const [tenantId, setTenantId] = useState('')
    const [expanded, setExpanded] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams({ page: String(page), limit: '50' })
        if (action) params.set('action', action)
        if (tenantId) params.set('tenantId', tenantId)
        const res = await adminFetch(`/api/admin/audit-logs?${params}`)
        const d = await res.json()
        setLogs(d.data?.logs ?? [])
        setTotal(d.data?.total ?? 0)
        setLoading(false)
    }, [page, action, tenantId])

    useEffect(() => { load() }, [load])

    const ACTION_COLOR: Record<string, string> = {
        APPROVE_TOPUP: 'bg-emerald-900/40 text-emerald-300',
        REJECT_TOPUP: 'bg-red-900/40 text-red-300',
        BILLING_PAST_DUE: 'bg-amber-900/40 text-amber-300',
        BILLING_SUSPENDED: 'bg-red-900/40 text-red-400',
        BILLING_AUTO_RENEW: 'bg-blue-900/40 text-blue-300',
        CREATE_TENANT: 'bg-purple-900/40 text-purple-300',
        SET_TENANT_STATUS_SUSPENDED: 'bg-red-900/40 text-red-300',
    }

    const pages = Math.ceil(total / 50)

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Audit Logs <span className="text-gray-500 text-base font-normal">({total.toLocaleString()} total)</span></h1>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <input
                    placeholder="Filter by action (e.g. APPROVE_TOPUP)"
                    value={action}
                    onChange={e => { setAction(e.target.value); setPage(1) }}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-72 focus:outline-none focus:border-blue-500"
                />
                <input
                    placeholder="Filter by Tenant ID"
                    value={tenantId}
                    onChange={e => { setTenantId(e.target.value); setPage(1) }}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-64 focus:outline-none focus:border-blue-500"
                />
                <button onClick={load} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition">
                    Refresh
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <p className="text-gray-500">Loading…</p>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-800 text-gray-400 text-left">
                                <th className="px-4 py-3 font-medium">Time</th>
                                <th className="px-4 py-3 font-medium">Action</th>
                                <th className="px-4 py-3 font-medium">Actor</th>
                                <th className="px-4 py-3 font-medium">Tenant</th>
                                <th className="px-4 py-3 font-medium">Payload</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {logs.map(log => (
                                <>
                                    <tr key={log.id} className="hover:bg-gray-800/50 cursor-pointer" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                                            {new Date(log.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-mono font-semibold ${ACTION_COLOR[log.action] ?? 'bg-gray-800 text-gray-300'}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-300 text-xs">
                                            {log.admin
                                                ? <span>{log.admin.name} <span className="text-gray-600">({log.admin.role})</span></span>
                                                : log.user
                                                    ? <span>{log.user.name} <span className="text-gray-600">(@{log.user.username})</span></span>
                                                    : <span className="text-gray-600">system</span>}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-400">
                                            {log.tenant ? <span>{log.tenant.name} <span className="text-gray-600 font-mono">{log.tenant.code}</span></span> : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600">
                                            {expanded === log.id ? '▲ collapse' : '▶ expand'}
                                        </td>
                                    </tr>
                                    {expanded === log.id && (
                                        <tr key={`${log.id}-payload`} className="bg-gray-950">
                                            <td colSpan={5} className="px-6 py-4">
                                                <pre className="text-xs text-gray-300 overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                                                    {JSON.stringify(log.payload, null, 2)}
                                                </pre>
                                                {log.ip && <p className="text-xs text-gray-600 mt-2">IP: {log.ip}</p>}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                    {logs.length === 0 && <p className="text-center text-gray-600 py-12">No logs found</p>}
                </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded disabled:opacity-40 text-sm">← Prev</button>
                    <span className="text-gray-500 text-sm">Page {page} / {pages}</span>
                    <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                        className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded disabled:opacity-40 text-sm">Next →</button>
                </div>
            )}
        </div>
    )
}
