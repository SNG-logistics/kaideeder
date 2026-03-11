'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { format } from 'date-fns'
import { th } from 'date-fns/locale/th'
import Link from 'next/link'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useStoreBranding } from '@/hooks/useStoreBranding'
import { useCurrency } from '@/context/TenantContext'

interface RecentOrder {
    id: string
    orderNumber: string
    table: string
    total: number
    paymentMethod: string
    closedAt: string
    itemCount: number
}

interface NegativeStockItem {
    productName: string
    locationName: string
    qty: number
}

interface DashboardData {
    date: string
    sales: {
        total: number; items: number; qty: number
        posTotal: number; posOrders: number; importTotal: number
    }
    recentOrders: RecentOrder[]
    stock: {
        total: number
        byLocation: Record<string, { name: string; value: number }>
        negativeItems: NegativeStockItem[]
    }
    purchase: { total: number; orders: number }
    lowStock: { count: number; items: { productName: string; locationName: string; qty: number; minQty: number }[] }
}

export default function DashboardPage() {
    const { fmt } = useCurrency();

    const router = useRouter()
    const currentUser = useCurrentUser()
    const branding = useStoreBranding()
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState('')   // ← init empty; set client-side only
    const [showStockDetail, setShowStockDetail] = useState(false)
    const [showLowStock, setShowLowStock] = useState(false)
    const [showRecentOrders, setShowRecentOrders] = useState(false)
    const [showNegativeStock, setShowNegativeStock] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    // ── Redirect kitchen/bar to KDS ─────────────────────────────────
    useEffect(() => {
        if (!currentUser) return
        if (currentUser.role === 'kitchen') router.replace('/kitchen?station=KITCHEN')
        if (currentUser.role === 'bar') router.replace('/kitchen?station=BAR')
    }, [currentUser, router])

    useEffect(() => {
        // Set today client-side only — avoids SSR/client Date mismatch
        setSelectedDate(new Date().toISOString().split('T')[0])
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    // fetchDashboard must stay ABOVE the kitchen/bar early return
    // so useEffect below always runs (same number of hooks every render)
    async function fetchDashboard(date: string) {
        setLoading(true)
        try {
            const res = await fetch(`/api/dashboard?date=${date}`)
            const json = await res.json()
            if (json.success) setData(json.data)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (selectedDate) fetchDashboard(selectedDate) }, [selectedDate])

    // Don’t render financial dashboard for kitchen/bar while redirecting
    if (currentUser?.role === 'kitchen' || currentUser?.role === 'bar') {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9CA3AF' }}>กำลังเข้าสู่จอครัว...</div>
    }

    const thaiDate = selectedDate ? format(new Date(selectedDate), 'd MMMM yyyy', { locale: th }) : ''

    return (
        <div className="page-container">

            {/* Header */}
            <div style={{
                display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'flex-start',
                justifyContent: 'space-between',
                gap: isMobile ? 12 : 16,
                marginBottom: '1.25rem', paddingBottom: '1rem',
                borderBottom: '2px solid var(--border)',
            }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: isMobile ? '1.2rem' : '1.55rem' }}>🏠 Restaurant Dashboard</h1>
                    <p className="page-subtitle">{branding.displayName} — {thaiDate}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="input"
                        style={{ width: 'auto', fontSize: '0.82rem', minHeight: 40 }}
                    />
                    <button onClick={() => fetchDashboard(selectedDate)} className="btn btn-secondary" style={{ fontSize: '0.8rem', minHeight: 40, whiteSpace: 'nowrap' }}>
                        🔄 รีเฟรช
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, gap: 12 }}>
                    <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>กำลังโหลด...</span>
                </div>
            ) : data ? (
                <>
                    {/* STAT CARDS */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                        gap: isMobile ? 10 : 16,
                        marginBottom: 20,
                    }}>
                        {/* Card: ยอดขาย */}
                        <div className="stat-card" onClick={() => setShowRecentOrders(!showRecentOrders)} style={{ cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 8 : 14 }}>
                                <div style={{
                                    width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: 12,
                                    background: '#ECFDF5', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: isMobile ? 18 : 22,
                                }}>💰</div>
                                <span className="badge badge-green">วันนี้</span>
                            </div>
                            <p style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>ยอดขายรวม</p>
                            <p style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: 700, color: '#1A1D26', margin: '4px 0' }}>{fmt(data.sales.total)}</p>
                            <p style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>
                                POS {data.sales.posOrders} บิล • {data.sales.items} รายการ • {data.sales.qty} ชิ้น
                            </p>
                            {data.sales.posTotal > 0 && !isMobile && (
                                <p style={{ color: '#059669', fontSize: '0.72rem', marginTop: 4, fontWeight: 500 }}>
                                    POS: {fmt(data.sales.posTotal)}
                                    {data.sales.importTotal > 0 && ` + Import: ${fmt(data.sales.importTotal)}`}
                                </p>
                            )}
                            {!isMobile && <p style={{ color: 'var(--accent)', fontSize: '0.72rem', marginTop: 6, fontWeight: 500 }}>{showRecentOrders ? 'ซ่อนบิล ↑' : 'ดูบิลล่าสุด ↓'}</p>}
                        </div>

                        {/* Card: มูลค่าสต็อค */}
                        <div className="stat-card" onClick={() => setShowStockDetail(!showStockDetail)} style={{ cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 8 : 14 }}>
                                <div style={{
                                    width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: 12,
                                    background: '#FFF7ED', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: isMobile ? 18 : 22,
                                }}>📦</div>
                                {data.stock.negativeItems.length > 0 ? (
                                    <span className="badge badge-red">{data.stock.negativeItems.length} ติดลบ</span>
                                ) : (
                                    <span className="badge badge-yellow">WAC</span>
                                )}
                            </div>
                            <p style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>มูลค่าสต็อครวม</p>
                            <p style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: 700, color: '#1A1D26', margin: '4px 0' }}>{fmt(data.stock.total)}</p>
                            <p style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>ทุก 7 คลัง</p>
                            {!isMobile && (
                                <p style={{ color: 'var(--accent)', fontSize: '0.72rem', marginTop: 10, fontWeight: 500 }}>
                                    {showStockDetail ? 'ซ่อน ↑' : 'แยกตามคลัง ↓'}
                                </p>
                            )}
                        </div>

                        {/* Card: ซื้อเข้า */}
                        <Link href="/purchase" className="stat-card" style={{ textDecoration: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 8 : 14 }}>
                                <div style={{
                                    width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: 12,
                                    background: '#EFF6FF', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: isMobile ? 18 : 22,
                                }}>🛒</div>
                                <span className="badge badge-blue">{data.purchase.orders} ใบ</span>
                            </div>
                            <p style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>ซื้อเข้าวันนี้</p>
                            <p style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: 700, color: '#1A1D26', margin: '4px 0' }}>{fmt(data.purchase.total)}</p>
                            <p style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>{data.purchase.orders} ใบสั่งซื้อ</p>
                            {!isMobile && <p style={{ color: 'var(--accent)', fontSize: '0.72rem', marginTop: 10, fontWeight: 500 }}>ดูรายละเอียด →</p>}
                        </Link>

                        {/* Card: สต็อคใกล้หมด */}
                        <div className="stat-card" onClick={() => setShowLowStock(!showLowStock)} style={{ cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 8 : 14 }}>
                                <div style={{
                                    width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: 12,
                                    background: data.lowStock.count > 0 ? '#FEF2F2' : '#ECFDF5',
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: isMobile ? 18 : 22,
                                }}>⚠️</div>
                                {data.lowStock.count > 0 && (
                                    <span className="badge badge-red">{data.lowStock.count}</span>
                                )}
                            </div>
                            <p style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>สต็อคใกล้หมด</p>
                            <p style={{
                                fontSize: isMobile ? '1.2rem' : '1.6rem', fontWeight: 700, margin: '4px 0',
                                color: data.lowStock.count > 0 ? '#DC2626' : '#059669'
                            }}>
                                {data.lowStock.count > 0 ? `${data.lowStock.count} รายการ` : '✓ ปกติ'}
                            </p>
                            <p style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>ต่ำกว่าจุดสั่งซื้อ</p>
                            {!isMobile && (
                                <p style={{ color: 'var(--accent)', fontSize: '0.72rem', marginTop: 10, fontWeight: 500 }}>
                                    {showLowStock ? 'ซ่อน ↑' : 'คลิกดูรายการ ↓'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Recent POS Orders */}
                    {showRecentOrders && data.recentOrders.length > 0 && (
                        <div className="card" style={{ marginBottom: 16 }}>
                            <h3 style={{ fontWeight: 600, color: '#1A1D26', marginBottom: 14, fontSize: '0.9rem' }}>
                                🧾 บิลล่าสุดวันนี้ ({data.sales.posOrders} บิล)
                            </h3>
                            {isMobile ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {data.recentOrders.map(o => (
                                        <div key={o.id} style={{
                                            background: '#F8F9FC', borderRadius: 10, padding: '0.75rem',
                                            border: '1px solid #E5E7EB',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent)' }}>{o.orderNumber}</span>
                                                <span style={{ fontWeight: 700, color: '#059669' }}>{fmt(o.total)}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: '#6B7280' }}>
                                                <span>🍽️ {o.table}</span>
                                                <span>{o.paymentMethod === 'CASH' ? '💵 เงินสด' : '💳 โอน'}</span>
                                                <span>{o.itemCount} รายการ</span>
                                            </div>
                                            {o.closedAt && (
                                                <p style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: 4 }}>
                                                    {format(new Date(o.closedAt), 'HH:mm น.', { locale: th })}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table style={{ width: '100%' }}>
                                        <thead>
                                            <tr>
                                                <th>เลขบิล</th><th>โต๊ะ</th><th>รายการ</th><th>ยอดเงิน</th><th>ชำระ</th><th>เวลา</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.recentOrders.map(o => (
                                                <tr key={o.id}>
                                                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{o.orderNumber}</td>
                                                    <td>{o.table}</td>
                                                    <td>{o.itemCount} รายการ</td>
                                                    <td style={{ fontWeight: 700, color: '#059669' }}>{fmt(o.total)}</td>
                                                    <td>
                                                        <span className={`badge ${o.paymentMethod === 'CASH' ? 'badge-green' : 'badge-blue'}`}>
                                                            {o.paymentMethod === 'CASH' ? '💵 เงินสด' : '💳 โอน'}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: '#6B7280' }}>
                                                        {o.closedAt ? format(new Date(o.closedAt), 'HH:mm น.', { locale: th }) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Negative Stock Warning */}
                    {data.stock.negativeItems.length > 0 && (
                        <div className="card" style={{
                            marginBottom: 16,
                            background: '#FEF2F2',
                            borderColor: '#FECACA',
                        }}>
                            <div
                                style={{ cursor: 'pointer' }}
                                onClick={() => setShowNegativeStock(!showNegativeStock)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h3 style={{ fontWeight: 600, color: '#DC2626', fontSize: '0.9rem' }}>
                                        🔴 สต็อคติดลบ ({data.stock.negativeItems.length} รายการ) — ต้องเพิ่มสินค้าเข้าคลัง
                                    </h3>
                                    <span style={{ color: '#DC2626', fontSize: '0.8rem' }}>{showNegativeStock ? '↑' : '↓'}</span>
                                </div>
                            </div>
                            {showNegativeStock && (
                                <div style={{ marginTop: 12 }}>
                                    {isMobile ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {data.stock.negativeItems.map((item, i) => (
                                                <div key={i} style={{
                                                    background: '#FFFFFF', borderRadius: 8, padding: '0.6rem',
                                                    border: '1px solid #FECACA',
                                                }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.productName}</span>
                                                    <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: '#6B7280', marginTop: 2 }}>
                                                        <span>คลัง: {item.locationName}</span>
                                                        <span style={{ color: '#DC2626', fontWeight: 700 }}>คงเหลือ: {item.qty}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="table-container" style={{ background: '#FFFFFF' }}>
                                            <table style={{ width: '100%' }}>
                                                <thead>
                                                    <tr><th>สินค้า</th><th>คลัง</th><th>คงเหลือ</th><th>สถานะ</th></tr>
                                                </thead>
                                                <tbody>
                                                    {data.stock.negativeItems.map((item, i) => (
                                                        <tr key={i}>
                                                            <td style={{ fontWeight: 600 }}>{item.productName}</td>
                                                            <td style={{ color: '#6B7280' }}>{item.locationName}</td>
                                                            <td style={{ fontWeight: 700, color: '#DC2626' }}>{item.qty}</td>
                                                            <td><span className="badge badge-red">ติดลบ</span></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <p style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: 8, fontWeight: 500 }}>
                                        💡 ไปที่ &quot;รับสินค้าด่วน&quot; หรือ &quot;บันทึกซื้อเข้า&quot; เพื่อเพิ่มสต็อค
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stock by Location Detail */}
                    {showStockDetail && (
                        <div className="card" style={{ marginBottom: 16 }}>
                            <h3 style={{ fontWeight: 600, color: '#1A1D26', marginBottom: 14, fontSize: '0.9rem' }}>
                                📦 มูลค่าสต็อคแยกตามคลัง
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
                                {Object.entries(data.stock.byLocation).map(([code, loc]) => (
                                    <div key={code} style={{
                                        background: '#F8F9FC', borderRadius: 10, padding: '0.875rem',
                                        border: '1px solid #E5E7EB'
                                    }}>
                                        <p style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'var(--accent)', letterSpacing: '0.06em', fontWeight: 700 }}>{code}</p>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1A1D26', marginTop: 3 }}>{loc.name}</p>
                                        <p style={{
                                            fontSize: '0.88rem', fontWeight: 700, marginTop: 5,
                                            color: loc.value < 0 ? '#DC2626' : '#059669'
                                        }}>{fmt(loc.value)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Low Stock */}
                    {showLowStock && data.lowStock.items.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div className="card" style={{ padding: '0.875rem 1rem', marginBottom: 8 }}>
                                <h3 style={{ fontWeight: 600, color: '#DC2626', fontSize: '0.9rem' }}>⚠️ สินค้าใกล้หมด</h3>
                            </div>
                            {isMobile ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {data.lowStock.items.map((item, i) => (
                                        <div key={i} className="card" style={{ padding: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.productName}</span>
                                                <span className="badge badge-red">ต่ำ</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem', color: '#6B7280' }}>
                                                <span>คลัง: {item.locationName}</span>
                                                <span>เหลือ: <strong style={{ color: '#DC2626' }}>{item.qty}</strong></span>
                                                <span>ขั้นต่ำ: {item.minQty}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table style={{ width: '100%' }}>
                                        <thead>
                                            <tr>
                                                <th>สินค้า</th><th>คลัง</th><th>คงเหลือ</th><th>ขั้นต่ำ</th><th>สถานะ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.lowStock.items.map((item, i) => (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 600 }}>{item.productName}</td>
                                                    <td style={{ color: '#6B7280' }}>{item.locationName}</td>
                                                    <td style={{ fontWeight: 700, color: item.qty < 0 ? '#DC2626' : '#D97706' }}>{item.qty}</td>
                                                    <td style={{ color: '#6B7280' }}>{item.minQty}</td>
                                                    <td><span className={`badge ${item.qty < 0 ? 'badge-red' : 'badge-yellow'}`}>{item.qty < 0 ? 'ติดลบ' : 'ต่ำกว่าขั้นต่ำ'}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <span style={{ fontSize: '1rem' }}>⚡</span>
                            <h3 style={{ fontWeight: 600, color: '#1A1D26', fontSize: '0.9rem' }}>ทำรายการด่วน</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                            {[
                                { href: '/pos', icon: '🍽️', label: 'POS ขายหน้าร้าน', sub: 'เปิดบิล/ปิดบิล', bg: '#FFF0F2', color: '#E8364E' },
                                { href: '/purchase', icon: '🛒', label: 'บันทึกซื้อเข้า', sub: 'รับสินค้าเข้าคลัง', bg: '#EFF6FF', color: '#2563EB' },
                                { href: '/quick-receive', icon: '⚡', label: 'รับสินค้าด่วน', sub: 'เพิ่มสต็อคเร็ว', bg: '#ECFDF5', color: '#059669' },
                                { href: '/adjustment', icon: '⚖️', label: 'ปรับสต็อค', sub: 'นับของ / แก้ไข', bg: '#FFF7ED', color: '#D97706' },
                            ].map(item => (
                                <Link key={item.href} href={item.href} style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    gap: 6, padding: isMobile ? '1rem 0.5rem' : '1.25rem 1rem', borderRadius: 12,
                                    textDecoration: 'none', background: item.bg,
                                    border: '1px solid transparent', transition: 'all 0.2s ease',
                                    textAlign: 'center', minHeight: 48,
                                }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                                        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                                        (e.currentTarget as HTMLElement).style.boxShadow = 'none'
                                    }}
                                >
                                    <span style={{ fontSize: isMobile ? 24 : 28 }}>{item.icon}</span>
                                    <span style={{ fontSize: isMobile ? '0.78rem' : '0.875rem', fontWeight: 600, color: item.color }}>{item.label}</span>
                                    {!isMobile && <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{item.sub}</span>}
                                </Link>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260, gap: 8 }}>
                    <span style={{ fontSize: '2rem' }}>📭</span>
                    <span style={{ color: '#9CA3AF' }}>ไม่พบข้อมูล</span>
                </div>
            )}
        </div>
    )
}
