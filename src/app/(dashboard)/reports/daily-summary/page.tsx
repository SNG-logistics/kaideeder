'use client'

import { useCurrency } from '@/context/TenantContext';
import { useEffect, useState } from 'react'


interface DailyData {
    date: string
    orders: { count: number; totalRevenue: number; cashRevenue: number; transferRevenue: number; avgOrderValue: number }
    topMenus: { name: string; qty: number; revenue: number }[]
    stock: { lowItems: { name: string; quantity: number; unit: string; minQty: number; location: string }[] }
    waste: { count: number; totalValue: number }
    purchase: { count: number; totalCost: number }
}

export default function DailySummaryPage() {
    const { fmt } = useCurrency();

    const today = new Date().toISOString().split('T')[0]
    const [date, setDate] = useState(today)
    const [data, setData] = useState<DailyData | null>(null)
    const [loading, setLoading] = useState(false)

    async function load(d = date) {
        setLoading(true)
        try {
            const res = await fetch(`/api/reports/daily-summary?date=${d}`)
            const json = await res.json()
            if (json.success) setData(json.data)
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    function prevDay() {
        const d = new Date(date); d.setDate(d.getDate() - 1)
        const s = d.toISOString().split('T')[0]; setDate(s); load(s)
    }
    function nextDay() {
        const d = new Date(date); d.setDate(d.getDate() + 1)
        const s = d.toISOString().split('T')[0]; setDate(s); load(s)
    }

    return (
        <div className="page-container" style={{ maxWidth: 900 }}>
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div>
                    <h1 className="page-title">📋 สรุปปิดร้านรายวัน</h1>
                    <p className="page-subtitle">EOD Summary — ยอดขาย, เมนูขายดี, สต็อคใกล้หมด, ของเสีย</p>
                </div>
            </div>

            {/* Date nav */}
            <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={prevDay} className="btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '1rem' }}>‹</button>
                <input type="date" value={date} onChange={e => { setDate(e.target.value); load(e.target.value) }} className="input" style={{ width: 160 }} />
                <button onClick={nextDay} disabled={date >= today} className="btn-outline" style={{ padding: '0.4rem 0.75rem', fontSize: '1rem' }}>›</button>
                <button onClick={() => load()} disabled={loading} className="btn-primary" style={{ marginLeft: 'auto', padding: '0.45rem 1rem', fontSize: '0.82rem' }}>
                    {loading ? '⏳...' : '🔄 รีเฟรช'}
                </button>
            </div>

            {loading && <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>⏳ กำลังโหลด...</div>}

            {data && !loading && (
                <>
                    {/* Revenue summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10, marginBottom: 14 }}>
                        {[
                            { label: 'ยอดขายรวม', value: fmt(data.orders.totalRevenue), color: '#059669', icon: '💰', big: true },
                            { label: 'เงินสด', value: fmt(data.orders.cashRevenue), color: 'var(--text)', icon: '💵' },
                            { label: 'โอนเงิน', value: fmt(data.orders.transferRevenue), color: '#3B82F6', icon: '📱' },
                            { label: 'จำนวนบิล', value: String(data.orders.count), color: 'var(--text)', icon: '🧾' },
                            { label: 'เฉลี่ย/บิล', value: fmt(data.orders.avgOrderValue), color: '#7C3AED', icon: '📊' },
                        ].map(s => (
                            <div key={s.label} className="stat-card">
                                <p style={{ fontSize: '1.2rem', marginBottom: 4 }}>{s.icon}</p>
                                <p style={{ fontSize: s.big ? '1.1rem' : '0.95rem', fontWeight: 800, color: s.color }}>{s.value}</p>
                                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        {/* Top 5 Menus */}
                        <div className="card">
                            <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12, color: 'var(--text)' }}>🏆 เมนูขายดีวันนี้</h3>
                            {data.topMenus.length === 0 ? (
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>ไม่มียอดขาย</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {data.topMenus.map((m, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#B45309' : 'var(--bg)',
                                                color: i < 3 ? 'white' : 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0,
                                                border: '1px solid var(--border)'
                                            }}>{i + 1}</span>
                                            <p style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.qty} ชิ้น</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Ops summary */}
                        <div className="card">
                            <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12, color: 'var(--text)' }}>📦 สรุปคลังวันนี้</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem', background: 'rgba(22,163,74,0.06)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.15)' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#15803d' }}>🛒 รับสินค้า</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803d' }}>{data.purchase.count} รายการ · {fmt(data.purchase.totalCost)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem', background: 'rgba(220,38,38,0.05)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.15)' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#dc2626' }}>🗑️ ของเสีย</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dc2626' }}>{data.waste.count} รายการ · {fmt(data.waste.totalValue)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Low Stock alert */}
                    {data.stock.lowItems.length > 0 && (
                        <div className="card" style={{ border: '1.5px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.03)' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12, color: '#dc2626' }}>
                                ⚠️ สต็อคใกล้หมด — {data.stock.lowItems.length} รายการ
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                                {data.stock.lowItems.map((item, i) => (
                                    <div key={i} style={{ background: 'rgba(220,38,38,0.06)', borderRadius: 8, padding: '0.5rem 0.75rem', border: '1px solid rgba(220,38,38,0.15)' }}>
                                        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b91c1c' }}>{item.name}</p>
                                        <p style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: 2 }}>
                                            คงเหลือ {item.quantity} {item.unit} (ต่ำสุด {item.minQty}) · {item.location}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.stock.lowItems.length === 0 && (
                        <div className="card" style={{ textAlign: 'center', background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.2)' }}>
                            <p style={{ color: '#059669', fontWeight: 700, fontSize: '0.88rem' }}>✅ สต็อคทุกรายการอยู่ในระดับปกติ</p>
                        </div>
                    )}
                </>
            )}

            {!data && !loading && (
                <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <p style={{ fontSize: '2rem', marginBottom: 8 }}>📋</p>
                    <p style={{ color: 'var(--text-muted)' }}>กด รีเฟรช เพื่อโหลดสรุปประจำวัน</p>
                </div>
            )}
        </div>
    )
}
