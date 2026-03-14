// @ts-nocheck
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import Link from 'next/link'
import DatabaseModelClient from '../DatabaseModelClient'
import RecordEditClient from '../RecordEditClient'

// ── Model metadata ─────────────────────────────────────────────────
const MODEL_META: Record<string, { label: string; emoji: string }> = {
    tenant:      { label: 'Tenants',         emoji: '🏪' },
    user:        { label: 'Store Users',     emoji: '👤' },
    category:    { label: 'Categories',      emoji: '🏷️' },
    diningtable: { label: 'Dining Tables',   emoji: '🪑' },
    product:     { label: 'Products / Menu', emoji: '🍜' },
    order:       { label: 'Orders',          emoji: '🧾' },
}

const CUSTOM_MODELS = Object.keys(MODEL_META)

export default async function AdminDatabasePage(props: {
    params:       Promise<{ nextadmin: string[] }>
    searchParams: Promise<any>
}) {
    const params      = await props.params
    const modelKey    = params.nextadmin?.[0]?.toLowerCase() ?? null
    const recordId    = params.nextadmin?.[1] ?? null        // id | 'new' | undefined
    const meta        = modelKey ? MODEL_META[modelKey] : null

    // ── Auth ───────────────────────────────────────────────────────
    const cookieStore = await cookies()
    const tokenStr    = cookieStore.get('admin_token')?.value
    let authorized    = false
    try {
        if (tokenStr) {
            const decoded = jwt.verify(tokenStr, process.env.ADMIN_JWT_SECRET!) as { role: string }
            if (decoded.role === 'SUPERADMIN') authorized = true
        }
    } catch {}

    if (!authorized) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Access Denied</h2>
                <p style={{ fontSize: '0.78rem', color: '#4b5563', margin: 0 }}>
                    Requires <span style={{ color: '#93c5fd', fontWeight: 600 }}>SUPERADMIN</span> role
                </p>
            </div>
        )
    }

    // ── Page header ────────────────────────────────────────────────
    const Header = () => (
        <div style={{
            background: 'linear-gradient(135deg, rgba(37,99,235,0.07), transparent)',
            border: '1px solid rgba(37,99,235,0.14)', borderRadius: 12, padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: '12px',
        }}>
            {/* DB icon */}
            <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'rgba(37,99,235,0.13)', border: '1px solid rgba(37,99,235,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
            </div>

            {/* Breadcrumb */}
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                    <Link href="/admin/database" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 500 }}>
                        Database
                    </Link>
                    {meta && (
                        <>
                            <ChevRight />
                            <Link href={`/admin/database/${modelKey}`} style={{ color: recordId ? '#64748b' : '#e2e8f0', textDecoration: 'none', fontWeight: recordId ? 400 : 600 }}>
                                {meta.emoji} {meta.label}
                            </Link>
                        </>
                    )}
                    {recordId && (
                        <>
                            <ChevRight />
                            <span style={{ color: '#93c5fd', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                {recordId === 'new' ? '+ New Record' : recordId.slice(0, 12) + '…'}
                            </span>
                        </>
                    )}
                </div>
                <p style={{ fontSize: '0.67rem', color: '#334155', margin: '2px 0 0' }}>
                    { recordId === 'new' ? `Creating new ${meta?.label?.slice(0,-1) ?? 'record'}`
                    : recordId           ? 'Edit record — changes are immediate'
                    : meta               ? `Browsing ${meta.label}`
                    :                      'Select a table to manage' }
                </p>
            </div>

            {/* Live badge */}
            <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.07em', color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 99, padding: '2px 9px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}/>
                Live DB
            </div>
        </div>
    )

    // ── Route: /admin/database  OR  /admin/database/[model] ────────
    if (!recordId && (!modelKey || CUSTOM_MODELS.includes(modelKey))) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Header />
                <DatabaseModelClient modelKey={modelKey} />
            </div>
        )
    }

    // ── Route: /admin/database/[model]/[id|new] ────────────────────
    if (recordId && modelKey && CUSTOM_MODELS.includes(modelKey)) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Header />
                <RecordEditClient modelKey={modelKey} recordId={recordId} />
            </div>
        )
    }

    // ── Fallback: unknown model → plain 404 ────────────────────────
    return (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
            <p>Unknown path. <Link href="/admin/database" style={{ color: '#93c5fd' }}>Go back to Database</Link></p>
        </div>
    )
}

function ChevRight() {
    return (
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6"/>
        </svg>
    )
}
