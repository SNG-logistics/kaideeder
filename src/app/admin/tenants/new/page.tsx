'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewTenantPage() {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [form, setForm] = useState({ code: '', name: '' })

    const field = (key: keyof typeof form) => ({
        value: form[key],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
        className: 'bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-blue-500',
    })

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const res = await fetch('/api/admin/tenants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            router.push(`/admin/tenants/${d.data.id}`)
        } else {
            setMsg({ ok: false, text: d.error ?? 'Error creating tenant' })
        }
    }

    return (
        <div className="space-y-6 max-w-lg">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link href="/admin/tenants" className="hover:text-white transition">Tenants</Link>
                <span>/</span>
                <span className="text-white font-medium">New Tenant</span>
            </div>

            <h1 className="text-2xl font-bold">Create Tenant</h1>

            {msg && (
                <div className="px-4 py-3 rounded-lg text-sm bg-red-900/50 text-red-300">
                    {msg.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Tenant Code <span className="text-gray-600">(lowercase, unique)</span></label>
                    <input {...field('code')} placeholder="store-001" required pattern="[a-z0-9\-]+" />
                    <p className="text-xs text-gray-600 mt-1">Only lowercase letters, numbers, hyphens</p>
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Display Name</label>
                    <input {...field('name')} placeholder="My Restaurant" required />
                </div>
                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
                    >
                        {saving ? 'Creating…' : 'Create Tenant'}
                    </button>
                    <Link
                        href="/admin/tenants"
                        className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    )
}
