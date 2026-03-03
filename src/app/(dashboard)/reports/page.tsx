'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'

const reports = [
    { title: 'สรุปปิดร้านรายวัน', desc: 'EOD — ยอดขาย, เมนูขายดี, สต็อคใกล้หมด, ของเสีย', icon: '📋', href: '/reports/daily-summary', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)', accent: '#2563EB' },
    { title: 'ยอดขาย', desc: 'สรุปยอดขายรายวัน/เดือน, เมนูขายดี, แยกหมวด', icon: '💰', href: '/reports/sales', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.2)', accent: '#16a34a' },
    { title: 'สต็อครวม', desc: 'สรุปสต็อค, มูลค่าตามคลัง, รายการใกล้หมด', icon: '📦', href: '/reports/stock', bg: 'rgba(232,54,78,0.05)', border: 'rgba(232,54,78,0.2)', accent: 'var(--accent)' },
    { title: 'ซื้อเข้า', desc: 'มูลค่าซื้อเข้ารายวัน/เดือน', icon: '🛒', href: '/reports/purchase', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.2)', accent: '#ea580c' },
    { title: 'การเคลื่อนไหว', desc: 'Stock movement ทุกรายการ', icon: '🔄', href: '/reports/movements', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.2)', accent: '#7c3aed' },
    { title: 'ของเสีย', desc: 'ของเสีย/สูญเสียรายเดือน', icon: '🗑️', href: '/reports/waste', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', accent: '#dc2626' },
    { title: 'Gross Profit', desc: 'กำไรขั้นต้นต่อเมนู/รายการ', icon: '📊', href: '/reports/profit', bg: 'rgba(20,184,166,0.06)', border: 'rgba(20,184,166,0.2)', accent: '#0d9488' },
    { title: '🤖 วิเคราะห์ครัว AI', desc: 'ประเมิน%ของเสีย, ของบูด, ของสดคงเหลือ และแนะนำการจัดการ', icon: '🧑‍🍳', href: '/reports/kitchen', bg: 'rgba(234,179,8,0.06)', border: 'rgba(234,179,8,0.25)', accent: '#ca8a04' },
    { title: '🤖 ซื้อซ้ำเกินจำนวน', desc: 'AI วิเคราะห์ยอดซื้อเกิน vs ยอดใช้จริง รายวัน/สัปดาห์/เดือน', icon: '📦', href: '/reports/purchase-analysis', bg: 'rgba(239,68,68,0.05)', border: 'rgba(239,68,68,0.2)', accent: '#dc2626' },
]

export default function ReportsPage() {
    useRoleGuard(['owner', 'manager', 'cashier', 'warehouse'])
    return (
        <div className="page-container">
            <div className="page-header" style={{ marginBottom: 24 }}>
                <div>
                    <h1 className="page-title">📈 รายงาน</h1>
                    <p className="page-subtitle">สรุปข้อมูลสต็อค, ยอดขาย, กำไร และการเคลื่อนไหว</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                {reports.map(r => (
                    <a key={r.title} href={r.href} style={{
                        display: 'block', textDecoration: 'none', padding: '1.5rem',
                        background: r.bg, border: `1px solid ${r.border}`,
                        borderRadius: 16, transition: 'all 0.22s', cursor: 'pointer',
                    }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
                                ; (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 32px ${r.border}`
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                                ; (e.currentTarget as HTMLElement).style.boxShadow = 'none'
                        }}
                    >
                        <span style={{ fontSize: '2.25rem', display: 'block', marginBottom: 14 }}>{r.icon}</span>
                        <h3 style={{ fontWeight: 700, color: r.accent, fontSize: '1rem', marginBottom: 6 }}>{r.title}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>{r.desc}</p>
                        <p style={{ color: r.accent, fontSize: '0.75rem', marginTop: 14, fontWeight: 600 }}>ดูรายงาน →</p>
                    </a>
                ))}
            </div>

            {/* Quick stats placeholder */}
            <div style={{ marginTop: 24, background: 'var(--bg)', borderRadius: 14, padding: '1.25rem', border: '1px dashed var(--border)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    📌 Dashboard ยอดขายแบบ realtime — เร็วๆ นี้ หลัง setup Sales Import เสร็จ
                </p>
            </div>
        </div>
    )
}
