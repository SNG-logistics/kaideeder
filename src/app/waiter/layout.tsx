'use client'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { SidebarProvider, useSidebar } from '@/components/SidebarContext'

function WaiterLayoutContent({ children }: { children: React.ReactNode }) {
    const { collapsed, isMobile } = useSidebar()
    const marginLeft = isMobile ? 0 : collapsed ? 68 : 240

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#F0FDF4' }}>
            <Sidebar />
            <div style={{
                flex: 1, marginLeft,
                display: 'flex', flexDirection: 'column',
                transition: 'margin-left 0.2s ease', minWidth: 0,
            }}>
                <Topbar />
                <main style={{ flex: 1, padding: 0, overflowX: 'hidden' }}>
                    {children}
                </main>
            </div>
        </div>
    )
}

export default function WaiterLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <WaiterLayoutContent>{children}</WaiterLayoutContent>
        </SidebarProvider>
    )
}
