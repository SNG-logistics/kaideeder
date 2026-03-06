'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePermission } from '@/hooks/usePermission'

type StoreUser = {
    id: string
    username: string
    name: string
    role: string
    isActive: boolean
    createdAt: string
}

const ALL_ROLES = ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'KITCHEN', 'BAR', 'CASHIER', 'VIEWER'] as const
type Role = typeof ALL_ROLES[number]

const ROLE_COLOR: Record<string, string> = {
    OWNER: 'bg-amber-900/40 text-amber-300 border-amber-700',
    MANAGER: 'bg-blue-900/40 text-blue-300 border-blue-700',
    PURCHASER: 'bg-sky-900/40 text-sky-300 border-sky-700',
    WAREHOUSE: 'bg-gray-700/40 text-gray-300 border-gray-600',
    KITCHEN: 'bg-red-900/40 text-red-300 border-red-700',
    BAR: 'bg-purple-900/40 text-purple-300 border-purple-700',
    CASHIER: 'bg-emerald-900/40 text-emerald-300 border-emerald-700',
    VIEWER: 'bg-gray-800/40 text-gray-400 border-gray-700',
}

const ROLE_EMOJI: Record<string, string> = {
    OWNER: '👑', MANAGER: '📊', PURCHASER: '🛒',
    WAREHOUSE: '🏭', KITCHEN: '🍳', BAR: '🍸',
    CASHIER: '💰', VIEWER: '👁',
}

export default function UsersSettingsPage() {
    const canManage = usePermission('SETTINGS_MANAGE')
    const [users, setUsers] = useState<StoreUser[]>([])
    const [loading, setLoading] = useState(true)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    // New user form
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ username: '', name: '', role: 'CASHIER' as Role, password: '' })

    // Inline edit states
    const [editRole, setEditRole] = useState<Record<string, Role>>({})
    const [working, setWorking] = useState<string | null>(null)
    const [showPassReset, setShowPassReset] = useState<string | null>(null)
    const [newPassword, setNewPassword] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/settings/users')
        const d = await res.json()
        setUsers(d.data ?? [])
        setLoading(false)
    }, [])

    useEffect(() => { if (canManage) load() }, [canManage, load])

    // ── Create user ────────────────────────────────────────────────────────────
    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const res = await fetch('/api/settings/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            setMsg({ ok: true, text: `User "${form.name}" created` })
            setForm({ username: '', name: '', role: 'CASHIER', password: '' })
            setShowForm(false)
            load()
        } else {
            setMsg({ ok: false, text: d.error ?? 'Error' })
        }
    }

    // ── Change role ────────────────────────────────────────────────────────────
    async function handleRoleChange(userId: string) {
        const role = editRole[userId]
        if (!role) return
        setWorking(userId)
        const res = await fetch(`/api/settings/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
        })
        const d = await res.json()
        setWorking(null)
        if (d.success) {
            setMsg({ ok: true, text: 'Role updated' })
            setEditRole(r => { const n = { ...r }; delete n[userId]; return n })
            load()
        } else {
            setMsg({ ok: false, text: d.error ?? 'Error' })
        }
    }

    // ── Toggle active ──────────────────────────────────────────────────────────
    async function handleToggleActive(user: StoreUser) {
        setWorking(user.id)
        const res = await fetch(`/api/settings/users/${user.id}`, {
            method: user.isActive ? 'DELETE' : 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: user.isActive ? undefined : JSON.stringify({ isActive: true }),
        })
        const d = await res.json()
        setWorking(null)
        if (d.success) {
            setMsg({ ok: true, text: user.isActive ? 'User deactivated' : 'User activated' })
            load()
        } else {
            setMsg({ ok: false, text: d.error ?? 'Error' })
        }
    }

    // ── Reset password ─────────────────────────────────────────────────────────
    async function handlePasswordReset(userId: string) {
        if (!newPassword || newPassword.length < 6) return
        setWorking(userId)
        const res = await fetch(`/api/settings/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPassword }),
        })
        const d = await res.json()
        setWorking(null)
        if (d.success) {
            setMsg({ ok: true, text: 'Password reset' })
            setShowPassReset(null)
            setNewPassword('')
        } else {
            setMsg({ ok: false, text: d.error ?? 'Error' })
        }
    }

    if (!canManage) {
        return (
            <div className="flex items-center justify-center min-h-60">
                <p className="text-gray-500">🔒 ต้องมีสิทธิ์ SETTINGS_MANAGE เพื่อจัดการผู้ใช้</p>
            </div>
        )
    }

    const field = (key: keyof typeof form) => ({
        value: form[key] as string,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm(f => ({ ...f, [key]: e.target.value })),
        className: 'bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-blue-500',
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">จัดการผู้ใช้</h1>
                    <p className="text-gray-500 text-sm mt-0.5">User Management — {users.filter(u => u.isActive).length} active / {users.length} total</p>
                </div>
                <button
                    onClick={() => setShowForm(v => !v)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                    {showForm ? 'Cancel' : '+ New User'}
                </button>
            </div>

            {/* Toast */}
            {msg && (
                <div className={`px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                    {msg.text}
                    <button onClick={() => setMsg(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
                </div>
            )}

            {/* Create user form */}
            {showForm && (
                <form onSubmit={handleCreate} className="bg-gray-900 border border-blue-700 rounded-xl p-6 space-y-4">
                    <h2 className="text-base font-semibold">สร้างผู้ใช้ใหม่</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Username <span className="text-gray-600">(a-z 0-9 _)</span></label>
                            <input {...field('username')} placeholder="cashier01" required pattern="[a-z0-9_]+" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Display Name</label>
                            <input {...field('name')} placeholder="นายสมชาย" required />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Role</label>
                            <select {...field('role')} className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-blue-500">
                                {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_EMOJI[r]} {r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Password</label>
                            <input {...field('password')} type="password" placeholder="min 6 chars" required minLength={6} />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition"
                    >
                        {saving ? 'Creating…' : 'Create User'}
                    </button>
                </form>
            )}

            {/* Users table */}
            {loading ? (
                <p className="text-gray-500">Loading…</p>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-800 text-gray-400 text-left">
                                <th className="px-5 py-3 font-medium">ผู้ใช้</th>
                                <th className="px-5 py-3 font-medium">Role</th>
                                <th className="px-5 py-3 font-medium">สถานะ</th>
                                <th className="px-5 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {users.length === 0 ? (
                                <tr><td colSpan={4} className="text-center text-gray-600 py-12">No users found</td></tr>
                            ) : users.map(u => (
                                <tr key={u.id} className={`transition ${!u.isActive ? 'opacity-40' : 'hover:bg-gray-800/30'}`}>
                                    <td className="px-5 py-4">
                                        <p className="font-medium text-white">{u.name}</p>
                                        <p className="text-xs font-mono text-gray-500">@{u.username}</p>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLOR[u.role] ?? ''}`}>
                                                {ROLE_EMOJI[u.role]} {u.role}
                                            </span>
                                            {/* Inline role change */}
                                            <select
                                                value={editRole[u.id] ?? ''}
                                                onChange={e => setEditRole(r => ({ ...r, [u.id]: e.target.value as Role }))}
                                                className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="">Change…</option>
                                                {ALL_ROLES.filter(r => r !== u.role).map(r => (
                                                    <option key={r} value={r}>{ROLE_EMOJI[r]} {r}</option>
                                                ))}
                                            </select>
                                            {editRole[u.id] && (
                                                <button
                                                    onClick={() => handleRoleChange(u.id)}
                                                    disabled={working === u.id}
                                                    className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-2 py-1 rounded transition"
                                                >
                                                    {working === u.id ? '…' : '✓'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`text-xs font-semibold ${u.isActive ? 'text-emerald-400' : 'text-gray-600'}`}>
                                            {u.isActive ? '● Active' : '○ Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            {/* Reset password */}
                                            {showPassReset === u.id ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="password"
                                                        placeholder="New password"
                                                        value={newPassword}
                                                        onChange={e => setNewPassword(e.target.value)}
                                                        className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 w-28 focus:outline-none focus:border-blue-500"
                                                        minLength={6}
                                                    />
                                                    <button
                                                        onClick={() => handlePasswordReset(u.id)}
                                                        disabled={working === u.id || newPassword.length < 6}
                                                        className="text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-2 py-1 rounded transition"
                                                    >
                                                        ✓
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowPassReset(null); setNewPassword('') }}
                                                        className="text-xs text-gray-500 hover:text-white px-1 transition"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setShowPassReset(u.id)}
                                                    className="text-xs text-gray-500 hover:text-blue-400 transition"
                                                >
                                                    🔑 Reset PW
                                                </button>
                                            )}
                                            {/* Toggle active */}
                                            <button
                                                onClick={() => handleToggleActive(u)}
                                                disabled={working === u.id}
                                                className={`text-xs px-2 py-1 rounded border transition disabled:opacity-50 ${u.isActive
                                                        ? 'border-red-800 text-red-400 hover:bg-red-900/30'
                                                        : 'border-emerald-800 text-emerald-400 hover:bg-emerald-900/30'
                                                    }`}
                                            >
                                                {working === u.id ? '…' : u.isActive ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Role reference table */}
            <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-gray-400 hover:text-white transition select-none">
                    📋 ตารางสิทธิ์แต่ละ Role
                </summary>
                <div className="px-5 pb-5 pt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-gray-500">
                                <th className="text-left pb-2 font-medium pr-4">Permission</th>
                                {ALL_ROLES.map(r => <th key={r} className="pb-2 font-medium px-2">{ROLE_EMOJI[r]}<br />{r}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {([
                                ['POS ขายหน้าร้าน', ['OWNER', 'MANAGER', 'CASHIER']],
                                ['จอครัว KDS', ['OWNER', 'MANAGER', 'KITCHEN', 'BAR']],
                                ['Dashboard', ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'CASHIER', 'VIEWER']],
                                ['เมนูร้าน (ดู)', ['OWNER', 'MANAGER']],
                                ['วัตถุดิบ Stock', ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'VIEWER']],
                                ['สต็อคคลัง', ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'VIEWER']],
                                ['ใบซื้อ GR', ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'VIEWER']],
                                ['สร้างใบซื้อ', ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE']],
                                ['โอนคลัง', ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE']],
                                ['ปรับสต็อค', ['OWNER', 'MANAGER', 'WAREHOUSE']],
                                ['บันทึก Waste', ['OWNER', 'MANAGER', 'WAREHOUSE', 'KITCHEN', 'BAR']],
                                ['สูตรอาหาร BOM', ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE']],
                                ['นำเข้ายอดขาย', ['OWNER', 'MANAGER']],
                                ['Reports', ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'CASHIER', 'VIEWER']],
                                ['AI Chat', ['OWNER', 'MANAGER']],
                                ['Settings/Users', ['OWNER']],
                                ['Billing', ['OWNER']],
                            ] as [string, string[]][]).map(([perm, roles]) => (
                                <tr key={perm}>
                                    <td className="py-1.5 text-gray-400 pr-4 whitespace-nowrap">{perm}</td>
                                    {ALL_ROLES.map(r => (
                                        <td key={r} className="py-1.5 text-center">
                                            {roles.includes(r) ? <span className="text-emerald-400">✓</span> : <span className="text-gray-700">–</span>}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    )
}
