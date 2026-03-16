'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useTenant } from '@/context/TenantContext'

interface Table {
    id: string
    name: string
    number: number
    zone: string
    status: string
    isActive: boolean
}

export default function QrMenuPage() {
    useRoleGuard(['owner', 'manager', 'cashier'])
    const { settings } = useTenant()
    const [tables, setTables] = useState<Table[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const tenantCode = settings?.code ?? ''
    const storeName  = settings?.displayName || settings?.name || 'ร้านของเรา'

    const fetchTables = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/pos/tables')
            const json = await res.json()
            if (json.success) {
                setTables((json.data ?? []).filter((t: Table) => t.isActive))
            } else {
                setError('ไม่สามารถโหลดข้อมูลโต๊ะได้')
            }
        } catch {
            setError('เกิดข้อผิดพลาด')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchTables() }, [fetchTables])

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const menuUrl = (tableNum: number) => `${baseUrl}/m/${tenantCode}/${tableNum}`

    const qrImgUrl = (url: string) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(url)}`

    const printAll = () => {
        const win = window.open('', '_blank', 'width=900,height=700')
        if (!win) return
        const html = tables.map(t => {
            const url = menuUrl(t.number)
            const qr  = qrImgUrl(url)
            return `
              <div class="card">
                <div class="store">${storeName}</div>
                <div class="table">${t.name}</div>
                <img src="${qr}" width="200" height="200" alt="QR" />
                <div class="url">${url}</div>
                <div class="hint">แสกน QR เพื่อดูเมนูและสั่งอาหาร</div>
              </div>`
        }).join('')

        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QR โต๊ะ</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Noto Sans Thai',sans-serif;background:#fff}
  .grid{display:flex;flex-wrap:wrap;gap:0;justify-content:flex-start}
  .card{width:9cm;height:11cm;border:1px solid #ddd;display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:8px;padding:16px;page-break-inside:avoid;text-align:center}
  .store{font-size:13px;color:#666;font-weight:500}
  .table{font-size:22px;font-weight:900;color:#1a1d26;letter-spacing:0.02em}
  .url{font-size:9px;color:#999;word-break:break-all;max-width:200px}
  .hint{font-size:11px;color:#3B82F6;font-weight:600}
  @media print{@page{margin:8mm}.card{border:1.5px solid #000}}
</style></head><body>
<div class="grid">${html}</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`)
        win.document.close()
    }

    const printOne = (t: Table) => {
        const url = menuUrl(t.number)
        const qr  = qrImgUrl(url)
        const win = window.open('', '_blank', 'width=400,height=500')
        if (!win) return
        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QR ${t.name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Noto Sans Thai',sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{display:flex;flex-direction:column;align-items:center;gap:10px;padding:24px;border:2px solid #000;border-radius:16px;text-align:center;width:9cm}
  .store{font-size:12px;color:#666}
  .table{font-size:26px;font-weight:900;color:#1a1d26}
  .url{font-size:9px;color:#999;word-break:break-all;max-width:200px}
  .hint{font-size:12px;color:#3B82F6;font-weight:600}
  @media print{body{min-height:auto}@page{margin:5mm}}
</style></head><body>
<div class="card">
  <div class="store">${storeName}</div>
  <div class="table">${t.name}</div>
  <img src="${qr}" width="200" height="200" alt="QR" />
  <div class="url">${url}</div>
  <div class="hint">📱 แสกน QR เพื่อดูเมนูและสั่งอาหาร</div>
</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`)
        win.document.close()
    }

    return (
        <div className="page-container" style={{ maxWidth: 1100 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 className="page-title">📱 QR Menu — สั่งอาหารเองที่โต๊ะ</h1>
                    <p className="page-subtitle">พิมพ์ QR ติดโต๊ะ ลูกค้าสแกนแล้วสั่งอาหารได้เลย</p>
                    {tenantCode && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '6px 12px', width: 'fit-content' }}>
                            <span style={{ color: '#3B82F6', fontWeight: 600 }}>🔗 รหัสร้าน:</span>
                            <code style={{ color: '#1D4ED8', fontWeight: 700 }}>{tenantCode}</code>
                        </div>
                    )}
                </div>
                <button
                    onClick={printAll}
                    disabled={tables.length === 0}
                    className="btn-primary"
                    style={{ padding: '0.6rem 1.4rem', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    🖨️ พิมพ์ QR ทุกโต๊ะ ({tables.length})
                </button>
            </div>

            {/* Info banner */}
            <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '1px solid #BBF7D0', borderRadius: 14, padding: '14px 20px', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
                <div>
                    <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.9rem', marginBottom: 4 }}>วิธีใช้งาน QR Self-Order</div>
                    <ol style={{ color: '#15803D', fontSize: '0.82rem', paddingLeft: '1.2rem', lineHeight: 2 }}>
                        <li>พิมพ์ QR Code แต่ละโต๊ะแล้วติดไว้บนโต๊ะ</li>
                        <li>ลูกค้าสแกนด้วยกล้องมือถือ → เปิดเมนูได้เลย (ไม่ต้องโหลด App)</li>
                        <li>ลูกค้าเลือกรายการ → ส่งออเดอร์ → ออเดอร์ขึ้น POS เป็น <strong>รอยืนยัน</strong></li>
                        <li>แคชเชียร์ยืนยันออเดอร์ → ครัวรับงาน ✅</li>
                    </ol>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280' }}>กำลังโหลดโต๊ะ...</div>
            ) : error ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#DC2626' }}>{error}</div>
            ) : tables.length === 0 ? (
                <div style={{ padding: '4rem 2rem', textAlign: 'center', background: '#fff', borderRadius: 16, border: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>🪑</div>
                    <div style={{ fontWeight: 600, color: '#1A1D26' }}>ยังไม่มีโต๊ะในระบบ</div>
                    <div style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: 4 }}>เพิ่มโต๊ะใน Settings → Tables ก่อนครับ</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                    {tables.map(t => {
                        const url = menuUrl(t.number)
                        return (
                            <div key={t.id} style={{
                                background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
                                padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', textAlign: 'center'
                            }}>
                                {/* QR Image */}
                                <div style={{ width: 160, height: 160, borderRadius: 12, overflow: 'hidden', border: '2px solid #E5E7EB', flexShrink: 0 }}>
                                    {tenantCode ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={qrImgUrl(url)}
                                            alt={`QR ${t.name}`}
                                            width={160} height={160}
                                            style={{ display: 'block' }}
                                        />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '0.75rem', padding: 8 }}>
                                            รอโหลด tenant code...
                                        </div>
                                    )}
                                </div>

                                {/* Table info */}
                                <div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1A1D26' }}>{t.name}</div>
                                    {t.zone && <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 2 }}>โซน: {t.zone}</div>}
                                </div>

                                {/* URL */}
                                <div style={{ fontSize: '0.65rem', color: '#9CA3AF', wordBreak: 'break-all', lineHeight: 1.5, maxWidth: 180 }}>
                                    {url}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ flex: 1, padding: '7px 10px', borderRadius: 9, background: '#EFF6FF', color: '#3B82F6', fontWeight: 700, fontSize: '0.78rem', textAlign: 'center', textDecoration: 'none', border: '1px solid #BFDBFE' }}
                                    >
                                        👁️ ดูเมนู
                                    </a>
                                    <button
                                        onClick={() => printOne(t)}
                                        style={{ flex: 1, padding: '7px 10px', borderRadius: 9, background: '#F0FDF4', color: '#059669', fontWeight: 700, fontSize: '0.78rem', border: '1px solid #BBF7D0', cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        🖨️ พิมพ์
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
