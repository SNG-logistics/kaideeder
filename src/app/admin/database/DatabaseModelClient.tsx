// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'

// ── Types ───────────────────────────────────────────────────────────
type StoreData = {
    id: string; code: string; name: string; displayName: string | null
    status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED'
    currency: string; walletLAK: number
    users: number; products: number; tables: number
    ordersToday: number; ordersOpen: number; ordersPending: number; ordersTotal: number
    createdAt: string; subEndsAt: string | null
}

const STATUS_STYLE = {
    ACTIVE:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', label: 'Active' },
    PAST_DUE:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', label: 'Past Due' },
    SUSPENDED: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', label: 'Suspended' },
}

const DB_MODELS = [
    { key: 'tenant',      label: 'Tenants',        emoji: '🏪', color: '#3b82f6', desc: 'Accounts & subscriptions' },
    { key: 'user',        label: 'Store Users',     emoji: '👤', color: '#10b981', desc: 'Staff accounts per store' },
    { key: 'category',   label: 'Categories',      emoji: '🏷️', color: '#ec4899', desc: 'Product categories' },
    { key: 'diningtable', label: 'Dining Tables',   emoji: '🪑', color: '#14b8a6', desc: 'Tables & zones' },
    { key: 'product',    label: 'Products / Menu', emoji: '🍜', color: '#f59e0b', desc: 'Menu items & stock' },
    { key: 'order',      label: 'Orders',           emoji: '🧾', color: '#8b5cf6', desc: 'Customer orders' },
]

const fmt = (n: number) => n.toLocaleString()
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'

export default function DatabaseModelClient({ modelKey }: { modelKey: string | null }) {
    const [stores, setStores] = useState<StoreData[]>([])
    const [loading, setLoading] = useState(true)
    const [suspending, setSuspending] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [view, setView] = useState<'hub' | 'tables'>('hub')

    async function load() {
        setLoading(true)
        try {
            const res = await adminFetch('/api/admin/store-stats')
            const d = await res.json()
            setStores(d.data ?? [])
        } catch {}
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    async function toggleSuspend(store: StoreData) {
        const next = store.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED'
        if (!confirm(`${next === 'SUSPENDED' ? '⏸ Suspend' : '▶ Activate'} "${store.name}"?`)) return
        setSuspending(store.id)
        await adminFetch(`/api/admin/tenants/${store.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: next }),
        })
        setSuspending(null)
        load()
    }

    const filtered = stores.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase())
    )

    // Global stats
    const totalOrders = stores.reduce((s, t) => s + t.ordersToday, 0)
    const totalOpen = stores.reduce((s, t) => s + t.ordersOpen, 0)
    const totalPending = stores.reduce((s, t) => s + t.ordersPending, 0)
    const totalProducts = stores.reduce((s, t) => s + t.products, 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Inter',system-ui,sans-serif" }}>

            {/* ── Platform Stats Bar ──────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[
                    { label: 'Stores', value: stores.length, icon: '🏪', color: '#3b82f6' },
                    { label: 'Orders Today', value: totalOrders, icon: '📋', color: '#10b981' },
                    { label: 'Open Orders', value: totalOpen + totalPending, icon: '🔥', color: totalOpen + totalPending > 0 ? '#f59e0b' : '#475569' },
                    { label: 'Total Products', value: totalProducts, icon: '📦', color: '#8b5cf6' },
                ].map(stat => (
                    <div key={stat.label} style={{ background: `${stat.color}0e`, border: `1px solid ${stat.color}22`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '1.5rem' }}>{stat.icon}</span>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: stat.color, lineHeight: 1 }}>{loading ? '—' : fmt(stat.value)}</div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── View Switcher + Search ───────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, gap: 2 }}>
                    {[{ key: 'hub', label: '🏪 Store Hub' }, { key: 'tables', label: '🗄️ DB Tables' }].map(v => (
                        <button key={v.key} onClick={() => setView(v.key as any)} style={{
                            border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 16px',
                            fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: view === v.key ? 700 : 400,
                            background: view === v.key ? 'rgba(99,102,241,0.2)' : 'transparent',
                            color: view === v.key ? '#818cf8' : '#475569',
                        }}>{v.label}</button>
                    ))}
                </div>
                {view === 'hub' && (
                    <>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาร้าน…"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 9, padding: '7px 14px', fontSize: '0.82rem', color: '#e2e8f0', outline: 'none', fontFamily: 'inherit', width: 200 }}
                        />
                        <button onClick={load} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, padding: '7px 14px', color: '#64748b', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                            ↻ Refresh
                        </button>
                    </>
                )}
                <Link href="/admin/tenants/new" style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: '0.82rem', fontWeight: 700, padding: '8px 18px', borderRadius: 10, textDecoration: 'none', boxShadow: '0 4px 12px rgba(99,102,241,0.35)', whiteSpace: 'nowrap' }}>
                    + New Store
                </Link>
            </div>

            {/* ── Store Hub View ───────────────────────────────────────── */}
            {view === 'hub' && (
                loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>กำลังโหลดข้อมูลร้านค้า…</div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#334155' }}>ไม่พบร้านค้า</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {filtered.map(store => {
                            const s = STATUS_STYLE[store.status]
                            const hasActivity = store.ordersPending > 0 || store.ordersOpen > 0
                            return (
                                <div key={store.id} style={{
                                    background: 'rgba(255,255,255,0.025)',
                                    border: `1px solid ${hasActivity ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)'}`,
                                    borderRadius: 18, overflow: 'hidden',
                                    boxShadow: hasActivity ? '0 0 0 1px rgba(245,158,11,0.1)' : 'none',
                                }}>
                                    {/* Card Header */}
                                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🏪</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1rem' }}>{store.displayName || store.name}</span>
                                                <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 5 }}>{store.code}</span>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 99, padding: '2px 8px' }}>{s.label}</span>
                                                {store.ordersPending > 0 && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 99, padding: '2px 8px', animation: 'pulse 1.5s ease infinite' }}>
                                                        🔔 {store.ordersPending} รอยืนยัน
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 3 }}>
                                                สร้างวันที่ {fmtDate(store.createdAt)} · หมดอายุ {fmtDate(store.subEndsAt)} · 💰 {fmt(store.walletLAK)} LAK
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stat Counters */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        {[
                                            { label: 'Orders วันนี้', value: store.ordersToday, color: '#10b981', icon: '📋' },
                                            { label: 'OPEN Orders', value: store.ordersOpen, color: store.ordersOpen > 0 ? '#3b82f6' : '#334155', icon: '🍽️' },
                                            { label: 'รอยืนยัน', value: store.ordersPending, color: store.ordersPending > 0 ? '#f59e0b' : '#334155', icon: '⏳' },
                                            { label: 'สินค้า', value: store.products, color: '#8b5cf6', icon: '📦' },
                                            { label: 'พนักงาน', value: store.users, color: '#ec4899', icon: '👤' },
                                        ].map(stat => (
                                            <div key={stat.label} style={{ padding: '12px 16px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: stat.color, lineHeight: 1 }}>{fmt(stat.value)}</div>
                                                <div style={{ fontSize: '0.62rem', color: '#334155', marginTop: 3, whiteSpace: 'nowrap' }}>{stat.icon} {stat.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Quick Actions */}
                                    <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                        {[
                                            { label: '📋 คำสั่งซื้อ', href: `/admin/database/order`, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
                                            { label: '🍜 เมนู/สินค้า', href: `/admin/database/product`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
                                            { label: '👤 ผู้ใช้งาน', href: `/admin/database/user`, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
                                            { label: '🪑 โต๊ะ', href: `/admin/database/diningtable`, color: '#14b8a6', bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.2)' },
                                        ].map(btn => (
                                            <Link key={btn.label} href={`${btn.href}?tenantId=${store.id}`} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '6px 13px', borderRadius: 9, textDecoration: 'none', color: btn.color, background: btn.bg, border: `1px solid ${btn.border}`, whiteSpace: 'nowrap' }}>
                                                {btn.label}
                                            </Link>
                                        ))}
                                        <Link href={`/admin/tenants/${store.id}`} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '6px 13px', borderRadius: 9, textDecoration: 'none', color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', whiteSpace: 'nowrap' }}>
                                            ⚙️ ตั้งค่าร้าน
                                        </Link>

                                        {/* Suspend / Activate */}
                                        <button onClick={() => toggleSuspend(store)} disabled={suspending === store.id} style={{
                                            marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, padding: '6px 13px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                                            opacity: suspending === store.id ? 0.5 : 1,
                                            color: store.status === 'SUSPENDED' ? '#10b981' : '#ef4444',
                                            background: store.status === 'SUSPENDED' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                            border: `1px solid ${store.status === 'SUSPENDED' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                        }}>
                                            {suspending === store.id ? '…' : store.status === 'SUSPENDED' ? '▶ Activate' : '⏸ Suspend'}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            )}

            {/* ── DB Tables View ───────────────────────────────────────── */}
            {view === 'tables' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    {DB_MODELS.map(m => (
                        <Link href={`/admin/database/${m.key}`} key={m.key} style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            background: `${m.color}09`, border: `1px solid ${m.color}22`,
                            borderRadius: 14, padding: '18px 20px', textDecoration: 'none',
                            transition: 'all 0.15s',
                        }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${m.color}55`; (e.currentTarget as HTMLElement).style.background = `${m.color}14`; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${m.color}22`; (e.currentTarget as HTMLElement).style.background = `${m.color}09`; }}
                        >
                            <div style={{ width: 40, height: 40, borderRadius: 11, background: `${m.color}18`, border: `1px solid ${m.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
                                {m.emoji}
                            </div>
                            <div>
                                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem' }}>{m.label}</div>
                                <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: 2 }}>{m.desc}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
        </div>
    )
}
