'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from './SidebarContext'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useStoreBranding } from '@/hooks/useStoreBranding'
import { useT, useTenant } from '@/context/TenantContext'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
const TableManagerPanel = dynamic(() => import('./TableManagerPanel'), { ssr: false })

// nav items — label = Thai, labelLo = Lao
type NavItem = {
    href: string
    icon: string
    label: string      // Thai (always shown as fallback)
    labelLo?: string   // Lao (shown when language = 'lo')
    accent?: boolean
    divider?: string       // Thai divider
    dividerLo?: string     // Lao divider
    permission?: string
}

const navItems: NavItem[] = [
    // ── Operations ──────────────────────────────────────────────────────
    { href: '/pos',     icon: '💰', label: 'POS ขายหน้าร้าน', labelLo: 'POS ຂາຍໜ້າຮ້ານ', accent: true, permission: 'POS_USE' },
    { href: '/kitchen', icon: '🍳', label: 'จอครัว (KDS)',    labelLo: 'ຈໍຄົວ (KDS)',     accent: true, permission: 'KITCHEN_VIEW' },
    { href: '/waiter',  icon: '🍽️', label: 'หน้าเสิร์ฟ',     labelLo: 'ໜ້າເສີບ',        accent: true, permission: 'KITCHEN_VIEW' },
    { href: '/dashboard', icon: '🏠', label: 'Home', labelLo: 'Home', permission: 'DASHBOARD_VIEW' },

    // ── Catalog & Master ─────────────────────────────────────────────────
    { href: '/menu',              icon: '🍽️', label: 'เมนูอาหาร',              labelLo: 'ເມນູອາຫານ',             divider: '📋 Catalog & Master', dividerLo: '📋 Catalog & Master', permission: 'MENU_VIEW' },
    { href: '/inventory-catalog', icon: '🧺', label: 'คลังวัตถุดิบ (Catalog)',  labelLo: 'ຄັງວັດຖຸດິບ (Catalog)', permission: 'PRODUCT_VIEW' },

    // ── Production ───────────────────────────────────────────────────────
    { href: '/recipes',      icon: '📋', label: 'สูตรเมนู (BOM)',            labelLo: 'ສູດເມນູ (BOM)',          divider: '🍳 Production', dividerLo: '🍳 Production', permission: 'RECIPE_VIEW' },
    { href: '/prep-recipes', icon: '🧪', label: 'สูตรเตรียมวัตถุดิบ (Prep)', labelLo: 'ສູດຕຽມວັດຖຸດິບ (Prep)', permission: 'SETTINGS_MANAGE' },

    // ── Stock Operations ─────────────────────────────────────────────────
    { href: '/purchase',    icon: '🛒', label: 'รับสินค้า / GR',           labelLo: 'ຮັບສິນຄ້າ / GR',        divider: '📦 Stock Operations', dividerLo: '📦 Stock Operations', permission: 'PURCHASE_VIEW' },
    { href: '/stock-count', icon: '📋', label: 'นับสต็อค (Physical Count)', labelLo: 'ນັບສະຕ໋ອກ (Physical)', permission: 'INVENTORY_VIEW' },
    { href: '/transfer',    icon: '🔄', label: 'เบิก / โอนคลัง',           labelLo: 'ເບີກ / ໂອນຄັງ',         permission: 'TRANSFER_USE' },
    { href: '/adjustment',  icon: '⚖️', label: 'บันทึกปรับยอดสต็อค',      labelLo: 'ປ່ຽນຍອດສະຕ໋ອກ',         permission: 'ADJUSTMENT_USE' },

    // ── Stock Control (read-only) ────────────────────────────────────────
    { href: '/inventory', icon: '📦', label: 'ยอดสต็อครายคลัง', labelLo: 'ຍອດສະຕ໋ອກລາຍຄັງ', divider: '📊 Stock Control', dividerLo: '📊 Stock Control', permission: 'INVENTORY_VIEW' },

    // ── AI & Exceptions ──────────────────────────────────────────────────
    { href: '/inventory-catalog/recommendation-inbox', icon: '📥', label: 'Recommendation Inbox', labelLo: 'Recommendation Inbox', divider: '⚠️ AI & Exceptions', dividerLo: '⚠️ AI & Exceptions', permission: 'PRODUCT_VIEW' },
    { href: '/consume-fail', icon: '⚠️', label: 'ปัญหาตัดสต็อค', labelLo: 'ບັນຫາຕັດສະຕ໋ອກ', permission: 'SETTINGS_MANAGE' },
    { href: '/ai-chat',      icon: '🤖', label: 'AI Assistant',   labelLo: 'AI Assistant',    permission: 'AI_CHAT' },

    // ── Reports ──────────────────────────────────────────────────────────
    { href: '/reports',      icon: '📈', label: 'รายงาน & วิเคราะห์',    labelLo: 'ລາຍງານ & ວິເຄາະ',      divider: '📈 Reports', dividerLo: '📈 Reports', permission: 'REPORT_VIEW' },
    { href: '/sales-import', icon: '💾', label: 'นำเข้าข้อมูลยอดขาย', labelLo: 'ນຳເຂົ້າຂໍ້ມູນຍອດຂາຍ', permission: 'SALES_IMPORT' },
]

const quickItems: NavItem[] = [
    { href: '/quick-waste', icon: '🗑️', label: 'บันทึก Waste', labelLo: 'ບັນທຶກ Waste', permission: 'WASTE_LOG' },
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
    const { settings } = useTenant()
    const lang = settings?.language ?? 'th'
    const L = (th: string, lo?: string) => lang === 'lo' && lo ? lo : th
    const [showTableManager, setShowTableManager] = useState(false)
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])
    const canManageTables = mounted && (userRole === 'owner' || userRole === 'manager')
    const [failCount, setFailCount] = useState(0)
    const [lowStockCount, setLowStockCount] = useState(0)

    useEffect(() => {
        if (!mounted) return
        if (userRole !== 'owner' && userRole !== 'manager') return
        const fetchFail = () =>
            fetch('/api/consume-fail?status=OPEN&limit=1')
                .then(r => r.json())
                .then(j => j.success && setFailCount(j.data.total))
                .catch(() => {})
        const fetchLow = () =>
            fetch('/api/alerts/low-stock?count=1')
                .then(r => r.json())
                .then(j => j.success && setLowStockCount(j.data.total ?? 0))
                .catch(() => {})
        fetchFail()
        fetchLow()
        const interval = setInterval(() => { fetchFail(); fetchLow() }, 60_000)
        return () => clearInterval(interval)
    }, [mounted, userRole])

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

            <aside suppressHydrationWarning style={{
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
                    <button suppressHydrationWarning onClick={toggle} style={{
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
                        const divider = item.divider

                        let bg = 'transparent', color = '#6B7280', shadow = 'none'
                        if (active && isPOS) { bg = 'linear-gradient(135deg, #059669, #10B981)'; color = '#fff'; shadow = '0 2px 8px rgba(5,150,105,0.35)' }
                        else if (active) { bg = '#E8364E'; color = '#fff'; shadow = '0 2px 8px rgba(232,54,78,0.25)' }
                        else if (isPOS) { bg = 'rgba(5,150,105,0.06)'; color = '#059669' }

                        return (
                            <div key={item.href}>
                                 {divider && showLabels && (
                                    <div style={{ margin: '10px 0 4px', paddingLeft: '0.875rem', fontSize: '0.6rem', fontWeight: 700, color: '#D1D5DB', letterSpacing: '0.08em', textTransform: 'uppercase', borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>📂 {L(item.divider!, item.dividerLo)}</div>
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
                                    title={collapsed && !isMobile ? L(item.label, item.labelLo) : undefined}
                                >
                                    <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>{item.icon}</span>
                                    {showLabels && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{L(item.label, item.labelLo)}</span>}
                                    {/* Badge: consume-fail */}
                                    {item.href === '/consume-fail' && failCount > 0 && (
                                        <span style={{
                                            marginLeft: 'auto', minWidth: 20, height: 20,
                                            background: '#DC2626', color: '#fff',
                                            borderRadius: 10, fontSize: '0.65rem', fontWeight: 800,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            padding: '0 5px', lineHeight: 1, flexShrink: 0,
                                            boxShadow: '0 2px 6px rgba(220,38,38,0.4)',
                                            animation: 'pulse-badge 2s infinite',
                                        }}>
                                            {failCount > 99 ? '99+' : failCount}
                                        </span>
                                    )}
                                    {/* Badge: low stock → แสดงบน /inventory */}
                                    {item.href === '/inventory' && lowStockCount > 0 && (
                                        <span style={{
                                            marginLeft: 'auto', minWidth: 20, height: 20,
                                            background: '#F59E0B', color: '#fff',
                                            borderRadius: 10, fontSize: '0.65rem', fontWeight: 800,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            padding: '0 5px', lineHeight: 1, flexShrink: 0,
                                            boxShadow: '0 2px 6px rgba(245,158,11,0.4)',
                                        }}>
                                            {lowStockCount > 99 ? '99+' : lowStockCount}
                                        </span>
                                    )}
                                </Link>
                            </div>
                        )
                    })}

                    {/* Table Manager Button — owner/manager only */}
                    {canManageTables && (
                        <>
                            {showLabels ? (
                                <div style={{ margin: '8px 0 4px', paddingLeft: '0.875rem', fontSize: '0.65rem', fontWeight: 700, color: '#D1D5DB', letterSpacing: '0.08em', textTransform: 'uppercase' }}>🪑 {L('จัดการร้าน', 'ຈັດການຮ້ານ')}</div>
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
                                title={collapsed && !isMobile ? L('จัดการโต๊ะและโซน', 'ຈັດການໂຕ໊ະແລະໂຊນ') : undefined}
                            >
                                <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>🪑</span>
                                {showLabels && <span style={{ whiteSpace: 'nowrap' }}>{L('จัดการโต๊ะและโซน', 'ຈັດການໂຕ໊ະແລະໂຊນ')}</span>}
                            </button>
                            {/* QR Order — สั่งอาหารเองที่โต๊ะ */}
                            {[
                                { href: '/settings/qr', icon: '📱', label: 'QR Order สั่งอาหาร', labelLo: 'QR Order ສັ່ງອາຫານ' },
                                { href: '/qr-sheets',   icon: '🖨️', label: 'พิมพ์ QR Sheet',     labelLo: 'ພິມ QR Sheet' },
                            ].map(item => {
                                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                                return (
                                    <Link key={item.href} href={item.href} onClick={() => isMobile && setMobileOpen(false)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: collapsed && !isMobile ? '0.6rem' : '0.6rem 0.875rem',
                                            borderRadius: 10, fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                                            textDecoration: 'none', transition: 'all 0.15s ease',
                                            background: active ? '#E8364E' : 'transparent',
                                            color: active ? '#fff' : '#6B7280',
                                            boxShadow: active ? '0 2px 8px rgba(232,54,78,0.25)' : 'none',
                                            justifyContent: collapsed && !isMobile ? 'center' : 'flex-start', minHeight: 40,
                                        }}
                                        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = '#F3F4F6'; (e.currentTarget as HTMLElement).style.color = '#1A1D26' } }}
                                        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6B7280' } }}
                                        title={collapsed && !isMobile ? L(item.label, item.labelLo) : undefined}
                                    >
                                        <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>{item.icon}</span>
                                        {showLabels && <span style={{ whiteSpace: 'nowrap' }}>{L(item.label, item.labelLo)}</span>}
                                    </Link>
                                )
                            })}
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
                                        title={collapsed && !isMobile ? L(item.label, item.labelLo) : undefined}
                                    >
                                        <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>{item.icon}</span>
                                        {showLabels && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{L(item.label, item.labelLo)}</span>}
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
                    <button suppressHydrationWarning onClick={async () => {
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
            <style>{`
                @keyframes pulse-badge {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.1); }
                }
            `}</style>
        </>
    )
}

