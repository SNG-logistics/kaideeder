'use client'
import { useEffect, useState, useCallback } from 'react'
import { adminFetch } from '@/lib/admin-fetch'

type Plan = {
    id: string
    code: string
    name: string
    priceLAK: number
    durationDays: number
    isActive: boolean
}

const fmt = (n: number) => n.toLocaleString()

export default function PlansPage() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    // New plan form
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        code: '',
        name: '',
        priceLAK: 0,
        durationDays: 30,
    })

    const load = useCallback(async () => {
        setLoading(true)
        const res = await adminFetch('/api/admin/plans')
        const d = await res.json()
        setPlans(d.data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const res = await adminFetch('/api/admin/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, priceLAK: Number(form.priceLAK), durationDays: Number(form.durationDays) }),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            setMsg({ ok: true, text: `Plan "${form.name}" created` })
            setForm({ code: '', name: '', priceLAK: 0, durationDays: 30 })
            setShowForm(false)
            load()
        } else {
            setMsg({ ok: false, text: d.error ?? 'Error' })
        }
    }

    const field = (key: keyof typeof form) => ({
        value: form[key],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
        className: 'bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-blue-500',
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Plans</h1>
                <button
                    onClick={() => setShowForm(v => !v)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                    {showForm ? 'Cancel' : '+ New Plan'}
                </button>
            </div>

            {/* Toast */}
            {msg && (
                <div className={`px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                    {msg.text}
                    <button onClick={() => setMsg(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
                </div>
            )}

            {/* New plan form */}
            {showForm && (
                <form onSubmit={handleCreate} className="bg-gray-900 border border-blue-700 rounded-xl p-6 space-y-4">
                    <h2 className="text-base font-semibold">New Plan</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Code</label>
                            <input {...field('code')} placeholder="MONTHLY" required />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Name</label>
                            <input {...field('name')} placeholder="Monthly Plan" required />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Price (LAK)</label>
                            <input {...field('priceLAK')} type="number" min={0} required />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Duration (days)</label>
                            <input {...field('durationDays')} type="number" min={1} required />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition"
                    >
                        {saving ? 'Saving…' : 'Create Plan'}
                    </button>
                </form>
            )}

            {/* Plans table */}
            {loading ? (
                <p className="text-gray-500">Loading…</p>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-800 text-gray-400 text-left">
                                <th className="px-5 py-3 font-medium">Plan</th>
                                <th className="px-5 py-3 font-medium text-right">Price (LAK)</th>
                                <th className="px-5 py-3 font-medium text-right">Duration</th>
                                <th className="px-5 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {plans.length === 0 ? (
                                <tr><td colSpan={4} className="text-center text-gray-600 py-12">No plans yet — create one above</td></tr>
                            ) : plans.map(p => (
                                <tr key={p.id} className="hover:bg-gray-800/40 transition">
                                    <td className="px-5 py-4">
                                        <p className="font-medium text-white">{p.name}</p>
                                        <p className="text-xs font-mono text-gray-500">{p.code}</p>
                                    </td>
                                    <td className="px-5 py-4 text-right font-mono text-white">{fmt(p.priceLAK)}</td>
                                    <td className="px-5 py-4 text-right text-gray-400">{p.durationDays} days</td>
                                    <td className="px-5 py-4">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${p.isActive
                                            ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700'
                                            : 'bg-gray-800 text-gray-500 border-gray-700'
                                            }`}>
                                            {p.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
