// @ts-nocheck
import { NextAdmin } from '@premieroctet/next-admin/adapters/next'
import { NextAdminRouterAdapter } from '@premieroctet/next-admin/adapters/next'
import { getNextAdminProps } from '@premieroctet/next-admin/appRouter'
import { prisma } from '@/lib/prisma'
import { options } from '@/lib/next-admin-options'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

// ── Model display map ──────────────────────────────────────────────
const MODEL_META: Record<string, { label: string; emoji: string; desc: string }> = {
    tenant: { label: 'Tenants', emoji: '🏪', desc: 'Restaurant accounts and subscriptions' },
    user: { label: 'Store Users', emoji: '👤', desc: 'Staff and admin accounts per tenant' },
    product: { label: 'Products / Menu', emoji: '🍜', desc: 'Stock items and menu products' },
    order: { label: 'Orders', emoji: '🧾', desc: 'Customer orders and transactions' },
}

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
                minHeight: '60vh', gap: '14px', textAlign: 'center',
            }}>
                <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                </div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Access Denied</h2>
                <p style={{ fontSize: '0.8rem', color: '#4b5563', margin: 0, maxWidth: 280 }}>
                    You must be a <span style={{ color: '#93c5fd', fontWeight: 600 }}>SUPERADMIN</span> to access database management.
                </p>
            </div>
        )
    }

    const nextAdminProps = await getNextAdminProps({
        params: params.nextadmin,
        searchParams,
        apiBasePath: '/api/admin/database',
        basePath: '/admin/database',
        prisma,
        options,
    })

    const modelKey = params.nextadmin?.[0]?.toLowerCase()
    const meta = MODEL_META[modelKey]

    return (
        <NextAdminRouterAdapter>
            <style>{`
                /* Override next-admin to match dark theme */
                .na-main * { font-family: 'Inter','Noto Sans Thai',system-ui,sans-serif !important; }
                /* ── CRITICAL: Cap ALL SVG icons in NextAdmin to a sensible size ── */
                .na-main svg {
                    max-width: 20px !important;
                    max-height: 20px !important;
                    width: auto !important;
                    height: auto !important;
                    display: inline-block !important;
                    vertical-align: middle !important;
                    flex-shrink: 0 !important;
                }
                .na-main a { color: #93c5fd !important; }
                .na-main button[type="submit"], .na-main a[href*="new"] {
                    background: #2563eb !important;
                    border-color: #2563eb !important;
                    color: #fff !important;
                    border-radius: 8px !important;
                    font-size: 0.82rem !important;
                }
                .na-main table { border-collapse: collapse !important; }
                .na-main thead th {
                    background: rgba(255,255,255,0.03) !important;
                    color: #64748b !important;
                    font-size: 0.72rem !important;
                    letter-spacing: 0.06em !important;
                    text-transform: uppercase !important;
                    border-bottom: 1px solid rgba(255,255,255,0.06) !important;
                    padding: 10px 14px !important;
                }
                .na-main tbody td {
                    color: #cbd5e1 !important;
                    border-bottom: 1px solid rgba(255,255,255,0.04) !important;
                    font-size: 0.83rem !important;
                    padding: 11px 14px !important;
                }
                .na-main tbody tr:hover td { background: rgba(255,255,255,0.025) !important; }
                /* ── Cap oversized empty-state illustrations from NextAdmin ── */
                .na-main svg[height="200"], .na-main svg[height="300"],
                .na-main svg[height="400"], .na-main svg[height="500"],
                .na-main svg[height*="px"][style*="height"],
                .na-main > * > svg, .na-main section > svg, .na-main div > svg:first-child:last-child,
                .na-main [class*="empty"] svg, .na-main [class*="placeholder"] svg,
                .na-main [class*="Empty"] svg, .na-main [class*="illustration"] {
                    max-width: 64px !important;
                    max-height: 64px !important;
                    width: 64px !important;
                    height: 64px !important;
                }
                /* Hide full-bleed decorative illustration wrappers */
                .na-main [class*="emptyState"], .na-main [class*="empty-state"],
                .na-main [class*="no-data"], .na-main [class*="NoData"] {
                    padding: 32px !important;
                    text-align: center !important;
                }
                .na-main input, .na-main select, .na-main textarea {
                    background: rgba(255,255,255,0.05) !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    color: #e2e8f0 !important;
                    border-radius: 8px !important;
                }
                .na-main input:focus, .na-main select:focus {
                    border-color: rgba(37,99,235,0.5) !important;
                    outline: none !important;
                }
                .na-main nav { background: transparent !important; border: none !important; }
                .na-main h1, .na-main h2, .na-main h3 { color: #e2e8f0 !important; }
                .na-main [class*="pagination"] a {
                    background: rgba(255,255,255,0.04) !important;
                    border: 1px solid rgba(255,255,255,0.08) !important;
                    color: #94a3b8 !important;
                    border-radius: 6px !important;
                }
                .na-main [class*="pagination"] a:hover { background: rgba(37,99,235,0.15) !important; }
                .na-main label { color: #94a3b8 !important; font-size: 0.8rem !important; }
                .na-main [class*="card"], .na-main [class*="panel"] {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .db-model-card {
                    transition: background 0.15s, border-color 0.15s;
                }
                .db-model-card:hover {
                    background: rgba(37,99,235,0.08) !important;
                    border-color: rgba(37,99,235,0.25) !important;
                }
            `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                {/* ── Header ─────────────────────────────────────────── */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(8,12,20,0))',
                    border: '1px solid rgba(37,99,235,0.18)',
                    borderRadius: 14, padding: '16px 20px',
                    display: 'flex', alignItems: 'center', gap: '14px',
                }}>
                    {/* Icon box */}
                    <div style={{
                        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                        background: 'rgba(37,99,235,0.14)', border: '1px solid rgba(37,99,235,0.28)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(37,99,235,0.15)',
                    }}>
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                            <ellipse cx="12" cy="5" rx="9" ry="3" />
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        </svg>
                    </div>

                    {/* Title + breadcrumb */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0' }}>
                                Database
                            </span>
                            {meta && (
                                <>
                                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                    <span style={{
                                        fontSize: '0.75rem', fontWeight: 600, color: '#93c5fd',
                                        background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.28)',
                                        borderRadius: 6, padding: '2px 9px',
                                    }}>
                                        {meta.emoji} {meta.label}
                                    </span>
                                </>
                            )}
                            {!meta && modelKey && (
                                <>
                                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                    <span style={{
                                        fontSize: '0.75rem', fontWeight: 600, color: '#93c5fd',
                                        background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.28)',
                                        borderRadius: 6, padding: '2px 9px', textTransform: 'capitalize',
                                    }}>{modelKey}</span>
                                </>
                            )}
                        </div>
                        <p style={{ fontSize: '0.72rem', color: '#374151', margin: '3px 0 0' }}>
                            {meta ? meta.desc : 'Direct database access — modifications are permanent'}
                        </p>
                    </div>

                    {/* Warning badge */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em',
                        color: '#f59e0b', background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.22)',
                        borderRadius: 99, padding: '3px 10px', textTransform: 'uppercase',
                    }}>
                        <svg width={9} height={9} viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                            <circle cx="12" cy="12" r="10" />
                        </svg>
                        Live
                    </div>
                </div>

                {/* ── Model Cards (only on root /admin/database) ─── */}
                {!modelKey && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '12px' }}>
                        {Object.entries(MODEL_META).map(([key, m]) => (
                            <a key={key} href={`/admin/database/${key}`} className="db-model-card" style={{
                                display: 'flex', flexDirection: 'column', gap: '10px',
                                padding: '16px', borderRadius: 12, textDecoration: 'none',
                                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                                cursor: 'pointer', color: 'inherit',
                            }}>
                                <span style={{ fontSize: '1.4rem' }}>{m.emoji}</span>
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>{m.label}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#4b5563', marginTop: 2 }}>{m.desc}</div>
                                </div>
                            </a>
                        ))}
                    </div>
                )}

                {/* ── NextAdmin Table ─────────────────────────────── */}
                <div className="na-main" style={{
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14, overflow: 'hidden',
                }}>
                    <NextAdmin {...nextAdminProps} />
                </div>
            </div>
        </NextAdminRouterAdapter>
    )
}
