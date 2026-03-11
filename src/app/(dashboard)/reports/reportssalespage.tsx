'use client'
import { useEffect, useState } from 'react'
import { useCurrency } from '@/context/TenantContext'


interface SalesSummary {
  totalSales: number; cashSales: number; transferSales: number
  orderCount: number; avgOrderValue: number
}
interface TopMenu { name: string; qty: number; revenue: number; category: string }
interface ByCategory { name: string; revenue: number; qty: number }
interface DailyItem { date: string; revenue: number; orders: number }
interface ReportData {
  startDate: string; endDate: string
  summary: SalesSummary
  topMenus: TopMenu[]
  byCategory: ByCategory[]
  daily: DailyItem[]
}

function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function SalesReportPage() {
    const { fmt } = useCurrency();

  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/sales?startDate=${startDate}&endDate=${endDate}`)
      const json = await res.json()
      if (json.success) setData(json.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const maxRevenue = data?.daily.reduce((m, d) => Math.max(m, d.revenue), 0) || 1

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">💰 รายงานยอดขาย</h1>
          <p className="page-subtitle">ยอดขายรายวัน, เมนูขายดี, แยกหมวด และวิธีชำระ</p>
        </div>
      </div>

      {/* Date filter */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="label">📅 จาก</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" style={{ width: 160 }} />
        </div>
        <div>
          <label className="label">ถึง</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" style={{ width: 160 }} />
        </div>
        {/* Quick filters */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: 'วันนี้', fn: () => { setStartDate(today); setEndDate(today) } },
            { label: '7 วัน', fn: () => { const d = new Date(); d.setDate(d.getDate() - 6); setStartDate(d.toISOString().split('T')[0]); setEndDate(today) } },
            { label: 'เดือนนี้', fn: () => { const d = new Date(); setStartDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); setEndDate(today) } },
          ].map(q => (
            <button key={q.label} onClick={q.fn} className="btn-outline" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}>{q.label}</button>
          ))}
        </div>
        <button onClick={load} disabled={loading} className="btn-primary" style={{ padding: '0.5rem 1.25rem' }}>
          {loading ? '⏳...' : '🔍 ดูรายงาน'}
        </button>
      </div>

      {loading && <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>⏳ กำลังโหลด...</div>}

      {data && !loading && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'ยอดขายรวม', value: fmt(data.summary.totalSales), color: '#059669', icon: '💰' },
              { label: 'เงินสด', value: fmt(data.summary.cashSales), color: 'var(--text)', icon: '💵' },
              { label: 'โอนเงิน', value: fmt(data.summary.transferSales), color: '#3B82F6', icon: '📱' },
              { label: 'จำนวนบิล', value: data.summary.orderCount.toString(), color: 'var(--text)', icon: '🧾' },
              { label: 'เฉลี่ย/บิล', value: fmt(data.summary.avgOrderValue), color: '#7C3AED', icon: '📊' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <p style={{ fontSize: '1.25rem', marginBottom: 6 }}>{s.icon}</p>
                <p style={{ fontSize: '1.05rem', fontWeight: 800, color: s.color }}>{s.value}</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            {/* Top Menus */}
            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 14, color: 'var(--text)' }}>🏆 เมนูขายดี Top 10</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.topMenus.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: i < 3 ? 'var(--accent)' : 'var(--bg)', color: i < 3 ? 'white' : 'var(--text-muted)',
                      fontSize: '0.68rem', fontWeight: 800, flexShrink: 0,
                      border: '1px solid var(--border)'
                    }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.qty} ชิ้น · {m.category}</p>
                    </div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', flexShrink: 0 }}>{fmt(m.revenue)}</p>
                  </div>
                ))}
                {data.topMenus.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>ไม่มีข้อมูล</p>}
              </div>
            </div>

            {/* By Category */}
            <div className="card">
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 14, color: 'var(--text)' }}>📂 ยอดขายแยกหมวด</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.byCategory.map((c, i) => {
                  const pct = data.summary.totalSales > 0 ? (c.revenue / data.summary.totalSales) * 100 : 0
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
                        <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700 }}>{fmt(c.revenue)}</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                      </div>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{pct.toFixed(1)}% · {c.qty} รายการ</p>
                    </div>
                  )
                })}
                {data.byCategory.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>ไม่มีข้อมูล</p>}
              </div>
            </div>
          </div>

          {/* Daily Chart */}
          {data.daily.length > 1 && (
            <div className="card" style={{ marginBottom: 14 }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 14, color: 'var(--text)' }}>📈 ยอดขายรายวัน</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, overflowX: 'auto', paddingBottom: 24, position: 'relative' }}>
                {data.daily.map((d, i) => {
                  const pct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 40, flex: 1 }}>
                      <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginBottom: 2 }}>
                        {fmt(d.revenue)}
                      </p>
                      <div title={`${fmtDate(d.date)}: ${fmt(d.revenue)}`} style={{
                        width: '100%', maxWidth: 32, height: `${Math.max(pct, 4)}%`,
                        background: 'var(--accent)', borderRadius: '4px 4px 0 0', opacity: 0.85,
                        transition: 'height 0.3s ease', cursor: 'pointer',
                        minHeight: 4,
                      }} />
                      <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                        {fmtDate(d.date)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ fontSize: '2rem', marginBottom: 8 }}>📊</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>เลือกวันที่และกด "ดูรายงาน"</p>
        </div>
      )}
    </div>
  )
}