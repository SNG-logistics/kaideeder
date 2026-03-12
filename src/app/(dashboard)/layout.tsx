'use client'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { SidebarProvider, useSidebar } from '@/components/SidebarContext'

function DashboardContent({ children }: { children: React.ReactNode }) {
    const { collapsed, isMobile } = useSidebar()
    const marginLeft = isMobile ? 0 : collapsed ? 68 : 240

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
            <Sidebar />
            <div style={{
                flex: 1,
                marginLeft,
                display: 'flex',
                flexDirection: 'column',
                transition: 'margin-left 0.2s ease',
                minWidth: 0,
            }}>
                <Topbar />
                <main style={{
                    flex: 1,
                    padding: isMobile ? '1rem' : '1.5rem',
                    overflowX: 'hidden',
                }}>
                    {children}
                </main>
            </div>
        </div>
    )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <DashboardContent>{children}</DashboardContent>
        </SidebarProvider>
    )
}
