'use client'
import { useState, useEffect } from 'react'
import { adminFetch } from '@/lib/admin-fetch'

function I({ size = 16, color = 'currentColor', children }: { size?: number; color?: string; children: React.ReactNode }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>{children}</svg>
}

function Field({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</label>
            <input {...props} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, padding: '11px 14px', fontSize: '0.9rem', color: '#e2e8f0', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
            />
            {hint && <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: 6 }}>{hint}</p>}
        </div>
    )
}

export default function PlatformConfigPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [form, setForm] = useState({ REGISTER_URL: '', CONTACT_URL: '' })

    useEffect(() => {
        fetch('/api/admin/config').then(r => r.json()).then(d => {
            if (d.success && d.data) setForm({ REGISTER_URL: d.data.REGISTER_URL || '', CONTACT_URL: d.data.CONTACT_URL || '' })
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [])

    async function handleSave(e: React.FormEvent) {
        e.preventDefault(); setSaving(true); setMsg(null)
        try {
            const res = await adminFetch('/api/admin/config', { method: 'PATCH', body: JSON.stringify(form) })
            const d = await res.json()
            setMsg(res.ok && d.success ? { ok: true, text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' } : { ok: false, text: d.error || 'เกิดข้อผิดพลาด' })
        } catch { setMsg({ ok: false, text: 'Network Error' }) }
        setSaving(false)
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, flexDirection: 'column', gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{ animation: 'cfgSpin 0.9s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <style>{`@keyframes cfgSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    const CARD = { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18 }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 680, fontFamily: "'Inter',system-ui,sans-serif" }}>
            {/* Header */}
            <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>Platform Settings</h1>
                <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '4px 0 0' }}>ตั้งค่าลิงก์และข้อมูลพื้นฐานของระบบส่วนกลาง</p>
            </div>

            {/* Alert */}
            {msg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, fontSize: '0.85rem', background: msg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, color: msg.ok ? '#34d399' : '#f87171' }}>
                    <I size={16} color="currentColor">
                        {msg.ok ? <polyline points="20 6 9 17 4 12" /> : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>}
                    </I>
                    <span style={{ flex: 1 }}>{msg.text}</span>
                    <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, fontSize: '1rem', lineHeight: 1 }}>✕</button>
                </div>
            )}

            {/* Info Card */}
            <div style={{ ...CARD, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <I size={18} color="#818cf8"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></I>
                </div>
                <div>
                    <p style={{ fontWeight: 600, color: '#a5b4fc', fontSize: '0.85rem', margin: '0 0 4px' }}>Global Config</p>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>การตั้งค่าเหล่านี้ใช้ร่วมกันทั้งระบบ ไม่ผูกติดกับร้านค้าใดร้านค้าหนึ่ง</p>
                </div>
            </div>

            {/* Form Card */}
            <form onSubmit={handleSave} style={{ ...CARD, padding: '24px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <I size={17} color="#64748b"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></I>
                    URL Settings
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <Field
                        label="Registration URL" type="url"
                        value={form.REGISTER_URL} onChange={e => setForm({ ...form, REGISTER_URL: e.target.value })}
                        placeholder="https://register.kaideeder.com"
                        hint="ลิงก์สำหรับสมัครสมาชิก — ปล่อยว่างเพื่อซ่อนปุ่มลงทะเบียนในหน้า Login"
                    />
                    <Field
                        label="Contact URL" type="url"
                        value={form.CONTACT_URL} onChange={e => setForm({ ...form, CONTACT_URL: e.target.value })}
                        placeholder="https://facebook.com/yourpage"
                        hint="ลิงก์ติดต่อทีมงาน / ศูนย์ช่วยเหลือ"
                    />
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 24, paddingTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" disabled={saving} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                        border: 'none', color: '#fff', fontWeight: 700, padding: '10px 24px',
                        borderRadius: 12, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', boxShadow: saving ? 'none' : '0 4px 16px rgba(99,102,241,0.35)',
                    }}>
                        <I size={16} color="white"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></I>
                        {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                    </button>
                </div>
            </form>
        </div>
    )
}
