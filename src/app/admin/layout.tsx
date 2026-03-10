'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { adminFetch, clearAdminToken } from '@/lib/admin-fetch'
import { useEffect, useState } from 'react'

// ── SVG Icons (explicit size/color, no CSS classes) ───────────────────────────
function Ico({ d, size = 16, color = '#64748b', fill = 'none', sw = '1.8', children, vb = '0 0 24 24' }: {
    d?: string; size?: number; color?: string; fill?: string; sw?: string; children?: React.ReactNode; vb?: string
}) {
    return (
        <svg width={size} height={size} viewBox={vb} fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
            {d ? <path d={d} /> : children}
        </svg>
    )
}

const NAV_ITEMS = [
    { href: '/admin', label: 'Dashboard', exact: true, icon: (c: string) => <Ico color={c} size={16}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Ico> },
    { href: '/admin/tenants', label: 'Tenants', icon: (c: string) => <Ico d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9" color={c} size={16} /> },
    { href: '/admin/topups', label: 'Topup Approvals', badge: true, icon: (c: string) => <Ico color={c} size={16}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Ico> },
    { href: '/admin/plans', label: 'Plans', icon: (c: string) => <Ico d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" color={c} size={16} /> },
    { href: '/admin/audit-logs', label: 'Audit Logs', icon: (c: string) => <Ico d="M9 12h6M9 8h6M9 16h4M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" color={c} size={16} /> },
    { href: '/admin/config', label: 'Platform Settings', icon: (c: string) => <Ico color={c} size={16}><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" /></Ico> },
]

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
    bg: '#080c14', sidebar: '#0c1018', border: 'rgba(255,255,255,0.07)',
    accent: '#2563eb', accentHover: '#1d4ed8', accentLight: 'rgba(37,99,235,0.12)',
    accentBorder: 'rgba(37,99,235,0.3)', accentText: '#93c5fd',
    text: '#e2e8f0', textMuted: '#64748b', textDim: '#334155',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [pendingTopups, setPendingTopups] = useState(0)
    const [drawer, setDrawer] = useState(false)

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
        if (!token) { router.replace('/admin/login'); return }
        adminFetch('/api/admin/stats')
            .then(r => { if (r.status === 401 || r.status === 403) { localStorage.removeItem('admin_token'); router.replace('/admin/login'); return null } return r.json() })
            .then(d => { if (d?.success) setPendingTopups(d.data.pendingTopups) })
            .catch(() => { })
    }, [router])

    useEffect(() => { setDrawer(false) }, [pathname])

    async function logout() {
        await adminFetch('/api/admin/auth/login', { method: 'DELETE' }).catch(() => { })
        clearAdminToken(); router.push('/admin/login')
    }

    if (pathname === '/admin/login') return <>{children}</>

    function isActive(item: typeof NAV_ITEMS[0]) {
        return item.exact ? pathname === item.href : pathname.startsWith(item.href)
    }

    const Sidebar = () => (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.sidebar }}>
            {/* Brand */}
            <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(37,99,235,0.35)' }}>
                    <Ico color="white" size={17}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Ico>
                </div>
                <div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'white', letterSpacing: '-0.01em' }}>KAIDEEDER</div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: C.accentText, textTransform: 'uppercase' }}>Super Admin</div>
                </div>
            </div>
            {/* Nav */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', color: '#374151', textTransform: 'uppercase', padding: '2px 8px 8px' }}>Menu</div>
                {NAV_ITEMS.map(item => {
                    const active = isActive(item)
                    return (
                        <Link key={item.href} href={item.href} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '9px 12px', borderRadius: '10px', marginBottom: '2px',
                            background: active ? C.accentLight : 'transparent',
                            border: `1px solid ${active ? C.accentBorder : 'transparent'}`,
                            color: active ? C.accentText : C.textMuted,
                            fontSize: '0.82rem', fontWeight: active ? 600 : 400,
                            textDecoration: 'none', transition: 'all 0.12s',
                            position: 'relative',
                        }}>
                            {active && <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, background: C.accent, borderRadius: '0 3px 3px 0' }} />}
                            {item.icon(active ? '#60a5fa' : '#4b5563')}
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                            {item.badge && pendingTopups > 0 && (
                                <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 99, lineHeight: 1.4 }}>{pendingTopups}</span>
                            )}
                        </Link>
                    )
                })}
            </nav>
            {/* Logout */}
            <div style={{ padding: '10px', borderTop: `1px solid ${C.border}` }}>
                <button onClick={logout} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '9px 12px', borderRadius: '10px', border: 'none', background: 'none',
                    color: C.textMuted, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
                }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.background = 'none' }}
                >
                    <Ico color="currentColor" size={16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Ico>
                    Sign out
                </button>
            </div>
        </div>
    )

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Inter','Noto Sans Thai',system-ui,sans-serif" }}>
            <style>{`
                /* Reset globals.css conflicts for admin */
                .admin-portal thead th { background: transparent !important; color: #64748b !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; font-size: 0.72rem !important; letter-spacing: 0.06em !important; padding: 10px 16px !important; }
                .admin-portal tbody td { color: #cbd5e1 !important; border-bottom: 1px solid rgba(255,255,255,0.04) !important; padding: 12px 16px !important; font-size: 0.85rem !important; }
                .admin-portal tbody tr:last-child td { border-bottom: none !important; }
                .admin-portal tbody tr:hover td { background: rgba(255,255,255,0.03) !important; }
                .admin-portal input, .admin-portal select, .admin-portal textarea {
                    background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.1) !important;
                    color: #e2e8f0 !important; border-radius: 10px !important; font-family: inherit !important;
                }
                .admin-portal input:focus, .admin-portal select:focus { border-color: rgba(37,99,235,0.5) !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.1) !important; outline: none !important; }
                /* Desktop sidebar */
                @media (min-width: 768px) {
                    .admin-sidebar-fixed { display: flex !important; }
                    .admin-mobile-bar { display: none !important; }
                    .admin-drawer { display: none !important; }
                }
                /* Mobile */
                @media (max-width: 767px) {
                    .admin-sidebar-fixed { display: none !important; }
                    .admin-mobile-bar { display: flex !important; }
                    .admin-main-pad { padding: 16px !important; }
                }
            `}</style>

            {/* ── Desktop Sidebar ─────────────────────────────────── */}
            <div className="admin-sidebar-fixed" style={{ width: 230, flexShrink: 0, borderRight: `1px solid ${C.border}`, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
                <Sidebar />
            </div>

            {/* ── Mobile Top Bar ──────────────────────────────────── */}
            <div className="admin-mobile-bar" style={{ display: 'none', position: 'sticky', top: 0, zIndex: 40, alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.sidebar, borderBottom: `1px solid ${C.border}`, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 9, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Ico color="white" size={14}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Ico>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>Admin Portal</span>
                </div>
                <button onClick={() => setDrawer(!drawer)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, lineHeight: 0, padding: '6px' }}>
                    <Ico color="currentColor" size={22} sw="2">{drawer
                        ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>
                        : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
                    }</Ico>
                </button>
            </div>

            {/* ── Mobile Drawer ───────────────────────────────────── */}
            {drawer && (
                <>
                    <div className="admin-drawer" onClick={() => setDrawer(false)} style={{ display: 'block', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, backdropFilter: 'blur(3px)' }} />
                    <div className="admin-drawer" style={{ display: 'flex', position: 'fixed', left: 0, top: 0, bottom: 0, width: 250, zIndex: 60, boxShadow: '4px 0 24px rgba(0,0,0,0.5)' }}>
                        <Sidebar />
                    </div>
                </>
            )}

            {/* ── Main ────────────────────────────────────────────── */}
            <main className="admin-portal" style={{ flex: 1, minHeight: '100vh', overflowX: 'hidden' }}>
                <div className="admin-main-pad" style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto' }}>
                    {children}
                </div>
            </main>
        </div>
    )
}
