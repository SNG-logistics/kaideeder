'use client'
import Sidebar from '@/components/Sidebar'
import { SidebarProvider, useSidebar } from '@/components/SidebarContext'
import { NotificationProvider } from '@/components/NotificationContext'

function POSContent({ children }: { children: React.ReactNode }) {
    const { collapsed, isMobile, toggle, mobileOpen } = useSidebar()
    const marginLeft = isMobile ? 0 : collapsed ? 68 : 240

    return (
        <>
            <Sidebar />
            <div className="pos-layout-root" style={{
                marginLeft,
                transition: 'margin-left 0.2s ease',
                width: isMobile ? '100%' : `calc(100vw - ${marginLeft}px)`,
                height: '100dvh',
                overflow: 'hidden',
                position: 'relative',
            }}>
                {/* Mobile hamburger button */}
                {isMobile && !mobileOpen && (
                    <button
                        onClick={toggle}
                        style={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                            zIndex: 40,
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.95)',
                            border: '1px solid #E5E7EB',
                            color: '#1A1D26',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        }}
                    >
                        ☰
                    </button>
                )}
                {children}
            </div>
        </>
    )
}

export default function POSLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <NotificationProvider>
                <POSContent>{children}</POSContent>
            </NotificationProvider>
        </SidebarProvider>
    )
}
