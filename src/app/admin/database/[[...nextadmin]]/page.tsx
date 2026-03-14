// @ts-nocheck
import { getNextAdminProps } from '@premieroctet/next-admin/appRouter'
import { NextAdminRouterAdapter } from '@premieroctet/next-admin/adapters/next'
import { NextAdmin } from '@premieroctet/next-admin/adapters/next'
import { prisma } from '@/lib/prisma'
import { options } from '@/lib/next-admin-options'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import DatabaseModelClient from '../DatabaseModelClient'
import Link from 'next/link'

// ── Model meta ────────────────────────────────────────────────────
const MODEL_META: Record<string, { label: string; emoji: string; color: string }> = {
    tenant: { label: 'Tenants', emoji: '🏪', color: '#3b82f6' },
    user: { label: 'Store Users', emoji: '👤', color: '#10b981' },
    product: { label: 'Products / Menu', emoji: '🍜', color: '#f59e0b' },
    order: { label: 'Orders', emoji: '🧾', color: '#8b5cf6' },
}

const CUSTOM_MODELS = Object.keys(MODEL_META)
const C = {
    border: 'rgba(255,255,255,0.07)', accent: '#2563eb',
    text: '#e2e8f0', textMuted: '#64748b',
}

export default async function AdminDatabasePage(props: {
    params: Promise<{ nextadmin: string[] }>
    searchParams: Promise<any>
}) {
    const params = await props.params
    const searchParams = await props.searchParams

    // ── Auth ──────────────────────────────────────────────────────
    const cookieStore = await cookies()
    const tokenStr = cookieStore.get('admin_token')?.value
    let authorized = false
    try {
        if (tokenStr) {
            const decoded = jwt.verify(tokenStr, process.env.ADMIN_JWT_SECRET!) as { role: string }
            if (decoded.role === 'SUPERADMIN') authorized = true
        }
    } catch (e) { console.error('Token error:', e) }

    if (!authorized) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Access Denied</h2>
                <p style={{ fontSize: '0.78rem', color: '#4b5563', margin: 0 }}>Requires <span style={{ color: '#93c5fd', fontWeight: 600 }}>SUPERADMIN</span> role</p>
            </div>
        )
    }

    const modelKey = params.nextadmin?.[0]?.toLowerCase()
    const recordId = params.nextadmin?.[1]
    const meta = modelKey ? MODEL_META[modelKey] : null

    // ── Breadcrumb ────────────────────────────────────────────────
    const Breadcrumb = () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
            <Link href="/admin/database" style={{ color: C.textMuted, textDecoration: 'none', fontWeight: 500 }}>Database</Link>
            {meta && (
                <>
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                    <Link href={`/admin/database/${modelKey}`} style={{ color: meta ? C.text : C.textMuted, textDecoration: 'none', fontWeight: meta && !recordId ? 600 : 400 }}>
                        {meta.emoji} {meta.label}
                    </Link>
                </>
            )}
            {recordId && (
                <>
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                    <span style={{ color: '#93c5fd', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.7rem' }}>{recordId === 'new' ? '+ New' : recordId.slice(0, 10) + '…'}</span>
                </>
            )}
        </div>
    )

    // ── Header card ───────────────────────────────────────────────
    const Header = () => (
        <div style={{
            background: 'linear-gradient(135deg, rgba(37,99,235,0.07), transparent)',
            border: '1px solid rgba(37,99,235,0.15)', borderRadius: 12, padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: '12px',
        }}>
            <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(37,99,235,0.13)', border: '1px solid rgba(37,99,235,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
            </div>
            <div style={{ flex: 1 }}>
                <Breadcrumb />
                <p style={{ fontSize: '0.68rem', color: '#374151', margin: '2px 0 0' }}>
                    {meta ? `Direct access to ${meta.label}` : 'Select a table to manage'}
                </p>
            </div>
            <div style={{
                fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.07em',
                color: '#f59e0b', background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 99, padding: '2px 8px', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: '4px',
            }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                Live
            </div>
        </div>
    )

    // ── Custom list/root view ─────────────────────────────────────
    if (!recordId && (!modelKey || CUSTOM_MODELS.includes(modelKey))) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Header />
                <DatabaseModelClient modelKey={modelKey || null} />
            </div>
        )
    }

    // ── Edit / New form: hand off to NextAdmin ────────────────────
    const nextAdminProps = await getNextAdminProps({
        params: params.nextadmin,
        searchParams,
        apiBasePath: '/api/admin/database',
        basePath: '/admin/database',
        prisma,
        options,
    })

    return (
        <NextAdminRouterAdapter>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Header />
                <style>{`
                    .na-edit * { font-family: 'Inter','Noto Sans Thai',system-ui,sans-serif !important; color: #e2e8f0 !important; }
                    .na-edit svg { max-width: 18px !important; max-height: 18px !important; }
                    .na-edit input, .na-edit select, .na-edit textarea {
                        background: rgba(255,255,255,0.05) !important;
                        border: 1px solid rgba(255,255,255,0.1) !important;
                        color: #e2e8f0 !important; border-radius: 8px !important;
                    }
                    .na-edit label { color: #94a3b8 !important; font-size: 0.78rem !important; }
                    .na-edit button[type="submit"] {
                        background: #2563eb !important; color: #fff !important;
                        border-radius: 8px !important; border: none !important; padding: 8px 20px !important;
                    }
                    .na-edit h1, .na-edit h2 { color: #e2e8f0 !important; font-size: 1rem !important; }
                `}</style>
                <div className="na-edit" style={{
                    background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14, overflow: 'hidden', padding: '24px',
                }}>
                    <NextAdmin {...nextAdminProps} />
                </div>
            </div>
        </NextAdminRouterAdapter>
    )
}
