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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>🏬 Tenants</h1>
                    <p style={{ color: '#475569', fontSize: '0.875rem' }}>{tenants.length} ร้านค้าในระบบ</p>
                </div>
                <Link
                    href="/admin/tenants/new"
                    style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff', textDecoration: 'none',
                        fontSize: '0.875rem', fontWeight: 600,
                        padding: '0.6rem 1.25rem', borderRadius: 10,
                        boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                    }}
                >+ New Tenant</Link>
            </div>

            {/* Stats bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                    { label: 'Active', count: counts.ACTIVE, ...STATUS_STYLE.ACTIVE },
                    { label: 'Past Due', count: counts.PAST_DUE, ...STATUS_STYLE.PAST_DUE },
                    { label: 'Suspended', count: counts.SUSPENDED, ...STATUS_STYLE.SUSPENDED },
                ].map(s => (
                    <div key={s.label} style={{
                        background: s.bg, border: `1px solid ${s.border}`,
                        borderRadius: 12, padding: '1rem',
                        display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.dot, boxShadow: `0 0 8px ${s.dot}` }} />
                        <div>
                            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color }}>{s.count}</p>
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter + Search */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            style={{
                                border: 'none', cursor: 'pointer',
                                padding: '0.4rem 0.875rem', borderRadius: 7,
                                fontSize: '0.78rem', fontWeight: tab === t.key ? 700 : 400,
                                background: tab === t.key ? `${t.color}25` : 'transparent',
                                color: tab === t.key ? t.color : '#64748b',
                                transition: 'all 0.15s',
                            }}
                        >{t.label}</button>
                    ))}
                </div>
                {/* Search */}
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 ค้นหาชื่อหรือ code..."
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10, padding: '0.5rem 1rem',
                        color: '#e2e8f0', fontSize: '0.875rem',
                        outline: 'none', minWidth: 220,
                    }}
                />
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>⏳ Loading...</div>
            ) : (
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16, overflow: 'hidden',
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                {['Tenant', 'Status', 'Plan', 'Wallet (LAK)', 'Expires', 'Actions'].map(h => (
                                    <th key={h} style={{
                                        padding: '0.875rem 1.25rem', textAlign: h === 'Wallet (LAK)' ? 'right' : 'left',
                                        color: '#475569', fontWeight: 600, fontSize: '0.75rem',
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#334155' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                                    <p>ไม่พบ tenant</p>
                                </td></tr>
                            ) : filtered.map(t => {
                                const s = STATUS_STYLE[t.status]
                                return (
                                    <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <td style={{ padding: '1rem 1.25rem' }}>
                                            <p style={{ color: '#f1f5f9', fontWeight: 600 }}>{t.name}</p>
                                            <p style={{ color: '#475569', fontSize: '0.75rem', fontFamily: 'monospace' }}>{t.code}</p>
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                padding: '0.25rem 0.75rem', borderRadius: 999,
                                                fontSize: '0.75rem', fontWeight: 700,
                                                color: s.color, background: s.bg, border: `1px solid ${s.border}`,
                                            }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
                                                {t.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', color: '#94a3b8' }}>
                                            {t.activePlan?.name ?? <span style={{ color: '#334155' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right', fontFamily: 'monospace', color: '#e2e8f0', fontWeight: 600 }}>
                                            {fmt(t.walletLAK)}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem', color: '#64748b', fontSize: '0.8rem' }}>
                                            {t.activeSubEndAt ? new Date(t.activeSubEndAt).toLocaleDateString('th-TH') : '—'}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem' }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <Link href={`/admin/tenants/${t.id}`} style={{
                                                    color: '#6366f1', fontSize: '0.78rem', fontWeight: 600,
                                                    textDecoration: 'none', padding: '0.3rem 0.75rem',
                                                    background: 'rgba(99,102,241,0.1)', borderRadius: 7,
                                                    border: '1px solid rgba(99,102,241,0.2)',
                                                }}>View</Link>
                                                <button
                                                    onClick={() => toggleSuspend(t)}
                                                    disabled={suspending === t.id}
                                                    style={{
                                                        border: 'none', cursor: 'pointer',
                                                        fontSize: '0.78rem', fontWeight: 600,
                                                        padding: '0.3rem 0.75rem', borderRadius: 7,
                                                        background: t.status === 'SUSPENDED' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                        color: t.status === 'SUSPENDED' ? '#10b981' : '#ef4444',
                                                        opacity: suspending === t.id ? 0.5 : 1,
                                                    }}
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
