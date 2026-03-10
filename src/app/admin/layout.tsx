'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { adminFetch, clearAdminToken } from '@/lib/admin-fetch'
import { useEffect, useState } from 'react'

// ─── SVG Icons (explicit size/color props — no Tailwind sizing) ───────────────
const SZ = 16  // default icon size px

function IconDashboard({ size = SZ, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
}
function IconTenants({ size = SZ, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9" /></svg>
}
function IconTopup({ size = SZ, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></svg>
}
function IconPlans({ size = SZ, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
}
function IconAudit({ size = SZ, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6M9 8h6M9 16h4M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /></svg>
}
function IconConfig({ size = SZ, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></svg>
}
function IconLogout({ size = SZ, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
}
function IconMenu({ size = SZ, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
}
function IconClose({ size = SZ, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
}
function IconShield({ size = SZ, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
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

    const SB = {   // sidebar styles
        bg: '#0b0f18',
        border: 'rgba(255,255,255,0.06)',
        text: '#94a3b8',
        textActive: '#bfdbfe',
        bgActive: 'rgba(59,130,246,0.12)',
        borderActive: 'rgba(59,130,246,0.25)',
        iconActive: '#60a5fa',
        iconInactive: '#64748b',
    }

    return (
        <div className="admin-root flex min-h-screen flex-col md:flex-row" style={{ background: '#080c14', color: '#cbd5e1', fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* CSS reset for globals.css conflicts */}
            <style>{`
                .admin-root { background: #080c14 !important; }
                .admin-root thead th { background: transparent !important; color: #64748b !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; }
                .admin-root tbody td { color: #cbd5e1 !important; border-bottom: 1px solid rgba(255,255,255,0.04) !important; }
                .admin-root tbody tr:hover td { background: rgba(255,255,255,0.03) !important; }
            `}</style>

            {/* ── Mobile Top Bar ─────────────────────────────────────── */}
            <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: SB.bg, borderBottom: `1px solid ${SB.border}` }}>
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center rounded-xl" style={{ width: 30, height: 30, background: '#2563eb', flexShrink: 0 }}>
                        <IconShield size={15} color="white" />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>Admin Portal</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: SB.text, lineHeight: 0 }}>
                    {isMobileMenuOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
                </button>
            </div>

            {/* ── Mobile Overlay ─────────────────────────────────────── */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            )}

            {/* ── Sidebar ────────────────────────────────────────────── */}
            <aside className={`fixed inset-y-0 left-0 z-50 md:relative md:flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{ width: 220, background: SB.bg, borderRight: `1px solid ${SB.border}` }}>

                {/* Brand */}
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${SB.border}` }}>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 32, height: 32, background: '#2563eb', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}>
                            <IconShield size={16} color="white" />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', lineHeight: 1.2, margin: 0 }}>KAIDEEDER</p>
                            <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#60a5fa', margin: 0 }}>Super Admin</p>
                        </div>
                    </div>
                    <button className="md:hidden" onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: SB.text, lineHeight: 0 }}>
                        <IconClose size={16} />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto" style={{ padding: '10px 10px 0' }}>
                    <p style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569', padding: '10px 10px 6px', margin: 0 }}>Navigation</p>
                    <div className="flex flex-col" style={{ gap: '2px' }}>
                        {NAV.map(n => {
                            const active = isActive(n)
                            return (
                                <Link key={n.href} href={n.href} className="flex items-center rounded-xl relative" style={{
                                    gap: '10px', padding: '10px 12px',
                                    background: active ? SB.bgActive : 'transparent',
                                    border: `1px solid ${active ? SB.borderActive : 'transparent'}`,
                                    color: active ? SB.textActive : SB.text,
                                    fontSize: '0.82rem', fontWeight: active ? 600 : 400,
                                    textDecoration: 'none', transition: 'all 0.15s',
                                }}>
                                    {active && <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '20px', background: '#60a5fa', borderRadius: '0 3px 3px 0' }} />}
                                    <span style={{ flexShrink: 0, lineHeight: 0 }}>
                                        <n.Icon size={16} color={active ? SB.iconActive : SB.iconInactive} />
                                    </span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span>
                                    {n.badge && pendingTopups > 0 && (
                                        <span style={{ background: '#ef4444', color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '9999px', lineHeight: 1.4 }}>
                                            {pendingTopups}
                                        </span>
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                </nav>

                {/* Footer */}
                <div style={{ padding: '10px', borderTop: `1px solid ${SB.border}` }}>
                    <button onClick={logout} className="flex items-center w-full rounded-xl" style={{
                        gap: '10px', padding: '10px 12px', background: 'none', border: '1px solid transparent',
                        cursor: 'pointer', color: SB.text, fontSize: '0.82rem', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = SB.text; e.currentTarget.style.background = 'none' }}
                    >
                        <span style={{ flexShrink: 0, lineHeight: 0 }}>
                            <IconLogout size={16} />
                        </span>
                        Sign out
                    </button>
                </div>
            </aside>

            {/* ── Main Content ────────────────────────────────────────── */}
            <main className="flex-1 overflow-x-hidden" style={{ minHeight: '100vh' }}>
                <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>
                    {children}
                </div>
            </main>
        </div>
    )
}
