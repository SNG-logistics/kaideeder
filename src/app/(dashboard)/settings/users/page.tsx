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

const ROLE_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
    OWNER: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: '👑 Owner' },
    MANAGER: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', label: '📊 Manager' },
    PURCHASER: { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.3)', label: '🛒 Purchaser' },
    WAREHOUSE: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', label: '🏭 Warehouse' },
    KITCHEN: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', label: '🍳 Kitchen' },
    BAR: { color: '#a855f7', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)', label: '🍸 Bar' },
    CASHIER: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', label: '💰 Cashier' },
    VIEWER: { color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)', label: '👁 Viewer' },
}

const inp: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.875rem', borderRadius: 10,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#f1f5f9', outline: 'none', boxSizing: 'border-box',
}

export default function UsersSettingsPage() {
    const canManage = usePermission('SETTINGS_MANAGE')
    const [users, setUsers] = useState<StoreUser[]>([])
    const [loading, setLoading] = useState(true)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ username: '', name: '', role: 'CASHIER' as Role, password: '' })

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

    function flash(ok: boolean, text: string) {
        setMsg({ ok, text })
        setTimeout(() => setMsg(null), 3500)
    }

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
            flash(true, `✅ สร้างผู้ใช้ "${form.name}" แล้ว`)
            setForm({ username: '', name: '', role: 'CASHIER', password: '' })
            setShowForm(false); load()
        } else flash(false, d.error ?? 'เกิดข้อผิดพลาด')
    }

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
            flash(true, 'อัปเดต Role แล้ว')
            setEditRole(r => { const n = { ...r }; delete n[userId]; return n })
            load()
        } else flash(false, d.error ?? 'เกิดข้อผิดพลาด')
    }

    async function handleToggleActive(user: StoreUser) {
        setWorking(user.id)
        const res = await fetch(`/api/settings/users/${user.id}`, {
            method: user.isActive ? 'DELETE' : 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: user.isActive ? undefined : JSON.stringify({ isActive: true }),
        })
        const d = await res.json()
        setWorking(null)
        if (d.success) { flash(true, user.isActive ? 'ปิดการใช้งานแล้ว' : 'เปิดการใช้งานแล้ว'); load() }
        else flash(false, d.error ?? 'เกิดข้อผิดพลาด')
    }

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
        if (d.success) { flash(true, '🔑 Reset รหัสผ่านแล้ว'); setShowPassReset(null); setNewPassword('') }
        else flash(false, d.error ?? 'เกิดข้อผิดพลาด')
    }

    if (!canManage) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
            <p style={{ color: '#64748b' }}>🔒 ต้องมีสิทธิ์ SETTINGS_MANAGE เพื่อจัดการผู้ใช้</p>
        </div>
    )

    const activeCount = users.filter(u => u.isActive).length

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1A1D26', margin: 0 }}>👥 จัดการผู้ใช้</h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.83rem', marginTop: 4 }}>
                        {activeCount} ใช้งานอยู่ · {users.length} ทั้งหมด
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(v => !v)}
                    style={{
                        padding: '0.55rem 1.25rem', borderRadius: 10, border: 'none',
                        background: showForm ? 'rgba(239,68,68,0.12)' : '#E8364E',
                        color: showForm ? '#ef4444' : '#fff',
                        fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                        transition: 'all 0.15s',
                    }}
                >
                    {showForm ? '✕ ยกเลิก' : '+ เพิ่มผู้ใช้ใหม่'}
                </button>
            </div>

            {/* ── Toast ── */}
            {msg && (
                <div style={{
                    padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.85rem',
                    background: msg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: msg.ok ? '#10b981' : '#ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    {msg.text}
                    <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, fontSize: '1rem' }}>✕</button>
                </div>
            )}

            {/* ── Create Form ── */}
            {showForm && (
                <form onSubmit={handleCreate} style={{
                    background: '#fff', borderRadius: 16, padding: '1.5rem',
                    border: '1px solid rgba(232,54,78,0.2)',
                    boxShadow: '0 4px 24px rgba(232,54,78,0.08)',
                }}>
                    <h2 style={{ color: '#1A1D26', fontWeight: 700, margin: '0 0 1rem', fontSize: '1rem' }}>+ สร้างผู้ใช้ใหม่</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                        {([
                            { key: 'username', label: 'Username', placeholder: 'cashier01', extra: '(a-z 0-9 _)' },
                            { key: 'name', label: 'ชื่อที่แสดง', placeholder: 'นายสมชาย' },
                            { key: 'password', label: 'รหัสผ่าน', placeholder: 'min 6 ตัวอักษร', type: 'password' },
                        ] as any[]).map(f => (
                            <div key={f.key}>
                                <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>
                                    {f.label} {f.extra && <span style={{ fontWeight: 400, opacity: 0.6 }}>{f.extra}</span>}
                                </label>
                                <input
                                    style={{ ...inp, color: '#1A1D26', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.12)' }}
                                    type={f.type || 'text'}
                                    placeholder={f.placeholder}
                                    value={(form as any)[f.key]}
                                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    required
                                    {...(f.key === 'username' ? { pattern: '[a-z0-9_]+' } : {})}
                                    {...(f.key === 'password' ? { minLength: 6 } : {})}
                                />
                            </div>
                        ))}
                        <div>
                            <label style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>Role</label>
                            <select
                                style={{ ...inp, color: '#1A1D26', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.12)', appearance: 'none' }}
                                value={form.role}
                                onChange={e => setForm(p => ({ ...p, role: e.target.value as Role }))}
                            >
                                {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_CONFIG[r]?.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            padding: '0.55rem 1.5rem', borderRadius: 10, border: 'none',
                            background: '#E8364E', color: '#fff',
                            fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                            opacity: saving ? 0.6 : 1,
                        }}
                    >
                        {saving ? '⏳ กำลังสร้าง...' : '✅ สร้างผู้ใช้'}
                    </button>
                </form>
            )}

            {/* ── Users List ── */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>⏳ กำลังโหลด...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {users.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>ไม่พบผู้ใช้</div>
                    ) : users.map(u => {
                        const rc = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.VIEWER
                        const isWorking = working === u.id
                        return (
                            <div key={u.id} style={{
                                background: '#fff',
                                border: '1px solid rgba(0,0,0,0.06)',
                                borderRadius: 14,
                                padding: '1rem 1.25rem',
                                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                                opacity: u.isActive ? 1 : 0.5,
                                transition: 'all 0.15s',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                            }}>
                                {/* Avatar */}
                                <div style={{
                                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                    background: rc.bg, border: `2px solid ${rc.border}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.2rem', fontWeight: 700,
                                }}>
                                    {rc.label.split(' ')[0]}
                                </div>

                                {/* Name + username */}
                                <div style={{ flex: 1, minWidth: 120 }}>
                                    <p style={{ fontWeight: 700, color: '#1A1D26', margin: 0, fontSize: '0.9rem' }}>{u.name}</p>
                                    <p style={{ color: '#94a3b8', fontSize: '0.73rem', margin: '2px 0 0', fontFamily: 'monospace' }}>@{u.username}</p>
                                </div>

                                {/* Role badge + change dropdown */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <span style={{
                                        padding: '0.3rem 0.8rem', borderRadius: 999,
                                        background: rc.bg, border: `1px solid ${rc.border}`,
                                        color: rc.color, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
                                    }}>
                                        {rc.label}
                                    </span>
                                    <select
                                        value={editRole[u.id] ?? ''}
                                        onChange={e => setEditRole(r => ({ ...r, [u.id]: e.target.value as Role }))}
                                        style={{
                                            padding: '0.3rem 0.6rem', borderRadius: 8, fontSize: '0.75rem',
                                            background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.12)',
                                            color: '#475569', cursor: 'pointer', outline: 'none',
                                        }}
                                    >
                                        <option value="">เปลี่ยน Role…</option>
                                        {ALL_ROLES.filter(r => r !== u.role).map(r => (
                                            <option key={r} value={r}>{ROLE_CONFIG[r]?.label}</option>
                                        ))}
                                    </select>
                                    {editRole[u.id] && (
                                        <button
                                            onClick={() => handleRoleChange(u.id)}
                                            disabled={isWorking}
                                            style={{
                                                padding: '0.3rem 0.65rem', borderRadius: 8, border: 'none',
                                                background: '#3b82f6', color: '#fff',
                                                fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                                opacity: isWorking ? 0.5 : 1,
                                            }}
                                        >
                                            {isWorking ? '⏳' : '✓'}
                                        </button>
                                    )}
                                </div>

                                {/* Status */}
                                <span style={{
                                    fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
                                    color: u.isActive ? '#10b981' : '#94a3b8',
                                }}>
                                    {u.isActive ? '🟢 ใช้งาน' : '⚫ ปิดอยู่'}
                                </span>

                                {/* Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    {showPassReset === u.id ? (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <input
                                                type="password"
                                                placeholder="รหัสผ่านใหม่"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                minLength={6}
                                                style={{
                                                    ...inp, width: 130, padding: '0.3rem 0.65rem', fontSize: '0.75rem',
                                                    color: '#1A1D26', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.12)',
                                                }}
                                            />
                                            <button
                                                onClick={() => handlePasswordReset(u.id)}
                                                disabled={isWorking || newPassword.length < 6}
                                                style={{
                                                    padding: '0.3rem 0.65rem', borderRadius: 8, border: 'none',
                                                    background: '#10b981', color: '#fff',
                                                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                                    opacity: (isWorking || newPassword.length < 6) ? 0.4 : 1,
                                                }}
                                            >✓</button>
                                            <button
                                                onClick={() => { setShowPassReset(null); setNewPassword('') }}
                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                                            >✕</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowPassReset(u.id)}
                                            style={{
                                                padding: '0.3rem 0.8rem', borderRadius: 8, fontSize: '0.75rem',
                                                border: '1px solid rgba(0,0,0,0.1)', background: 'transparent',
                                                color: '#64748b', cursor: 'pointer', fontWeight: 600,
                                            }}
                                        >
                                            🔑 Reset PW
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleToggleActive(u)}
                                        disabled={isWorking}
                                        style={{
                                            padding: '0.3rem 0.8rem', borderRadius: 8, fontSize: '0.75rem',
                                            border: `1px solid ${u.isActive ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                                            background: u.isActive ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                                            color: u.isActive ? '#ef4444' : '#10b981',
                                            cursor: 'pointer', fontWeight: 600,
                                            opacity: isWorking ? 0.5 : 1,
                                        }}
                                    >
                                        {isWorking ? '⏳' : u.isActive ? 'ปิดการใช้งาน' : 'เปิดใช้งาน'}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ── Role Reference ── */}
            <details style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, overflow: 'hidden' }}>
                <summary style={{
                    padding: '0.875rem 1.25rem', cursor: 'pointer', fontSize: '0.85rem',
                    fontWeight: 600, color: '#475569', userSelect: 'none',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    📋 ตารางสิทธิ์แต่ละ Role
                </summary>
                <div style={{ padding: '0.25rem 1.25rem 1.25rem', overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', paddingBottom: 10, color: '#64748b', fontWeight: 600, paddingRight: 16 }}>
                                    สิทธิ์
                                </th>
                                {ALL_ROLES.map(r => (
                                    <th key={r} style={{ paddingBottom: 10, color: ROLE_CONFIG[r]?.color, fontWeight: 700, textAlign: 'center', padding: '0 8px 10px' }}>
                                        {ROLE_CONFIG[r]?.label.split(' ')[0]}<br />
                                        <span style={{ color: '#94a3b8', fontWeight: 400 }}>{r}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {([
                                ['POS ขายหน้าร้าน', ['OWNER', 'MANAGER', 'CASHIER']],
                                ['จอครัว KDS', ['OWNER', 'MANAGER', 'KITCHEN', 'BAR']],
                                ['Dashboard', ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'CASHIER', 'VIEWER']],
                                ['เมนูร้าน', ['OWNER', 'MANAGER']],
                                ['วัตถุดิบ / Stock', ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'VIEWER']],
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
                            ] as [string, string[]][]).map(([perm, roles], i) => (
                                <tr key={perm} style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' }}>
                                    <td style={{ padding: '8px 16px 8px 0', color: '#475569', whiteSpace: 'nowrap' }}>{perm}</td>
                                    {ALL_ROLES.map(r => (
                                        <td key={r} style={{ textAlign: 'center', padding: '8px' }}>
                                            {roles.includes(r)
                                                ? <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>
                                                : <span style={{ color: '#d1d5db' }}>–</span>
                                            }
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
