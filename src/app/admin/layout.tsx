'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { adminFetch, clearAdminToken } from '@/lib/admin-fetch'
import { useEffect, useState } from 'react'

// ─── Inline SVG Icons ────────────────────────────────────────────────────────
function IconDashboard({ className = '' }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
}
function IconTenants({ className = '' }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9" /></svg>
}
function IconTopup({ className = '' }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></svg>
}
function IconPlans({ className = '' }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
}
function IconAudit({ className = '' }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6M9 8h6M9 16h4M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /></svg>
}
function IconConfig({ className = '' }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>
}
function IconLogout({ className = '' }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
}
function IconMenu({ className = '' }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
}
function IconClose({ className = '' }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
}
function IconShield({ className = '' }) {
    return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
}

// ─── Nav Items ────────────────────────────────────────────────────────────────
const NAV = [
    { href: '/admin', label: 'Dashboard', Icon: IconDashboard, exact: true },
    { href: '/admin/tenants', label: 'Tenants', Icon: IconTenants },
    { href: '/admin/topups', label: 'Topup Approvals', Icon: IconTopup, badge: true },
    { href: '/admin/plans', label: 'Plans', Icon: IconPlans },
    { href: '/admin/audit-logs', label: 'Audit Logs', Icon: IconAudit },
    { href: '/admin/config', label: 'Platform Settings', Icon: IconConfig },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [pendingTopups, setPendingTopups] = useState(0)
    const [authChecked, setAuthChecked] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
        if (!token) { router.replace('/admin/login'); return }
        adminFetch('/api/admin/stats')
            .then(r => {
                if (r.status === 401 || r.status === 403) {
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

    useEffect(() => { setIsMobileMenuOpen(false) }, [pathname])

    if (pathname === '/admin/login') return <>{children}</>

    return (
        <div className="admin-root flex min-h-screen bg-[#080c14] text-slate-200 font-sans flex-col md:flex-row">
            {/* ── Global CSS Reset for Admin Dark Theme ─────────────────── */}
            <style>{`
                /* Override globals.css light-theme selectors within admin */
                .admin-root { background: #080c14 !important; color: #cbd5e1 !important; }
                .admin-root thead th { background: transparent !important; color: #64748b !important; border-bottom-color: rgba(255,255,255,0.06) !important; padding: 0.75rem 1rem !important; }
                .admin-root tbody td { color: #cbd5e1 !important; border-bottom-color: rgba(255,255,255,0.04) !important; padding: 0.75rem 1rem !important; font-size: 0.875rem !important; }
                .admin-root tbody tr:hover td { background: rgba(255,255,255,0.03) !important; }
                .admin-root .main-content { background: transparent !important; }
            `}</style>


            {/* ── Mobile Top Bar ───────────────────────────────────────── */}
            <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0b0f18] sticky top-0 z-40">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <IconShield className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-white">Admin Portal</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                    {isMobileMenuOpen ? <IconClose className="w-5 h-5" /> : <IconMenu className="w-5 h-5" />}
                </button>
            </div>

            {/* ── Mobile Overlay ───────────────────────────────────────── */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 md:w-56
                bg-[#0b0f18] border-r border-white/[0.06]
                flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 md:relative md:flex
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Brand */}
                <div className="px-5 py-5 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
                            <IconShield className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-[0.82rem] font-bold text-white leading-tight">KAIDEEDER</p>
                            <p className="text-[0.62rem] font-semibold tracking-widest text-blue-400 uppercase">Super Admin</p>
                        </div>
                    </div>
                    <button className="md:hidden p-1 text-slate-500 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
                        <IconClose className="w-4 h-4" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-2.5 flex flex-col gap-0.5 overflow-y-auto">
                    <p className="text-[0.6rem] font-bold tracking-widest text-slate-600 uppercase px-3 pt-3 pb-1.5">Navigation</p>
                    {NAV.map(n => {
                        const active = isActive(n)
                        return (
                            <Link
                                key={n.href}
                                href={n.href}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.82rem] font-medium transition-all group relative
                                    ${active
                                        ? 'bg-blue-600/15 text-blue-300 border border-blue-500/25'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                                    }
                                `}
                            >
                                <n.Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                <span className="flex-1 truncate">{n.label}</span>
                                {n.badge && pendingTopups > 0 && (
                                    <span className="bg-red-500 text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center leading-none">
                                        {pendingTopups}
                                    </span>
                                )}
                                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-r-full" />}
                            </Link>
                        )
                    })}
                </nav>

                {/* Footer */}
                <div className="p-2.5 border-t border-white/[0.06]">
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.82rem] text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all group border border-transparent"
                    >
                        <IconLogout className="w-4 h-4 flex-shrink-0 group-hover:text-red-400 transition-colors" />
                        Sign out
                    </button>
                </div>
            </aside>

            {/* ── Main Content ─────────────────────────────────────────── */}
            <main className="flex-1 overflow-x-hidden min-h-screen">
                <div className="p-5 sm:p-7 md:p-8 max-w-[1400px] mx-auto">
                    {children}
                </div>
            </main>
        </div>
    )
}
