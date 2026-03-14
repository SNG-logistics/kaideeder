// @ts-nocheck
import { NextAdmin } from '@premieroctet/next-admin/adapters/next'
import { NextAdminRouterAdapter } from '@premieroctet/next-admin/adapters/next'
import { getNextAdminProps } from '@premieroctet/next-admin/appRouter'
import { prisma } from '@/lib/prisma'
import { options } from '@/lib/next-admin-options'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

export default async function AdminDatabasePage(props: {
    params: Promise<{ nextadmin: string[] }>
    searchParams: Promise<any>
}) {
    const params = await props.params
    const searchParams = await props.searchParams
    const cookieStore = await cookies()
    const tokenStr = cookieStore.get('admin_token')?.value
    let authorized = false
    try {
        if (tokenStr) {
            const decoded = jwt.verify(tokenStr, process.env.ADMIN_JWT_SECRET!) as { role: string }
            if (decoded.role === 'SUPERADMIN') authorized = true
        }
    } catch (e) { console.error('Token verification failed:', e) }

    if (!authorized) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '60vh', gap: '16px',
            }}>
                <div style={{
                    width: 56, height: 56, borderRadius: 16, background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.25)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
                }}>
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Access Denied</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, textAlign: 'center', maxWidth: 300 }}>
                    You must be a <strong style={{ color: '#93c5fd' }}>SUPERADMIN</strong> to access the direct database management console.
                </p>
            </div>
        )
    }

    const nextAdminProps = await getNextAdminProps({
        params: params.nextadmin,
        searchParams: searchParams,
        apiBasePath: '/api/admin/database',
        basePath: '/admin/database',
        prisma,
        options,
    })

    // Determine current model from params
    const modelName = params.nextadmin?.[0]

    return (
        <NextAdminRouterAdapter>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* ── Page Header Card ─────────────────────────── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.02) 100%)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    borderRadius: 14, padding: '16px 20px',
                }}>
                    {/* Icon */}
                    <div style={{
                        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                        background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <ellipse cx="12" cy="5" rx="9" ry="3" />
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        </svg>
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
                                Database Management
                            </h1>
                            {modelName && (
                                <>
                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                                    <span style={{
                                        fontSize: '0.78rem', fontWeight: 600, color: '#93c5fd',
                                        background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)',
                                        borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize',
                                    }}>
                                        {modelName}
                                    </span>
                                </>
                            )}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#4b5563', margin: '3px 0 0', lineHeight: 1.4 }}>
                            Directly manage database tables — SuperAdmin only
                        </p>
                    </div>

                    {/* Badge */}
                    <div style={{
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                        color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.25)',
                        borderRadius: 99, padding: '3px 10px', textTransform: 'uppercase', flexShrink: 0,
                    }}>
                        Live DB
                    </div>
                </div>

                {/* ── NextAdmin Container ───────────────────────── */}
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14, overflow: 'hidden',
                }}>
                    <NextAdmin {...nextAdminProps} />
                </div>
            </div>
        </NextAdminRouterAdapter>
    )
}
