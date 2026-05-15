'use client'

import { useCurrency } from '@/context/TenantContext';
import { useEffect, useState } from 'react'


interface SoldItemTopping { label: string; qty: number }
interface SoldItem { name: string; qty: number; revenue: number; toppings?: SoldItemTopping[] }

interface DailyData {
    date: string
    closingHour?: number
    orders: { count: number; totalRevenue: number; cashRevenue: number; transferRevenue: number }
    topMenus: { name: string; qty: number; revenue: number }[]
    stock: { lowItems: { product: { name: string; unit: string; minQty: number | null }; location: { name: string }; quantity: number }[] }
    allSoldItems: SoldItem[]
    waste: { items: number; totalValue: number }
    purchase: { totalCost: number }
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

    function printSummary() {
        if (!data) return
        const w = window.open('', '_blank', 'width=302,height=500,toolbar=0,menubar=0,scrollbars=0')
        if (!w) { alert('Popup blocker prevented printing. Please allow popups.'); return }

        // Build item rows — main item + indented topping breakdown
        const itemRows = (data.allSoldItems || []).map(item => {
            const toppingRows = (item.toppings || []).map(t =>
                `<div class="topping-row">
                  <span class="topping-name">└ ${t.label}</span>
                  <span class="topping-qty">x${t.qty}</span>
                 </div>`
            ).join('')
            return `<div class="item">
                      <span class="item-name">${item.name}</span>
                      <span class="item-qty">x${item.qty}</span>
                    </div>${toppingRows}`
        }).join('')

        const closingNote = (data.closingHour ?? 0) > 0
            ? `<div style="text-align:center;font-size:10px;color:#555;margin-bottom:4px">วันธุรกิจ: ${String(data.closingHour).padStart(2,'0')}:00 น. ถึง ${String(data.closingHour).padStart(2,'0')}:00 น. วันถัดไป</div>`
            : ''

        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;700;900&family=Noto+Sans+Thai:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          @page{size:58mm auto;margin:3mm 2mm}
          html,body{height:fit-content!important;overflow:hidden!important}
          body{font-family:'Noto Sans Lao','Noto Sans Thai','Courier New',monospace;font-size:12px;color:#000;width:54mm;line-height:1.4}
          .title{font-size:16px;font-weight:bold;text-align:center;margin-bottom:5px;border-bottom:1px dashed #000;padding-bottom:5px}
          .row{display:flex;justify-content:space-between;margin-bottom:3px}
          .bold{font-weight:bold}
          .divider{border-bottom:1px dotted #000;margin:6px 0}
          .item{display:flex;justify-content:space-between;margin-bottom:2px;align-items:baseline}
          .item-name{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:600}
          .item-qty{width:24px;text-align:right;font-weight:bold;flex-shrink:0}
          .topping-row{display:flex;justify-content:space-between;margin-bottom:1px;padding-left:14px;border-left:2px solid #ddd;margin-left:4px}
          .topping-name{flex:1;font-size:10px;color:#888;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:400}
          .topping-qty{width:24px;text-align:right;font-size:10px;color:#999;flex-shrink:0}
        </style></head><body>
          <div class="title">สรุปยอดขายรายวัน<br><span style="font-size:12px">${new Date(date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
          ${closingNote}
          <div class="row"><span>ยอดขายรวม:</span><span class="bold">${fmt(data.orders.totalRevenue)}</span></div>
          <div class="row"><span>เงินสด:</span><span>${fmt(data.orders.cashRevenue)}</span></div>
          <div class="row"><span>โอนเงิน:</span><span>${fmt(data.orders.transferRevenue)}</span></div>
          <div class="row"><span>จำนวนบิล:</span><span>${data.orders.count} บิล</span></div>
          <div class="divider"></div>
          <div style="font-weight:bold;margin-bottom:4px;text-align:center">สรุปรายการสินค้า (สำหรับเช็คสต็อค)</div>
          ${itemRows}
          <div class="divider"></div>
          <div style="text-align:center;font-size:10px;margin-top:10px">พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</div>
          <script>
            window.onload = function(){ window.focus(); window.print(); };
            window.onafterprint = function(){ window.close(); };
          </script>
        </body></html>`)
        w.document.close()
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
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button onClick={printSummary} disabled={!data || loading} className="btn-outline" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', borderColor: '#374151', color: '#111827' }}>
                        🖨️ พิมพ์บิลเช็คสต็อค
                    </button>
                    <button onClick={() => load()} disabled={loading} className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}>
                        {loading ? '⏳...' : '🔄 รีเฟรช'}
                    </button>
                </div>
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
                            { label: 'เฉลี่ย/บิล', value: data.orders.count > 0 ? fmt(Math.round(data.orders.totalRevenue / data.orders.count)) : '-', color: '#7C3AED', icon: '📊' },
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
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803d' }}>{fmt(data.purchase.totalCost)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem', background: 'rgba(220,38,38,0.05)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.15)' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#dc2626' }}>🗑️ ของเสีย</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dc2626' }}>{data.waste.items} รายการ · {fmt(data.waste.totalValue)}</span>
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
                                        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b91c1c' }}>{item.product.name}</p>
                                        <p style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: 2 }}>
                                            คงเหลือ {item.quantity} {item.product.unit} (ต่ำสุด {item.product.minQty ?? 0}) · {item.location.name}
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
