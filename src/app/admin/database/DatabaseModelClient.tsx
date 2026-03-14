// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────
interface ModelConfig {
    label: string
    emoji: string
    desc: string
    color: string
    columns: string[]
    primaryDisplay: string
    secondaryDisplay?: string
}

const MODELS: Record<string, ModelConfig> = {
    tenant: {
        label: 'Tenants',
        emoji: '🏪',
        desc: 'Restaurant accounts & subscriptions',
        color: '#3b82f6',
        columns: ['id', 'code', 'name', 'displayName', 'status', 'currency', 'createdAt'],
        primaryDisplay: 'name',
        secondaryDisplay: 'code',
    },
    user: {
        label: 'Store Users',
        emoji: '👤',
        desc: 'Staff and admin accounts per tenant',
        color: '#10b981',
        columns: ['id', 'username', 'role', 'tenantId', 'createdAt'],
        primaryDisplay: 'username',
        secondaryDisplay: 'role',
    },
    product: {
        label: 'Products / Menu',
        emoji: '🍜',
        desc: 'Stock items and menu entries',
        color: '#f59e0b',
        columns: ['id', 'name', 'sku', 'categoryId', 'tenantId', 'createdAt'],
        primaryDisplay: 'name',
        secondaryDisplay: 'sku',
    },
    order: {
        label: 'Orders',
        emoji: '🧾',
        desc: 'Customer orders and transactions',
        color: '#8b5cf6',
        columns: ['id', 'status', 'total', 'tenantId', 'createdAt'],
        primaryDisplay: 'id',
        secondaryDisplay: 'status',
    },
}

const C = {
    bg: '#080c14', card: '#0d1220', border: 'rgba(255,255,255,0.07)',
    accent: '#2563eb', accentLight: 'rgba(37,99,235,0.12)',
    text: '#e2e8f0', textMuted: '#64748b', textDim: '#334155',
}

// ── Simple value formatter ──────────────────────────────────────────
function formatVal(val: any): string {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    if (val instanceof Date || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/))) {
        return new Date(val).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
    }
    const str = String(val)
    return str.length > 40 ? str.slice(0, 40) + '…' : str
}

// ── Status Badge ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { bg: string; color: string }> = {
        ACTIVE: { bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
        INACTIVE: { bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
        SUSPENDED: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
        CLOSED: { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
        PENDING: { bg: 'rgba(59,130,246,0.12)', color: '#93c5fd' },
        OWNER: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
        MANAGER: { bg: 'rgba(59,130,246,0.12)', color: '#93c5fd' },
        CASHIER: { bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
        KITCHEN: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
    }
    const s = map[status] || { bg: 'rgba(255,255,255,0.08)', color: '#94a3b8' }
    return (
        <span style={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
            padding: '2px 8px', borderRadius: 99,
            background: s.bg, color: s.color,
            textTransform: 'uppercase' as const,
        }}>{status}</span>
    )
}

// ── Record Card ──────────────────────────────────────────────────────
function RecordCard({ record, modelKey, config, onDelete }: {
    record: any; modelKey: string; config: ModelConfig; onDelete: (id: string) => void
}) {
    const [deleting, setDeleting] = useState(false)
    const id = record.id
    const primary = record[config.primaryDisplay]
    const secondary = config.secondaryDisplay ? record[config.secondaryDisplay] : null
    const statusField = record.status || record.role

    const fields = config.columns.filter(c => !['id', config.primaryDisplay, config.secondaryDisplay, 'status', 'role'].includes(c))

    async function handleDelete() {
        if (!confirm(`Delete this ${config.label.slice(0, -1)}? This cannot be undone.`)) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/database/${modelKey}/${id}`, { method: 'DELETE' })
            if (res.ok) onDelete(id)
            else alert('Delete failed: ' + (await res.json()).error)
        } catch {
            alert('Network error')
        }
        setDeleting(false)
    }

    return (
        <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: '14px',
            transition: 'border-color 0.15s',
        }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(37,99,235,0.3)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
        >
            {/* Avatar / Emoji circle */}
            <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${config.color}20`, border: `1px solid ${config.color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
            }}>
                {config.emoji}
            </div>

            {/* Primary + secondary */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const }}>
                    <span style={{ fontWeight: 600, color: C.text, fontSize: '0.88rem' }}>
                        {formatVal(primary) || id.slice(0, 12)}
                    </span>
                    {secondary && <StatusBadge status={String(secondary)} />}
                </div>
                <div style={{ fontSize: '0.7rem', color: C.textMuted, marginTop: '3px', display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#374151' }}>#{id.slice(0, 8)}…</span>
                    {fields.slice(0, 3).map(f => (
                        record[f] ? <span key={f}><span style={{ color: '#374151' }}>{f}:</span> {formatVal(record[f])}</span> : null
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <Link href={`/admin/database/${modelKey}/${id}`} style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '5px 10px', borderRadius: 7, textDecoration: 'none',
                    background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)',
                    color: '#93c5fd', fontSize: '0.72rem', fontWeight: 500,
                }}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit
                </Link>
                <button onClick={handleDelete} disabled={deleting} style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '5px 10px', borderRadius: 7,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f87171', fontSize: '0.72rem', fontWeight: 500,
                    cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.5 : 1,
                    fontFamily: 'inherit',
                }}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    {deleting ? '…' : 'Del'}
                </button>
            </div>
        </div>
    )
}

// ── Skeleton loader ──────────────────────────────────────────────────
function Skeleton() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                    height: 64, borderRadius: 12,
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                }} />
            ))}
            <style>{`@keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }`}</style>
        </div>
    )
}

// ── Main Client Component ───────────────────────────────────────────
export default function DatabaseModelClient({ modelKey }: { modelKey: string | null }) {
    const config = modelKey ? MODELS[modelKey] : null
    const [records, setRecords] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        if (!modelKey) return
        setLoading(true)
        setError('')
        fetch(`/api/admin/db-list/${modelKey}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) setError(data.error)
                else setRecords(data.records || [])
            })
            .catch(() => setError('Failed to load data'))
            .finally(() => setLoading(false))
    }, [modelKey])

    const filtered = records.filter(r => {
        if (!search) return true
        const s = search.toLowerCase()
        return Object.values(r).some(v => String(v).toLowerCase().includes(s))
    })

    function onDelete(id: string) {
        setRecords(prev => prev.filter(r => r.id !== id))
    }

    // Root: model cards
    if (!modelKey) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '14px' }}>
                {Object.entries(MODELS).map(([key, m]) => (
                    <Link key={key} href={`/admin/database/${key}`} style={{ textDecoration: 'none' }}>
                        <div style={{
                            background: C.card, border: `1px solid ${C.border}`,
                            borderRadius: 14, padding: '18px', cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = m.color + '50'
                                e.currentTarget.style.background = m.color + '08'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = C.border
                                e.currentTarget.style.background = C.card
                            }}
                        >
                            <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>{m.emoji}</div>
                            <div style={{ fontWeight: 700, color: C.text, fontSize: '0.9rem', marginBottom: '4px' }}>{m.label}</div>
                            <div style={{ fontSize: '0.72rem', color: C.textMuted }}>{m.desc}</div>
                        </div>
                    </Link>
                ))}
            </div>
        )
    }

    if (!config) {
        return <div style={{ color: '#f87171', padding: '24px' }}>Unknown model: {modelKey}</div>
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                    borderRadius: 10, padding: '8px 12px',
                }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={`Search ${config.label}…`}
                        style={{
                            flex: 1, background: 'none', border: 'none', outline: 'none',
                            color: C.text, fontSize: '0.82rem', fontFamily: 'inherit',
                        }}
                    />
                </div>
                <Link href={`/admin/database/${modelKey}/new`} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: 10, textDecoration: 'none',
                    background: C.accent, color: '#fff', fontSize: '0.82rem', fontWeight: 600,
                    flexShrink: 0,
                }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add New
                </Link>
            </div>

            {/* Count */}
            {!loading && !error && (
                <div style={{ fontSize: '0.72rem', color: C.textMuted }}>
                    {filtered.length} of {records.length} {config.label}
                </div>
            )}

            {/* States */}
            {loading && <Skeleton />}
            {error && (
                <div style={{
                    padding: '20px', borderRadius: 12, textAlign: 'center',
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                    color: '#f87171', fontSize: '0.82rem',
                }}>{error}</div>
            )}

            {/* Records */}
            {!loading && !error && (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                    {filtered.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: C.textMuted, fontSize: '0.85rem' }}>
                            {search ? 'No results found' : `No ${config.label} yet`}
                        </div>
                    )}
                    {filtered.map(record => (
                        <RecordCard
                            key={record.id}
                            record={record}
                            modelKey={modelKey}
                            config={config}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
