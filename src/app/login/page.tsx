'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ username: '', password: '' })
    const [isMobile, setIsMobile] = useState(false)
    const [platformConfig, setPlatformConfig] = useState<{ REGISTER_URL?: string, CONTACT_URL?: string } | null>(null)

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        window.addEventListener('resize', check)

        // Fetch global platform config (like registration link)
        fetch('/api/admin/config')
            .then(res => res.json())
            .then(d => {
                if (d.success) setPlatformConfig(d.data)
            })
            .catch(() => { })

        return () => window.removeEventListener('resize', check)
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (data.success) {
                toast.success(`ยินดีต้อนรับ ${data.data.name}`)
                const redirectMap: Record<string, string> = {
                    cashier: '/pos',
                    kitchen: '/kitchen?station=KITCHEN',
                    bar: '/kitchen?station=BAR',
                    warehouse: '/inventory',
                }
                router.push(redirectMap[data.data.role as string] ?? '/dashboard')

            } else {
                toast.error(data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
        } finally {
            setLoading(false)
        }
    }

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '0.75rem 1rem',
        background: 'white', border: '1.5px solid #E5E7EB',
        borderRadius: 12, color: '#111827',
        fontSize: '1rem', outline: 'none',
        fontFamily: 'inherit', transition: 'all 0.2s',
        boxSizing: 'border-box', minHeight: 48,
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            background: '#F8F9FA',
            fontFamily: "'Noto Sans Thai', 'Noto Sans Lao', sans-serif",
        }}>
            {/* Brand panel */}
            <div style={{
                width: isMobile ? '100%' : '45%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(160deg, #E8162A 0%, #9B1020 100%)',
                padding: isMobile ? '1.25rem 1.5rem' : '3rem',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
                minHeight: isMobile ? 0 : undefined,
            }}>
                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

                {isMobile ? (
                    /* ── Mobile compact header ── */
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 400 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                            background: 'rgba(255,255,255,0.18)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 28,
                        }}>🍽️</div>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', margin: 0 }}>KAIDEEDER</h1>
                            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                                Stock Management System
                            </p>
                        </div>
                    </div>
                ) : (
                    /* ── Desktop full brand panel ── */
                    <div style={{ position: 'relative', textAlign: 'center' }}>
                        <div style={{
                            width: 90, height: 90, borderRadius: 24,
                            background: 'rgba(255,255,255,0.15)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem', fontSize: 42,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                        }}>🍽️</div>

                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', marginBottom: 8, letterSpacing: '-0.02em' }}>
                            KAIDEEDER
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
                            Stock Management System
                        </p>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                            <p style={{ color: 'white', fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.5, marginBottom: 6 }}>รู้ต้นทุนทุกจาน</p>
                            <p style={{ color: 'white', fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.5, marginBottom: 12 }}>รู้กำไรทุกวัน</p>
                            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem', lineHeight: 1.7 }}>
                                ระบบจัดการสต็อคที่ออกแบบมาสำหรับ<br />ร้านอาหารที่อยากเติบโตอย่างมั่นคง
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                            {[
                                { icon: '📉', text: 'ลดของเสีย ลดต้นทุนซื้อ' },
                                { icon: '⚡', text: 'ตัดสต็อคอัตโนมัติจาก POS ทุกออเดอร์' },
                                { icon: '📊', text: 'รายงานต้นทุน-กำไรรายวัน รายเดือน' },
                                { icon: '🤖', text: 'AI ช่วยวางสูตรและคำนวณ BOM' },
                            ].map(f => (
                                <div key={f.icon} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem' }}>
                                    <span style={{ fontSize: '1.1rem' }}>{f.icon}</span>
                                    <span>{f.text}</span>
                                </div>
                            ))}
                        </div>

                        <p style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                            KAIDEEDER POS &amp; Stock Management · Vientiane, Lao PDR
                        </p>
                    </div>
                )}
            </div>

            {/* Form panel */}
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: isMobile ? '1.5rem 1.25rem' : '2rem',
            }}>
                <div style={{ width: '100%', maxWidth: 400 }}>
                    <div style={{ marginBottom: isMobile ? '1.25rem' : '2rem' }}>
                        <h2 style={{ fontSize: isMobile ? '1.4rem' : '1.75rem', fontWeight: 800, color: '#111827', marginBottom: 6 }}>เข้าสู่ระบบ</h2>
                        <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>กรอกชื่อผู้ใช้และรหัสผ่านของคุณ</p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                                ชื่อผู้ใช้
                            </label>
                            <input
                                type="text"
                                value={form.username}
                                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                style={inputStyle}
                                placeholder="username"
                                required
                                autoComplete="username"
                                onFocus={e => { e.target.style.borderColor = '#E8162A'; e.target.style.boxShadow = '0 0 0 3px rgba(232,22,42,0.1)' }}
                                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                                รหัสผ่าน
                            </label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                style={inputStyle}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                                onFocus={e => { e.target.style.borderColor = '#E8162A'; e.target.style.boxShadow = '0 0 0 3px rgba(232,22,42,0.1)' }}
                                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%', padding: '0.9rem',
                                marginTop: 4,
                                background: loading ? '#FECACA' : '#E8162A',
                                color: 'white', fontWeight: 700,
                                fontSize: '1rem', minHeight: 52,
                                borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                                boxShadow: loading ? 'none' : '0 4px 14px rgba(232,22,42,0.35)',
                                transition: 'all 0.2s', fontFamily: 'inherit',
                            }}
                        >
                            {loading ? '⏳ กำลังเข้าสู่ระบบ...' : '🔓 เข้าสู่ระบบ'}
                        </button>
                    </form>

                    {/* Contact & Registration Links */}
                    {(platformConfig?.REGISTER_URL || platformConfig?.CONTACT_URL) && (
                        <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {platformConfig?.REGISTER_URL && (
                                <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>
                                    ยังไม่มีบัญชีร้านค้า?{' '}
                                    <a
                                        href={platformConfig.REGISTER_URL}
                                        style={{ color: '#E8162A', fontWeight: 600, textDecoration: 'none' }}
                                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                    >
                                        ลงทะเบียนใช้งาน
                                    </a>
                                </p>
                            )}
                            {platformConfig?.CONTACT_URL && (
                                <p style={{ color: '#6B7280', fontSize: '0.9rem' }}>
                                    ต้องการความช่วยเหลือ?{' '}
                                    <a
                                        href={platformConfig.CONTACT_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#374151', fontWeight: 600, textDecoration: 'none' }}
                                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                    >
                                        ติดต่อฝ่ายสนับสนุน
                                    </a>
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
