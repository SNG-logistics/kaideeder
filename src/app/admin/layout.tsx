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
    { href: '/admin/config', label: 'Platform Settings', icon: '⚙️' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [pendingTopups, setPendingTopups] = useState(0)
    const [authChecked, setAuthChecked] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [pathname])

    // Login page — render fullscreen without sidebar
    if (pathname === '/admin/login') {
        return <>{children}</>
    }

    return (
        <div className="flex min-h-screen bg-[#0a0c14] text-slate-200 font-sans flex-col md:flex-row">
            {/* ── Mobile Top Bar (Hidden on Desktop) ───────────────────── */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-gradient-to-r from-[#0f1221] to-[#0d0f1c] sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm shadow-[0_2px_8px_rgba(99,102,241,0.4)]">
                        🛡️
                    </div>
                    <div>
                        <p className="text-sm font-bold leading-tight">Admin Portal</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isMobileMenuOpen
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        }
                    </svg>
                </button>
            </div>

            {/* ── Mobile Menu Overlay ── */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-[260px] md:w-[220px] 
                bg-gradient-to-b from-[#0f1221] to-[#0d0f1c] border-r border-white/5
                flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:relative md:flex'}
            `}>
                {/* Brand Logo (Visible mostly on desktop or top of drawer) */}
                <div className="p-6 md:p-5 border-b border-white/5 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-lg shadow-[0_4px_12px_rgba(99,102,241,0.4)]">
                            🛡️
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-200 leading-tight">Admin Portal</p>
                            <p className="text-[0.65rem] text-indigo-400 font-semibold tracking-wider uppercase">Super Admin</p>
                        </div>
                    </div>
                    {/* Close button for mobile inside drawer */}
                    <button className="md:hidden p-2 text-slate-400" onClick={() => setIsMobileMenuOpen(false)}>
                        ✕
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-3 md:p-3 flex flex-col gap-1 overflow-y-auto">
                    {NAV.map(n => {
                        const active = isActive(n)
                        return (
                            <Link
                                key={n.href}
                                href={n.href}
                                className={`
                                    flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all
                                    ${active
                                        ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 font-semibold text-white'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                                    }
                                `}
                            >
                                <span className="text-base">{n.icon}</span>
                                <span className="flex-1">{n.label}</span>
                                {n.icon === '💳' && pendingTopups > 0 && (
                                    <span className="bg-red-500 text-white text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                                        {pendingTopups}
                                    </span>
                                )}
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 md:p-5 border-t border-white/5 mt-auto">
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all text-left"
                    >
                        <span>🚪</span> Sign out
                    </button>
                </div>
            </aside>

            {/* ── Main ──────────────────────────────────────────────────── */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-x-hidden md:overflow-auto min-h-[calc(100vh-65px)] md:min-h-screen relative w-full">
                {children}
            </main>
        </div>
    )
}
