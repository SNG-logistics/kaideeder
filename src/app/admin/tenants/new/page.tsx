'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'

export default function NewTenantPage() {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [form, setForm] = useState({ code: '', name: '', trialDays: 14 })

    const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [key]: key === 'trialDays' ? Number(e.target.value) : e.target.value }))

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true); setMsg(null)
        const res = await adminFetch('/api/admin/tenants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) router.push(`/admin/tenants/${d.data.id}`)
        else setMsg({ ok: false, text: d.error ?? 'Error creating tenant' })
    }

    const IS = {
        width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12, padding: '12px 16px', fontSize: '0.9rem', color: '#e2e8f0', outline: 'none',
        fontFamily: 'inherit', boxSizing: 'border-box' as const, transition: 'border-color 0.15s',
    }

    return (
        <div style={{ maxWidth: 560, margin: '0 auto', fontFamily: "'Inter',system-ui,sans-serif" }}>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#475569', marginBottom: 28 }}>
                <Link href="/admin/tenants" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>← Tenants</Link>
                <span>/</span>
                <span style={{ color: '#e2e8f0' }}>New Tenant</span>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                <div style={{ width: 54, height: 54, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 8px 24px rgba(99,102,241,0.35)', flexShrink: 0 }}>
                    🏪
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em' }}>Create Tenant</h1>
                    <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.82rem' }}>สร้างพื้นที่ร้านค้าใหม่สำหรับลูกค้า</p>
                </div>
            </div>

            {/* Error */}
            {msg && !msg.ok && (
                <div style={{ marginBottom: 20, padding: '12px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.1rem' }}>⚠️</span> {msg.text}
                </div>
            )}

            {/* Form Card */}
            <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: '32px', display: 'flex', flexDirection: 'column', gap: 24, boxShadow: '0 12px 48px rgba(0,0,0,0.25)' }}>

                {/* Tenant Code */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                        รหัสร้านค้า (Tenant Code) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                        type="text"
                        value={form.code}
                        onChange={set('code')}
                        placeholder="e.g. mycafe-001"
                        required
                        pattern="[a-z0-9\-]+"
                        style={IS}
                        onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontSize: '0.9rem', flexShrink: 0, marginTop: 1 }}>ℹ️</span>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#475569', lineHeight: 1.5 }}>
                            ใช้ตัวอักษรพิมพ์เล็ก (a-z), ตัวเลข (0-9) หรือขีดกลาง (-) ห้ามเว้นวรรค และห้ามซ้ำ<br />
                            <span style={{ color: '#6366f1' }}>รหัสนี้จะเป็น username เริ่มต้นของเจ้าของร้านด้วย</span>
                        </p>
                    </div>
                </div>

                {/* Display Name */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                        ชื่อร้านค้า (Display Name) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={set('name')}
                        placeholder="เช่น ขายดีเด้อ สาขาหลัก"
                        required
                        style={IS}
                        onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                </div>

                {/* Trial Days */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: 8 }}>
                        Trial Period (วัน)
                    </label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {[7, 14, 30, 60].map(d => (
                            <button key={d} type="button" onClick={() => setForm(f => ({ ...f, trialDays: d }))}
                                style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${form.trialDays === d ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`, background: form.trialDays === d ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)', color: form.trialDays === d ? '#818cf8' : '#64748b', fontWeight: form.trialDays === d ? 700 : 400, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}>
                                {d} วัน
                            </button>
                        ))}
                        <input type="number" min={0} max={365} value={form.trialDays} onChange={set('trialDays')}
                            style={{ ...IS, width: 90, padding: '8px 12px' }}
                            onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                    </div>
                </div>

                {/* Default credentials preview */}
                {form.code && (
                    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🔐 Default Owner Credentials</p>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                            Username: <span style={{ fontFamily: 'monospace', color: '#10b981' }}>{form.code}</span><br />
                            Password: <span style={{ fontFamily: 'monospace', color: '#10b981' }}>{form.code}1234</span>
                        </p>
                    </div>
                )}

                {/* Divider */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Link href="/admin/tenants" style={{ padding: '11px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                        ยกเลิก
                    </Link>
                    <button type="submit" disabled={saving || !form.code || !form.name}
                        style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: saving || !form.code || !form.name ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: saving || !form.code || !form.name ? '#475569' : '#fff', fontWeight: 800, fontSize: '0.88rem', cursor: saving || !form.code || !form.name ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: saving || !form.code || !form.name ? 'none' : '0 6px 20px rgba(99,102,241,0.4)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {saving ? <><span>⏳</span> กำลังสร้าง...</> : <><span>🚀</span> ยืนยันสร้างร้านค้า</>}
                    </button>
                </div>
            </form>
        </div>
    )
}
