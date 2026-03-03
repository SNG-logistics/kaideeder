'use client'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useSidebar } from './SidebarContext'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const ROLE_LABELS: Record<string, string> = {
    owner: '👑 เจ้าของ', manager: '📊 ผู้จัดการ', cashier: '💰 แคชเชียร์',
    kitchen: '🍳 ครัว', bar: '🍸 บาร์', warehouse: '🏭 คลัง',
}
const ROLE_COLORS: Record<string, string> = {
    owner: '#F59E0B', manager: '#3B82F6', cashier: '#10B981',
    kitchen: '#EF4444', bar: '#8B5CF6', warehouse: '#6B7280',
}

const pageNames: Record<string, string> = {
    '/dashboard': 'Restaurant Dashboard',
    '/inventory': 'สต็อคคลัง',
    '/purchase': 'ซื้อเข้า / GR',
    '/transfer': 'เบิก / โอนคลัง',
    '/sales-import': 'นำเข้ายอดขาย',
    '/products': 'จัดการสินค้า',
    '/recipes': 'สูตรอาหาร (BOM)',
    '/adjustment': 'ปรับสต็อค',
    '/reports': 'Reports',
    '/qr-sheets': 'พิมพ์ QR Sheet',
    '/settings': 'Settings',
    '/ai-chat': 'AI Assistant',
}

export default function Topbar() {
    const pathname = usePathname()
    const [time, setTime] = useState('')
    const { toggle, isMobile } = useSidebar()
    const currentUser = useCurrentUser()

    useEffect(() => {
        const tick = () => setTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))
        tick()
        const id = setInterval(tick, 30000)
        return () => clearInterval(id)
    }, [])

    const pageName = Object.entries(pageNames).find(([key]) =>
        pathname === key || pathname.startsWith(key + '/')
    )?.[1] ?? 'Dashboard'

    const breadcrumb = pathname.split('/').filter(Boolean)

    return (
        <header style={{
            height: 56,
            background: '#FFFFFF',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem',
            position: 'sticky',
            top: 0,
            zIndex: 40,
            gap: 8,
        }}>
            {/* Left: Hamburger + Title + Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {/* Hamburger for mobile / collapse toggle */}
                <button
                    onClick={toggle}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '1.2rem', color: '#6B7280', padding: 6,
                        borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 36, minHeight: 36,
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F3F4F6' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                >
                    ☰
                </button>
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontSize: isMobile ? '0.95rem' : '1.05rem', fontWeight: 700, color: '#1A1D26', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pageName}</h1>
                    {!isMobile && (
                        <div style={{ display: 'flex', gap: 4, fontSize: '0.7rem', color: '#9CA3AF', marginTop: 1 }}>
                            <span>Home</span>
                            {breadcrumb.map((seg, i) => (
                                <span key={i}>
                                    <span style={{ margin: '0 3px' }}>/</span>
                                    <span style={{ color: i === breadcrumb.length - 1 ? '#E8364E' : '#9CA3AF', textTransform: 'capitalize' }}>
                                        {decodeURIComponent(seg)}
                                    </span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Search + Notifications + User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
                {/* Search — hidden on mobile */}
                {!isMobile && (
                    <div style={{ position: 'relative' }}>
                        <input
                            placeholder="ค้นหา..."
                            style={{
                                width: 180, padding: '0.4rem 0.7rem 0.4rem 2rem',
                                background: '#F3F4F6', border: '1px solid transparent',
                                borderRadius: 10, fontSize: '0.8rem', color: '#1A1D26',
                                outline: 'none', fontFamily: 'inherit', transition: 'all 0.15s',
                            }}
                            onFocus={e => {
                                e.currentTarget.style.borderColor = '#E8364E'
                                e.currentTarget.style.background = '#fff'
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,54,78,0.08)'
                            }}
                            onBlur={e => {
                                e.currentTarget.style.borderColor = 'transparent'
                                e.currentTarget.style.background = '#F3F4F6'
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                        />
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: '#9CA3AF' }}>🔍</span>
                    </div>
                )}

                {/* Notifications */}
                <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', position: 'relative', fontSize: '0.9rem',
                }}>
                    🔔
                    <span style={{
                        position: 'absolute', top: -2, right: -2,
                        width: 14, height: 14, borderRadius: '50%',
                        background: '#E8364E', color: '#fff',
                        fontSize: '0.55rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>3</span>
                </div>

                {/* Divider — hidden on mobile */}
                {!isMobile && <div style={{ width: 1, height: 24, background: '#E5E7EB' }} />}

                {/* User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 32, height: 32,
                        background: `linear-gradient(135deg, ${ROLE_COLORS[currentUser?.role || 'owner']}, ${ROLE_COLORS[currentUser?.role || 'owner']}99)`,
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: '#fff',
                    }}>{currentUser?.name?.[0]?.toUpperCase() ?? 'A'}</div>
                    {!isMobile && (
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1A1D26' }}>{currentUser?.name ?? '...'}</div>
                            <div style={{ fontSize: '0.65rem', color: ROLE_COLORS[currentUser?.role || 'owner'], fontWeight: 500 }}>{ROLE_LABELS[currentUser?.role || ''] ?? currentUser?.role ?? ''}</div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
