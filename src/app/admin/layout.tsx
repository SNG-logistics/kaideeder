'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { adminFetch, clearAdminToken } from '@/lib/admin-fetch'
import { useEffect, useState } from 'react'

const NAV = [
    { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
    { href: '/admin/tenants', label: 'Tenants', icon: '🏬' },
    { href: '/admin/topups', label: 'Topup Approvals', icon: '💳' },
    { href: '/admin/plans', label: 'Plans', icon: '📦' },
    { href: '/admin/audit-logs', label: 'Audit Logs', icon: '📋' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [pendingTopups, setPendingTopups] = useState(0)
    const [authChecked, setAuthChecked] = useState(false)

    useEffect(() => {
        // Check if admin token exists
        const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
        if (!token) {
            router.replace('/admin/login')
            return
        }
        // Verify token by calling stats API
        adminFetch('/api/admin/stats')
            .then(r => {
                if (r.status === 401 || r.status === 403) {
                    // Token expired or invalid — redirect to login
                    localStorage.removeItem('admin_token')
                    router.replace('/admin/login')
                    return null
                }
                return r.json()
            })
            .then(d => {
                if (d && d.success) setPendingTopups(d.data.pendingTopups)
                setAuthChecked(true)
            })
            .catch(() => setAuthChecked(true))
    }, [router])

    async function logout() {
        await adminFetch('/api/admin/auth/login', { method: 'DELETE' }).catch(() => { })
        clearAdminToken()
        router.push('/admin/login')
    }

    function isActive(nav: typeof NAV[0]) {
        if (nav.exact) return pathname === nav.href
        return pathname.startsWith(nav.href)
    }

    // Login page — render fullscreen without sidebar
    if (pathname === '/admin/login') {
        return <>{children}</>
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0c14', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <aside style={{
                width: 220, minWidth: 220,
                background: 'linear-gradient(180deg, #0f1221 0%, #0d0f1c 100%)',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column',
            }}>
                {/* Brand */}
                <div style={{
                    padding: '1.5rem 1.25rem 1.25rem',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
                        }}>🛡️</div>
                        <div>
                            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>Admin Portal</p>
                            <p style={{ fontSize: '0.65rem', color: '#6366f1', letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>Super Admin</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {NAV.map(n => {
                        const active = isActive(n)
                        return (
                            <Link
                                key={n.href}
                                href={n.href}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '0.6rem 0.875rem',
                                    borderRadius: 8,
                                    fontSize: '0.875rem',
                                    fontWeight: active ? 600 : 400,
                                    color: active ? '#fff' : '#94a3b8',
                                    background: active ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))' : 'transparent',
                                    border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                                    textDecoration: 'none',
                                    transition: 'all 0.15s',
                                    position: 'relative',
                                }}
                            >
                                <span style={{ fontSize: '1rem' }}>{n.icon}</span>
                                <span style={{ flex: 1 }}>{n.label}</span>
                                {n.icon === '💳' && pendingTopups > 0 && (
                                    <span style={{
                                        background: '#ef4444',
                                        color: '#fff',
                                        fontSize: '0.6rem',
                                        fontWeight: 700,
                                        padding: '1px 6px',
                                        borderRadius: 999,
                                        minWidth: 18,
                                        textAlign: 'center',
                                    }}>{pendingTopups}</span>
                                )}
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.25rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <button
                        onClick={logout}
                        style={{
                            width: '100%', textAlign: 'left',
                            background: 'none', border: 'none',
                            color: '#64748b', fontSize: '0.8rem',
                            padding: '0.5rem 0.875rem', borderRadius: 8,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
                    >
                        <span>🚪</span> Sign out
                    </button>
                </div>
            </aside>

            {/* ── Main ──────────────────────────────────────────────────── */}
            <main style={{ flex: 1, padding: '2rem', overflow: 'auto', minHeight: '100vh' }}>
                {children}
            </main>
        </div>
    )
}
