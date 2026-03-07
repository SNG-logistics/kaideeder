'use client'
import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin-fetch'

type Topup = {
    id: string
    amountLAK: number
    channel: string
    proofUrl: string | null
    status: string
    note: string | null
    createdAt: string
    tenant: { code: string; name: string }
    user: { username: string; name: string }
}

const fmt = (n: number) => n.toLocaleString()
const fmtDT = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED'

export default function TopupsPage() {
    const [topups, setTopups] = useState<Topup[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<Tab>('PENDING')
    const [processing, setProcessing] = useState<string | null>(null)
    const [rejectNote, setRejectNote] = useState<Record<string, string>>({})

    async function load(status: Tab = tab) {
        setLoading(true)
        const res = await adminFetch(`/api/admin/topups?status=${status}`)
        const d = await res.json()
        setTopups(d.data ?? [])
        setLoading(false)
    }

    useEffect(() => { load() }, [tab])

    async function act(id: string, action: 'APPROVE' | 'REJECT') {
        const note = rejectNote[id] || ''
        if (action === 'REJECT' && !note.trim()) {
            alert('กรุณาระบุเหตุผลที่ปฏิเสธ')
            return
        }
        setProcessing(id)
        try {
            await adminFetch(`/api/admin/topups/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, note }),
            })
            setTopups(prev => prev.filter(t => t.id !== id))
        } finally {
            setProcessing(null)
        }
    }

    const pendingTotal = topups.reduce((sum, t) => sum + t.amountLAK, 0)

    const TABS: { key: Tab; label: string; color: string }[] = [
        { key: 'PENDING', label: '⏳ Pending', color: '#f59e0b' },
        { key: 'APPROVED', label: '✅ Approved', color: '#10b981' },
        { key: 'REJECTED', label: '❌ Rejected', color: '#ef4444' },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>💳 Topup Approvals</h1>
                <p style={{ color: '#475569', fontSize: '0.875rem' }}>อนุมัติ / ปฏิเสธคำขอ Topup Wallet</p>
            </div>

            {/* Pending total summary */}
            {tab === 'PENDING' && topups.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.05))',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 16, padding: '1.25rem 1.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div>
                        <p style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.875rem' }}>⚠️ รอการอนุมัติ {topups.length} รายการ</p>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>กรุณาตรวจสอบ slip ก่อน Approve</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#f59e0b', fontSize: '1.5rem', fontWeight: 800, fontFamily: 'monospace' }}>{fmt(pendingTotal)}</p>
                        <p style={{ color: '#64748b', fontSize: '0.75rem' }}>LAK รอ Approve</p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            border: 'none', cursor: 'pointer',
                            padding: '0.5rem 1.25rem', borderRadius: 9,
                            fontSize: '0.85rem', fontWeight: tab === t.key ? 700 : 400,
                            background: tab === t.key ? `${t.color}20` : 'transparent',
                            color: tab === t.key ? t.color : '#64748b',
                            transition: 'all 0.15s',
                        }}
                    >{t.label}</button>
                ))}
            </div>

            {/* Cards */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>⏳ Loading...</div>
            ) : topups.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '4rem 2rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 16, color: '#334155',
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>
                        {tab === 'PENDING' ? '🎉' : tab === 'APPROVED' ? '✅' : '📭'}
                    </div>
                    <p style={{ fontSize: '1rem', color: '#475569' }}>
                        {tab === 'PENDING' ? 'ไม่มีคำขอที่รอ approve' : `ไม่มีรายการ ${tab.toLowerCase()}`}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {topups.map(t => (
                        <div key={t.id} style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 16, padding: '1.5rem',
                            display: 'flex', flexDirection: 'column', gap: 16,
                        }}>
                            {/* Top row */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                                        background: 'rgba(245,158,11,0.12)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 22,
                                    }}>💳</div>
                                    <div>
                                        <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1rem' }}>{t.tenant.name}</p>
                                        <p style={{ color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>{t.tenant.code}</p>
                                        <p style={{ color: '#475569', fontSize: '0.78rem', marginTop: 4 }}>
                                            โดย <span style={{ color: '#94a3b8' }}>{t.user.name}</span> · {t.channel} · {fmtDT(t.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ color: '#10b981', fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1 }}>
                                        +{fmt(t.amountLAK)}
                                    </p>
                                    <p style={{ color: '#475569', fontSize: '0.75rem' }}>LAK</p>
                                </div>
                            </div>

                            {/* Proof image */}
                            {t.proofUrl && (
                                <a
                                    href={t.proofUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        color: '#6366f1', fontSize: '0.82rem', fontWeight: 600,
                                        padding: '0.4rem 0.875rem', borderRadius: 8,
                                        background: 'rgba(99,102,241,0.08)',
                                        border: '1px solid rgba(99,102,241,0.2)',
                                        textDecoration: 'none', width: 'fit-content',
                                    }}
                                >
                                    🖼️ ดู Slip / หลักฐานโอน →
                                </a>
                            )}

                            {/* Actions (only for PENDING) */}
                            {tab === 'PENDING' && (
                                <div style={{
                                    display: 'flex', gap: 12, alignItems: 'center',
                                    paddingTop: 16,
                                    borderTop: '1px solid rgba(255,255,255,0.06)',
                                    flexWrap: 'wrap',
                                }}>
                                    <input
                                        placeholder="เหตุผลที่ปฏิเสธ (ต้องกรอกถ้า Reject)"
                                        value={rejectNote[t.id] ?? ''}
                                        onChange={e => setRejectNote(prev => ({ ...prev, [t.id]: e.target.value }))}
                                        style={{
                                            flex: 1, minWidth: 200,
                                            background: 'rgba(239,68,68,0.05)',
                                            border: '1px solid rgba(239,68,68,0.2)',
                                            borderRadius: 10, padding: '0.6rem 1rem',
                                            fontSize: '0.85rem', color: '#e2e8f0',
                                            outline: 'none',
                                        }}
                                    />
                                    <button
                                        onClick={() => act(t.id, 'REJECT')}
                                        disabled={processing === t.id}
                                        style={{
                                            border: '1px solid rgba(239,68,68,0.4)',
                                            background: 'rgba(239,68,68,0.1)',
                                            color: '#ef4444', fontWeight: 600,
                                            padding: '0.6rem 1.25rem', borderRadius: 10,
                                            fontSize: '0.875rem', cursor: 'pointer',
                                            opacity: processing === t.id ? 0.5 : 1,
                                        }}
                                    >❌ Reject</button>
                                    <button
                                        onClick={() => act(t.id, 'APPROVE')}
                                        disabled={processing === t.id}
                                        style={{
                                            background: processing === t.id ? 'rgba(16,185,129,0.5)' : 'linear-gradient(135deg, #10b981, #059669)',
                                            border: 'none', color: '#fff',
                                            fontWeight: 700, padding: '0.6rem 1.75rem',
                                            borderRadius: 10, fontSize: '0.9rem',
                                            cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                                        }}
                                    >{processing === t.id ? '⏳ Processing...' : '✅ Approve'}</button>
                                </div>
                            )}

                            {/* Rejected note */}
                            {tab === 'REJECTED' && t.note && (
                                <p style={{
                                    fontSize: '0.8rem', color: '#ef4444',
                                    background: 'rgba(239,68,68,0.06)',
                                    border: '1px solid rgba(239,68,68,0.15)',
                                    padding: '0.5rem 0.875rem', borderRadius: 8,
                                }}>
                                    เหตุผล: {t.note}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
