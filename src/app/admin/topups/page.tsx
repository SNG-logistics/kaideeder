'use client'
import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin-fetch'

type Topup = {
    id: string
    amountLAK: number
    channel: string
    proofUrl: string | null
    status: string
    createdAt: string
    tenant: { code: string; name: string }
    user: { username: string; name: string }
}

export default function TopupsPage() {
    const [topups, setTopups] = useState<Topup[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<string | null>(null)
    const [rejectNote, setRejectNote] = useState<Record<string, string>>({})

    async function load() {
        const res = await adminFetch('/api/admin/topups?status=PENDING')
        const d = await res.json()
        setTopups(d.data ?? [])
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    async function act(id: string, action: 'APPROVE' | 'REJECT') {
        const note = rejectNote[id] || ''
        if (action === 'REJECT' && !note.trim()) {
            alert('Please provide a rejection reason')
            return
        }
        setProcessing(id)
        try {
            await adminFetch(`/api/admin/topups/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, note }),
            })
            load()
        } finally {
            setProcessing(null)
        }
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Topup Approvals</h1>
            {loading ? (
                <p className="text-gray-500">Loading…</p>
            ) : topups.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
                    No pending topup requests 🎉
                </div>
            ) : (
                <div className="space-y-4">
                    {topups.map(t => (
                        <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="font-semibold text-white">{t.tenant.name} <span className="text-gray-500 text-xs font-mono ml-1">{t.tenant.code}</span></p>
                                    <p className="text-gray-400 text-sm">Requested by <span className="text-white">{t.user.name}</span> (@{t.user.username})</p>
                                    <p className="text-gray-500 text-xs mt-1">{new Date(t.createdAt).toLocaleString()} · via {t.channel}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-emerald-400">{t.amountLAK.toLocaleString()}</p>
                                    <p className="text-gray-500 text-xs">LAK</p>
                                </div>
                            </div>

                            {t.proofUrl && (
                                <a href={t.proofUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">
                                    View slip image →
                                </a>
                            )}

                            <div className="flex items-center gap-3 border-t border-gray-800 pt-4">
                                <input
                                    placeholder="Rejection reason (required to reject)"
                                    value={rejectNote[t.id] ?? ''}
                                    onChange={e => setRejectNote(prev => ({ ...prev, [t.id]: e.target.value }))}
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                                />
                                <button
                                    onClick={() => act(t.id, 'REJECT')}
                                    disabled={processing === t.id}
                                    className="px-4 py-2 text-sm font-medium text-red-400 border border-red-800 hover:bg-red-900/30 rounded-lg transition disabled:opacity-50"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => act(t.id, 'APPROVE')}
                                    disabled={processing === t.id}
                                    className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition disabled:opacity-50"
                                >
                                    {processing === t.id ? 'Processing…' : '✓ Approve'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
