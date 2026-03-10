'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'

type Tenant = {
    id: string; code: string; name: string
    status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED'
    walletLAK: number
    activePlan: { code: string; name: string } | null
    activeSubEndAt: string | null
}

const STATUS: Record<string, { color: string; bg: string; border: string; dot: string; label: string }> = {
    ACTIVE: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', dot: '#10b981', label: 'Active' },
    PAST_DUE: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', dot: '#f59e0b', label: 'Past Due' },
    SUSPENDED: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', dot: '#ef4444', label: 'Suspended' },
}
const fmt = (n: number) => n.toLocaleString()
type Tab = 'ALL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED'

// shared input style
const IS = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 14px', fontSize: '0.85rem', color: '#e2e8f0', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }

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
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: next, note: `Manual ${next.toLowerCase()} from admin` }),
        })
        setSuspending(null); load()
    }

    const counts = {
        ALL: tenants.length,
        ACTIVE: tenants.filter(t => t.status === 'ACTIVE').length,
        PAST_DUE: tenants.filter(t => t.status === 'PAST_DUE').length,
        SUSPENDED: tenants.filter(t => t.status === 'SUSPENDED').length,
    }
    const filtered = tenants.filter(t => {
        const m = t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase())
        return m && (tab === 'ALL' || t.status === tab)
    })

    const TABS = [
        { key: 'ALL' as Tab, label: `All (${counts.ALL})`, color: '#6366f1' },
        { key: 'ACTIVE' as Tab, label: `Active (${counts.ACTIVE})`, color: '#10b981' },
        { key: 'PAST_DUE' as Tab, label: `Past Due (${counts.PAST_DUE})`, color: '#f59e0b' },
        { key: 'SUSPENDED' as Tab, label: `Suspended (${counts.SUSPENDED})`, color: '#ef4444' },
    ]

    const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '20px 22px' }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontFamily: "'Inter',system-ui,sans-serif" }}>
            <style>{`@media(max-width:600px){.tenant-table-wrap{overflow-x:auto;}}`}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>Tenants</h1>
                    <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '4px 0 0' }}>{tenants.length} ร้านค้าในระบบ</p>
                </div>
                <Link href="/admin/tenants/new" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 11, textDecoration: 'none', boxShadow: '0 4px 12px rgba(99,102,241,0.35)', whiteSpace: 'nowrap' }}>
                    + New Tenant
                </Link>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {([['ACTIVE', '#10b981'], ['PAST_DUE', '#f59e0b'], ['SUSPENDED', '#ef4444']] as [Tab, string][]).map(([k, color]) => (
                    <div key={k} style={{ background: `${color}12`, border: `1px solid ${color}28`, borderRadius: 16, padding: '16px 20px', cursor: 'pointer' }} onClick={() => setTab(tab === k ? 'ALL' : k)}>
                        <p style={{ fontSize: '2rem', fontWeight: 900, color, lineHeight: 1, margin: 0 }}>{counts[k]}</p>
                        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', margin: '4px 0 0' }}>{STATUS[k].label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{
                            border: 'none', cursor: 'pointer', borderRadius: 9,
                            padding: '6px 14px', fontSize: '0.78rem', fontFamily: 'inherit',
                            fontWeight: tab === t.key ? 700 : 400,
                            background: tab === t.key ? `${t.color}20` : 'transparent',
                            color: tab === t.key ? t.color : '#64748b', transition: 'all 0.12s',
                        }}>{t.label}</button>
                    ))}
                </div>
                {/* Search */}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อหรือ code..."
                    style={{ ...IS, width: 220 }}
                    onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
                <button onClick={load} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '9px 14px', color: '#64748b', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Refresh
                </button>
            </div>

            {/* Table Card */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>Loading...</div>
            ) : (
                <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
                    <div className="tenant-table-wrap">
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['Tenant', 'Status', 'Plan', 'Wallet (LAK)', 'Expires', 'Actions'].map((h, i) => (
                                        <th key={h} style={{ padding: '13px 18px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#475569', textAlign: i === 3 ? 'right' : 'left' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '0.85rem' }}>ไม่พบ tenant</td></tr>
                                ) : filtered.map(t => {
                                    const s = STATUS[t.status]
                                    return (
                                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.12s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                            <td style={{ padding: '14px 18px' }}>
                                                <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{t.name}</p>
                                                <p style={{ color: '#475569', fontSize: '0.72rem', fontFamily: 'monospace', margin: '2px 0 0' }}>{t.code}</p>
                                            </td>
                                            <td style={{ padding: '14px 18px' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                                                    {s.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '0.85rem' }}>{t.activePlan?.name ?? '—'}</td>
                                            <td style={{ padding: '14px 18px', textAlign: 'right', fontFamily: 'monospace', color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>{fmt(t.walletLAK)}</td>
                                            <td style={{ padding: '14px 18px', color: '#475569', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                                {t.activeSubEndAt ? new Date(t.activeSubEndAt).toLocaleDateString('th-TH') : '—'}
                                            </td>
                                            <td style={{ padding: '14px 18px' }}>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <Link href={`/admin/tenants/${t.id}`} style={{ color: '#6366f1', fontSize: '0.75rem', fontWeight: 600, padding: '5px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, textDecoration: 'none' }}>
                                                        View
                                                    </Link>
                                                    <button
                                                        onClick={() => toggleSuspend(t)}
                                                        disabled={suspending === t.id}
                                                        style={{ fontSize: '0.75rem', fontWeight: 600, padding: '5px 12px', borderRadius: 8, cursor: suspending === t.id ? 'not-allowed' : 'pointer', opacity: suspending === t.id ? 0.5 : 1, fontFamily: 'inherit', border: `1px solid ${t.status === 'SUSPENDED' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, background: t.status === 'SUSPENDED' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: t.status === 'SUSPENDED' ? '#10b981' : '#ef4444' }}
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
                </div>
            )}
        </div>
    )
}
