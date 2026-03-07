'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Pre-computed particle data at module load — stable, no SSR mismatch
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
    size: Math.random() * 4 + 1,
    left: Math.random() * 100,
    top: Math.random() * 100,
    opacity: Math.random() * 0.6 + 0.2,
    duration: Math.random() * 8 + 6,
    delay: Math.random() * 4,
    color: i % 2 === 0 ? '99,102,241' : '139,92,246',
}))

function Particles() {
    return (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            {PARTICLES.map((p, i) => (
                <div key={i} style={{
                    position: 'absolute',
                    width: p.size + 'px', height: p.size + 'px',
                    borderRadius: '50%',
                    background: `rgba(${p.color},${p.opacity})`,
                    left: p.left + '%', top: p.top + '%',
                    animation: `float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
                }} />
            ))}
        </div>
    )
}

export default function AdminLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        // If already logged in, redirect to admin
        const token = localStorage.getItem('admin_token')
        if (token) router.replace('/admin')
    }, [router])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()
            if (!data.success) return setError(data.error || 'Login failed')
            if (data.token) localStorage.setItem('admin_token', data.token)
            router.push('/admin')
        } catch {
            setError('Network error — ไม่สามารถเชื่อมต่อได้')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #060818 0%, #0d0f1c 40%, #0a0c1a 60%, #060818 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Inter', system-ui, sans-serif",
            position: 'relative', overflow: 'hidden',
        }}>
            {/* Animated glow orbs */}
            <div style={{
                position: 'absolute', top: '-20%', left: '-10%',
                width: '60vw', height: '60vw', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
                animation: 'drift 12s ease-in-out infinite alternate',
            }} />
            <div style={{
                position: 'absolute', bottom: '-20%', right: '-10%',
                width: '50vw', height: '50vw', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
                animation: 'drift 10s ease-in-out 3s infinite alternate-reverse',
            }} />
            <div style={{
                position: 'absolute', top: '30%', right: '20%',
                width: '30vw', height: '30vw', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
                animation: 'drift 14s ease-in-out 1s infinite alternate',
            }} />

            {mounted && <Particles />}

            {/* Grid pattern overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `
                    linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
            }} />

            {/* Login card */}
            <div style={{
                position: 'relative', zIndex: 10,
                width: '100%', maxWidth: 420,
                margin: '0 20px',
                background: 'rgba(15, 18, 32, 0.7)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 24,
                padding: '44px 40px',
                boxShadow: `
                    0 0 0 1px rgba(255,255,255,0.04),
                    0 32px 64px rgba(0,0,0,0.5),
                    0 0 80px rgba(99,102,241,0.08),
                    inset 0 1px 0 rgba(255,255,255,0.06)
                `,
            }}>
                {/* Top accent line */}
                <div style={{
                    position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
                    background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.8), rgba(139,92,246,0.8), transparent)',
                    borderRadius: 1,
                }} />

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                        border: '1px solid rgba(99,102,241,0.4)',
                        fontSize: 36,
                        boxShadow: '0 0 40px rgba(99,102,241,0.3)',
                        position: 'relative', overflow: 'hidden',
                    }}>
                        <span>🛡️</span>
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), transparent)',
                        }} />
                    </div>

                    <h1 style={{
                        fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9',
                        margin: '0 0 4px', letterSpacing: '-0.03em',
                        background: 'linear-gradient(135deg, #e2e8f0, #c4b5fd)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        KAIDEEDER.com
                    </h1>
                    <p style={{
                        color: '#94a3b8', fontSize: '0.82rem', fontWeight: 500,
                        margin: '0 0 6px',
                    }}>
                        ระบบจัดการหลังบ้าน
                    </p>
                    <p style={{
                        color: '#6366f1', fontSize: '0.78rem', fontWeight: 600,
                        letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0,
                    }}>
                        ⚡ Super Admin Access
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 12, padding: '10px 14px', marginBottom: 20,
                        color: '#fca5a5', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: 8,
                        animation: 'shake 0.3s ease',
                    }}>
                        <span>⚠️</span> {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Admin Email
                        </label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', opacity: 0.6 }}>✉️</span>
                            <input
                                type="email"
                                placeholder="admin@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                style={{
                                    width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 13, paddingBottom: 13,
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12, color: '#f1f5f9', fontSize: '0.9rem',
                                    outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box',
                                    fontFamily: 'inherit',
                                }}
                                onFocus={e => {
                                    e.target.style.borderColor = 'rgba(99,102,241,0.6)'
                                    e.target.style.background = 'rgba(99,102,241,0.08)'
                                    e.target.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.1)'
                                }}
                                onBlur={e => {
                                    e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                                    e.target.style.background = 'rgba(255,255,255,0.04)'
                                    e.target.style.boxShadow = 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', opacity: 0.6 }}>🔑</span>
                            <input
                                type={showPass ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                style={{
                                    width: '100%', paddingLeft: 42, paddingRight: 48, paddingTop: 13, paddingBottom: 13,
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12, color: '#f1f5f9', fontSize: '0.9rem',
                                    outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box',
                                    fontFamily: 'inherit',
                                }}
                                onFocus={e => {
                                    e.target.style.borderColor = 'rgba(99,102,241,0.6)'
                                    e.target.style.background = 'rgba(99,102,241,0.08)'
                                    e.target.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.1)'
                                }}
                                onBlur={e => {
                                    e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                                    e.target.style.background = 'rgba(255,255,255,0.04)'
                                    e.target.style.boxShadow = 'none'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                style={{
                                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#64748b', fontSize: '1rem', padding: 4,
                                }}
                            >
                                {showPass ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: 8,
                            padding: '14px 24px',
                            background: loading
                                ? 'rgba(99,102,241,0.4)'
                                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            border: 'none', borderRadius: 14,
                            color: '#fff', fontSize: '1rem', fontWeight: 700,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit',
                            transition: 'all 0.2s',
                            position: 'relative', overflow: 'hidden',
                            boxShadow: loading ? 'none' : '0 8px 24px rgba(99,102,241,0.4)',
                            letterSpacing: '0.02em',
                        }}
                        onMouseEnter={e => { if (!loading) (e.currentTarget.style.transform = 'translateY(-1px)'); (e.currentTarget.style.boxShadow = '0 12px 32px rgba(99,102,241,0.5)') }}
                        onMouseLeave={e => { (e.currentTarget.style.transform = 'none'); (e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.4)') }}
                    >
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                                กำลังเข้าสู่ระบบ...
                            </span>
                        ) : (
                            '🛡️ Sign In to Admin'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div style={{ marginTop: 28, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <p style={{ color: '#334155', fontSize: '0.72rem', margin: 0, whiteSpace: 'nowrap' }}>Restricted Access Only</p>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                </div>
            </div>

            <style>{`
                @keyframes drift {
                    0% { transform: translate(0, 0) scale(1); }
                    100% { transform: translate(30px, -30px) scale(1.05); }
                }
                @keyframes float {
                    0% { transform: translateY(0) scale(1); opacity: 0.4; }
                    100% { transform: translateY(-40px) scale(1.2); opacity: 0.8; }
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-6px); }
                    75% { transform: translateX(6px); }
                }
                input::placeholder { color: #334155; }
            `}</style>
        </div>
    )
}
