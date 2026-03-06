'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { adminFetch, clearAdminToken } from '@/lib/admin-fetch'

const NAV = [
    { href: '/admin/tenants', label: '🏬 Tenants' },
    { href: '/admin/topups', label: '💳 Topup Approvals' },
    { href: '/admin/plans', label: '📦 Plans' },
    { href: '/admin/audit-logs', label: '📋 Audit Logs' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()

    async function logout() {
        await adminFetch('/api/admin/auth/login', { method: 'DELETE' })
        clearAdminToken()
        router.push('/admin/login')
    }

    return (
        <div className="flex min-h-screen bg-gray-950 text-white">
            {/* Sidebar */}
            <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="px-6 py-5 border-b border-gray-800">
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Admin Portal</p>
                </div>
                <nav className="flex-1 py-4 space-y-1 px-3">
                    {NAV.map(n => (
                        <Link
                            key={n.href}
                            href={n.href}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${pathname.startsWith(n.href)
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            {n.label}
                        </Link>
                    ))}
                </nav>
                <div className="p-4 border-t border-gray-800">
                    <button onClick={logout} className="w-full text-left text-sm text-gray-500 hover:text-red-400 transition px-3 py-2">
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 p-8 overflow-auto">{children}</main>
        </div>
    )
}
