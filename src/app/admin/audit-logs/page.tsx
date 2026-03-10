'use client'
import { useEffect, useState, useCallback } from 'react'
import { adminFetch } from '@/lib/admin-fetch'

type Log = {
    id: string; actorType: 'ADMIN' | 'TENANT_USER'; action: string
    createdAt: string; ip: string | null; payload: any
    admin: { name: string; role: string } | null
    user: { name: string; username: string } | null
    tenant: { code: string; name: string } | null
}

const ACTION_STYLE: Record<string, { color: string; bg: string; border: string }> = {
    APPROVE_TOPUP: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
    REJECT_TOPUP: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
    BILLING_PAST_DUE: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
    BILLING_SUSPENDED: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
    BILLING_AUTO_RENEW: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
    CREATE_TENANT: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
    SET_TENANT_STATUS_SUSPENDED: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
}
const DEFAULT_STYLE = { color: '#94a3b8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' }

const fmtDT = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
const IS = (w?: number): React.CSSProperties => ({ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 14px', fontSize: '0.82rem', color: '#e2e8f0', outline: 'none', fontFamily: 'inherit', width: w ? `${w}px` : '100%' })

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

    const pages = Math.ceil(total / 50)
    const CARD: React.CSSProperties = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18 }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontFamily: "'Inter',system-ui,sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
                        Audit Logs <span style={{ fontSize: '1rem', fontWeight: 400, color: '#64748b' }}>({total.toLocaleString()} total)</span>
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '4px 0 0' }}>ประวัติการกระทำทั้งหมดในระบบ</p>
                </div>
                <button onClick={load} style={{ ...IS(), width: 'auto', padding: '9px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ display: 'block' }}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                    Refresh
                </button>
            </div>

            {/* Filters Card */}
            <div style={{ ...CARD, padding: '18px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Action filter</p>
                    <input placeholder="เช่น APPROVE_TOPUP" value={action}
                        onChange={e => { setAction(e.target.value); setPage(1) }}
                        style={IS(240)}
                        onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                    />
                </div>
                <div>
                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Tenant ID</p>
                    <input placeholder="Tenant ID" value={tenantId}
                        onChange={e => { setTenantId(e.target.value); setPage(1) }}
                        style={IS(200)}
                        onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                        onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                    />
                </div>
            </div>

            {/* Table Card */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>Loading...</div>
            ) : (
                <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['Time', 'Action', 'Actor', 'Tenant', ''].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#475569', textAlign: 'left' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '0.85rem' }}>No logs found</td></tr>
                                ) : logs.map(log => {
                                    const s = ACTION_STYLE[log.action] ?? DEFAULT_STYLE
                                    const isOpen = expanded === log.id
                                    return (
                                        <>
                                            <tr key={log.id} onClick={() => setExpanded(isOpen ? null : log.id)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.12s' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{fmtDT(log.createdAt)}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                    {log.admin
                                                        ? <span>{log.admin.name} <span style={{ color: '#475569' }}>({log.admin.role})</span></span>
                                                        : log.user ? <span>{log.user.name} <span style={{ color: '#475569' }}>@{log.user.username}</span></span>
                                                            : <span style={{ color: '#334155' }}>system</span>}
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#64748b' }}>
                                                    {log.tenant ? <span>{log.tenant.name} <span style={{ fontFamily: 'monospace', color: '#334155' }}>{log.tenant.code}</span></span> : '—'}
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '0.72rem', color: '#334155' }}>
                                                    {isOpen ? '▲' : '▶'}
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr key={`${log.id}-p`}>
                                                    <td colSpan={5} style={{ padding: '4px 16px 16px', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                        <pre style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace', margin: 0, overflowX: 'auto', maxHeight: '150px', whiteSpace: 'pre-wrap', lineHeight: 1.6, padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                                                            {JSON.stringify(log.payload, null, 2)}
                                                        </pre>
                                                        {log.ip && <p style={{ fontSize: '0.72rem', color: '#475569', margin: '8px 0 0' }}>IP: {log.ip}</p>}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        style={{ ...IS(), width: 'auto', padding: '7px 14px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>← Prev</button>
                    <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Page {page} / {pages}</span>
                    <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                        style={{ ...IS(), width: 'auto', padding: '7px 14px', cursor: page === pages ? 'not-allowed' : 'pointer', opacity: page === pages ? 0.4 : 1 }}>Next →</button>
                </div>
            )}
        </div>
    )
}
