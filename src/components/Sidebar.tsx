'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from './SidebarContext'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useStoreBranding } from '@/hooks/useStoreBranding'
import { useT } from '@/context/TenantContext'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
const TableManagerPanel = dynamic(() => import('./TableManagerPanel'), { ssr: false })

// nav items — label is an i18n key
type NavItem = {
    href: string
    icon: string
    labelKey: string
    accent?: boolean
    dividerKey?: string
    /** If set, user must have this permission to see this item */
    permission?: string
}

const navItems: NavItem[] = [
    { href: '/pos', icon: '💰', labelKey: 'nav_pos', accent: true, permission: 'POS_USE' },
    { href: '/kitchen', icon: '🍳', labelKey: 'nav_kitchen', accent: true, permission: 'KITCHEN_VIEW' },
    { href: '/waiter', icon: '🍽️', labelKey: 'nav_waiter', accent: true, permission: 'KITCHEN_VIEW' },
    { href: '/dashboard', icon: '🏠', labelKey: 'nav_home', permission: 'DASHBOARD_VIEW' },
    { href: '/menu', icon: '🍽️', labelKey: 'nav_menu', dividerKey: 'div_menu_stock', permission: 'MENU_VIEW' },
    { href: '/recipes', icon: '📋', labelKey: 'nav_recipes', permission: 'RECIPE_VIEW' },
    { href: '/products', icon: '🥩', labelKey: 'nav_products', permission: 'PRODUCT_VIEW' },
    { href: '/inventory', icon: '📦', labelKey: 'nav_inventory', permission: 'INVENTORY_VIEW' },
    { href: '/purchase', icon: '🛒', labelKey: 'nav_purchase', permission: 'PURCHASE_VIEW' },
    { href: '/transfer', icon: '🔄', labelKey: 'nav_transfer', permission: 'TRANSFER_USE' },
    { href: '/adjustment', icon: '⚖️', labelKey: 'nav_adjustment', permission: 'ADJUSTMENT_USE' },
    { href: '/sales-import', icon: '💾', labelKey: 'nav_sales_import', permission: 'SALES_IMPORT' },
    { href: '/sku-queue', icon: '🔍', labelKey: 'nav_sku_queue', permission: 'SETTINGS_MANAGE' },
    { href: '/reports', icon: '📈', labelKey: 'nav_reports', permission: 'REPORT_VIEW' },
    { href: '/ai-chat', icon: '🤖', labelKey: 'nav_ai', permission: 'AI_CHAT' },
    { href: '/settings/users', icon: '👥', labelKey: 'nav_users', dividerKey: 'div_manage', permission: 'SETTINGS_MANAGE' },
    { href: '/settings/manual', icon: '📖', labelKey: 'nav_manual', permission: 'SETTINGS_MANAGE' },
]

const quickItems: NavItem[] = [
    { href: '/quick-receive', icon: '⚡', labelKey: 'nav_quick_receive', permission: 'QUICK_RECEIVE' },
    { href: '/quick-waste', icon: '🗑️', labelKey: 'nav_quick_waste', permission: 'WASTE_LOG' },
    { href: '/qr-sheets', icon: '🖨️', labelKey: 'nav_qr_sheets', permission: 'SETTINGS_MANAGE' },
]

// ─── Role display config ─────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
    owner: { label: '👑 เจ้าของ', color: '#F59E0B' },
    manager: { label: '📊 ผู้จัดการ', color: '#3B82F6' },
    purchaser: { label: '🛒 ผู้ซื้อ', color: '#0EA5E9' },
    cashier: { label: '💰 แคชเชียร์', color: '#10B981' },
    kitchen: { label: '🍳 ครัว', color: '#EF4444' },
    bar: { label: '🍸 บาร์', color: '#8B5CF6' },
    warehouse: { label: '🏭 คลัง', color: '#6B7280' },
    waiter: { label: '🍽️ เสิร์ฟ', color: '#059669' },
    viewer: { label: '👁 ดูข้อมูล', color: '#9CA3AF' },
}

export default function Sidebar() {
    const pathname = usePathname()
    const { collapsed, toggle, mobileOpen, setMobileOpen, isMobile } = useSidebar()
    const currentUser = useCurrentUser()
    const userRole = (currentUser?.role || 'owner').toLowerCase()
    const branding = useStoreBranding()
    const t = useT()
    const [showTableManager, setShowTableManager] = useState(false)
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])
    const canManageTables = mounted && (userRole === 'owner' || userRole === 'manager')

    const sidebarWidth = collapsed && !isMobile ? 68 : 240
    const showLabels = isMobile ? true : !collapsed

    const isVisible = isMobile ? mobileOpen : true
    if (!isVisible && isMobile) return null

    const userPermissions = new Set<string>(currentUser?.permissions ?? [])

    const filteredNav = navItems.filter(item => !item.permission || userPermissions.has(item.permission))
    const filteredQuick = quickItems.filter(item => !item.permission || userPermissions.has(item.permission))
    const roleConfig = ROLE_CONFIG[userRole]

    return (
        <>
            {/* Table Manager Panel */}
            {showTableManager && <TableManagerPanel onClose={() => setShowTableManager(false)} />}
            {/* Backdrop for mobile */}
            {isMobile && mobileOpen && (
                <div
                    onClick={() => setMobileOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        zIndex: 49, backdropFilter: 'blur(2px)',
                    }}
                />
            )}

            <aside style={{
                width: sidebarWidth, minWidth: sidebarWidth,
                background: 'var(--white)', borderRight: '1px solid var(--border)',
                height: '100vh', position: 'fixed', left: 0, top: 0,
                display: 'flex', flexDirection: 'column',
                zIndex: 50, overflowY: 'auto', overflowX: 'hidden',
                transition: 'width 0.2s ease, min-width 0.2s ease',
                boxShadow: isMobile ? '4px 0 24px rgba(0,0,0,0.15)' : 'none',
            }}>
                {/* Logo + Toggle */}
                <div style={{
                    padding: collapsed && !isMobile ? '1rem 0.5rem' : '1.25rem 1.25rem',
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex', alignItems: 'center', gap: 10,
                    justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
                    transition: 'padding 0.2s ease',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                        {/* Logo icon OR uploaded image */}
                        {branding.logoUrl ? (
                            <img
                                src={branding.logoUrl}
                                alt="logo"
                                style={{
                                    width: 36, height: 36, minWidth: 36,
                                    borderRadius: 10, objectFit: 'cover',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                }}
                            />
                        ) : (
                            <div style={{
                                width: 36, height: 36, minWidth: 36,
                                background: 'linear-gradient(135deg, #E8364E, #FF6B81)',
                                borderRadius: 10,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 18, color: '#fff',
                                boxShadow: '0 4px 12px rgba(232,54,78,0.3)',
                            }}>🍽️</div>
                        )}
                        {showLabels && (
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                <p style={{ color: '#1A1D26', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>{branding.displayName}</p>
                                <p style={{ color: '#9CA3AF', fontSize: '0.65rem', letterSpacing: '0.04em' }}>Stock System</p>
                            </div>
                        )}
                    </div>
                    <button onClick={toggle} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '1.1rem', color: '#9CA3AF', padding: 4,
                        borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'color 0.15s', minWidth: 28, minHeight: 28,
                    }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1A1D26' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF' }}
                        title={collapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
                    >
                        {isMobile ? '✕' : collapsed ? '☰' : '←'}
                    </button>
                </div>

                {/* Role badge */}
                {showLabels && currentUser && (
                    <div style={{
                        margin: '8px 12px 0',
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: `${roleConfig?.color || '#E8364E'}15`,
                        border: `1px solid ${roleConfig?.color || '#E8364E'}30`,
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: `${roleConfig?.color || '#E8364E'}25`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.85rem', fontWeight: 700,
                            color: roleConfig?.color || '#E8364E',
                        }}>
                            {currentUser.name[0]?.toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1A1D26', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</div>
                            <div style={{ fontSize: '0.62rem', color: roleConfig?.color || '#E8364E', fontWeight: 600 }}>{roleConfig?.label || userRole}</div>
                        </div>
                    </div>
                )}

                {/* Nav */}
                <nav style={{
                    flex: 1,
                    padding: collapsed && !isMobile ? '0.75rem 0.35rem' : '0.75rem 0.75rem',
                    display: 'flex', flexDirection: 'column', gap: 2,
                    transition: 'padding 0.2s ease',
                }}>
                    {filteredNav.map(item => {
                        const active = pathname === item.href || pathname.startsWith(item.href + '/')
                        const isPOS = item.accent
                        const divider = item.dividerKey

                        let bg = 'transparent', color = '#6B7280', shadow = 'none'
                        if (active && isPOS) { bg = 'linear-gradient(135deg, #059669, #10B981)'; color = '#fff'; shadow = '0 2px 8px rgba(5,150,105,0.35)' }
                        else if (active) { bg = '#E8364E'; color = '#fff'; shadow = '0 2px 8px rgba(232,54,78,0.25)' }
                        else if (isPOS) { bg = 'rgba(5,150,105,0.06)'; color = '#059669' }

                        return (
                            <div key={item.href}>
                                {divider && showLabels && (
                                    <div style={{ margin: '10px 0 4px', paddingLeft: '0.875rem', fontSize: '0.6rem', fontWeight: 700, color: '#D1D5DB', letterSpacing: '0.08em', textTransform: 'uppercase', borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>📂 {t(item.dividerKey!)}</div>
                                )}
                                {divider && !showLabels && (<div style={{ height: 1, background: '#F3F4F6', margin: '6px 4px' }} />)}
                                <Link href={item.href} onClick={() => isMobile && setMobileOpen(false)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: collapsed && !isMobile ? '0.6rem' : '0.6rem 0.875rem',
                                        borderRadius: 10, fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                                        textDecoration: 'none', transition: 'all 0.15s ease',
                                        background: bg, color, boxShadow: shadow,
                                        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start', minHeight: 40,
                                    }}
                                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = isPOS ? 'rgba(5,150,105,0.1)' : '#F3F4F6'; (e.currentTarget as HTMLElement).style.color = isPOS ? '#047857' : '#1A1D26' } }}
                                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = isPOS ? 'rgba(5,150,105,0.06)' : 'transparent'; (e.currentTarget as HTMLElement).style.color = isPOS ? '#059669' : '#6B7280' } }}
                                    title={collapsed && !isMobile ? t(item.labelKey) : undefined}
                                >
                                    <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>{item.icon}</span>
                                    {showLabels && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(item.labelKey)}</span>}
                                </Link>
                            </div>
                        )
                    })}

                    {/* Table Manager Button — owner/manager only */}
                    {canManageTables && (
                        <>
                            {showLabels ? (
                                <div style={{ margin: '8px 0 4px', paddingLeft: '0.875rem', fontSize: '0.65rem', fontWeight: 700, color: '#D1D5DB', letterSpacing: '0.08em', textTransform: 'uppercase' }}>🪑 {t('div_manage')}</div>
                            ) : (
                                <div style={{ height: 1, background: '#E5E7EB', margin: '6px 4px' }} />
                            )}
                            <button
                                onClick={() => setShowTableManager(true)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                    padding: collapsed && !isMobile ? '0.6rem' : '0.6rem 0.875rem',
                                    borderRadius: 10, fontSize: '0.875rem',
                                    background: 'rgba(99,102,241,0.08)', color: '#6366f1',
                                    border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', fontFamily: 'inherit',
                                    transition: 'all 0.15s ease',
                                    justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                                    minHeight: 40, fontWeight: 600,
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.18)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)' }}
                                title={collapsed && !isMobile ? t('nav_tables') : undefined}
                            >
                                <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>🪑</span>
                                {showLabels && <span style={{ whiteSpace: 'nowrap' }}>{t('nav_tables')}</span>}
                            </button>
                        </>
                    )}

                    {/* Quick Actions */}
                    {filteredQuick.length > 0 && (
                        <>
                            {showLabels ? (
                                <div style={{ margin: '8px 0 4px', paddingLeft: '0.875rem', fontSize: '0.65rem', fontWeight: 700, color: '#D1D5DB', letterSpacing: '0.08em', textTransform: 'uppercase' }}>⚡ Quick Actions</div>
                            ) : (
                                <div style={{ margin: '8px 0 4px', textAlign: 'center' }}><div style={{ height: 1, background: '#E5E7EB', margin: '0 4px' }} /></div>
                            )}
                            {filteredQuick.map(item => {
                                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                                return (
                                    <Link key={item.href} href={item.href} onClick={() => isMobile && setMobileOpen(false)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: collapsed && !isMobile ? '0.6rem' : '0.6rem 0.875rem',
                                            borderRadius: 10, fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                                            textDecoration: 'none', transition: 'all 0.15s ease',
                                            background: active ? '#16a34a' : 'transparent',
                                            color: active ? '#fff' : '#6B7280',
                                            boxShadow: active ? '0 2px 8px rgba(22,163,74,0.25)' : 'none',
                                            justifyContent: collapsed && !isMobile ? 'center' : 'flex-start', minHeight: 40,
                                        }}
                                        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = '#F0FDF4'; (e.currentTarget as HTMLElement).style.color = '#166534' } }}
                                        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6B7280' } }}
                                        title={collapsed && !isMobile ? t(item.labelKey) : undefined}
                                    >
                                        <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>{item.icon}</span>
                                        {showLabels && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(item.labelKey)}</span>}
                                    </Link>
                                )
                            })}
                        </>
                    )}

                    {/* Settings — SETTINGS_MANAGE permission required */}
                    {userPermissions.has('SETTINGS_MANAGE') && (
                        <Link href="/settings" onClick={() => isMobile && setMobileOpen(false)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: collapsed && !isMobile ? '0.6rem' : '0.6rem 0.875rem',
                                borderRadius: 10, fontSize: '0.875rem', textDecoration: 'none',
                                color: '#6B7280', marginTop: 4,
                                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start', minHeight: 40,
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F3F4F6'; (e.currentTarget as HTMLElement).style.color = '#1A1D26' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6B7280' }}
                            title={collapsed && !isMobile ? 'Settings' : undefined}
                        >
                            <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>⚙️</span>
                            {showLabels && <span>Settings</span>}
                        </Link>
                    )}
                </nav>

                {/* Logout */}
                <div style={{ borderTop: '1px solid #E5E7EB', padding: '0.75rem' }}>
                    <button onClick={async () => {
                        await fetch('/api/auth/login', { method: 'DELETE' })
                        window.location.href = '/login'
                    }} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: collapsed && !isMobile ? '0.6rem' : '0.6rem 0.875rem',
                        borderRadius: 10, fontSize: '0.875rem', color: '#9CA3AF',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.15s ease',
                        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start', minHeight: 40,
                    }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626'; (e.currentTarget as HTMLElement).style.background = '#FEF2F2' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        title={collapsed && !isMobile ? 'Log out' : undefined}
                    >
                        <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>🚪</span>
                        {showLabels && <span>Log out</span>}
                    </button>
                </div>
            </aside>
        </>
    )
}
