'use client'
import { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'

type Table = { id: string; number: number; name: string; zone: string; seats: number; status: string; isActive: boolean }
type Tenant = { code: string; name: string; displayName: string | null }

const C = {
    bg: '#080c14', card: '#0d1220', border: 'rgba(255,255,255,0.07)',
    accent: '#2563eb', text: '#e2e8f0', muted: '#64748b',
}

function generateQRUrl(tenantCode: string, tableNumber: number): string {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/m/${tenantCode}/${tableNumber}`
}

function QRCard({ table, tenantCode, tenantName }: { table: Table; tenantCode: string; tenantName: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const url = generateQRUrl(tenantCode, table.number)

    useEffect(() => {
        if (!canvasRef.current) return
        QRCode.toCanvas(canvasRef.current, url, {
            width: 180, margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' },
        })
    }, [url])

    function downloadQR() {
        if (!canvasRef.current) return
        // Add branded label below QR
        const canvas = document.createElement('canvas')
        canvas.width = 220; canvas.height = 270
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 220, 270)
        ctx.drawImage(canvasRef.current, 20, 16)
        ctx.fillStyle = '#1f2937'
        ctx.font = 'bold 13px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(tenantName, 110, 210)
        ctx.font = 'bold 16px system-ui'
        ctx.fillStyle = '#111827'
        ctx.fillText(`โต๊ะ ${table.number} — ${table.zone}`, 110, 230)
        ctx.font = '10px system-ui'
        ctx.fillStyle = '#6b7280'
        ctx.fillText('สแกน QR เพื่อสั่งอาหาร', 110, 250)
        const link = document.createElement('a')
        link.download = `qr-table-${table.number}.png`
        link.href = canvas.toDataURL()
        link.click()
    }

    return (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* QR */}
            <div style={{ background: '#fff', borderRadius: 10, padding: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 6 }} />
            </div>
            {/* Info */}
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, color: C.text, fontSize: '1rem' }}>โต๊ะ {table.number}</div>
                <div style={{ color: C.muted, fontSize: '0.72rem', marginTop: 2 }}>{table.name} • {table.zone} • {table.seats} ที่นั่ง</div>
                <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, background: table.status === 'AVAILABLE' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${table.status === 'AVAILABLE' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 99, padding: '2px 10px' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: table.status === 'AVAILABLE' ? '#34d399' : '#f87171', display: 'inline-block' }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: table.status === 'AVAILABLE' ? '#34d399' : '#f87171' }}>{table.status}</span>
                </div>
            </div>
            {/* URL preview */}
            <div style={{ fontSize: '0.6rem', color: '#374151', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '3px 8px', borderRadius: 6, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                {generateQRUrl('…', table.number)}
            </div>
            {/* Download */}
            <button onClick={downloadQR} style={{ width: '100%', padding: '8px', borderRadius: 9, border: `1px solid rgba(37,99,235,0.3)`, background: 'rgba(37,99,235,0.1)', color: '#93c5fd', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                ⬇ ดาวน์โหลด QR
            </button>
        </div>
    )
}

export default function QRGeneratorPage() {
    const [tables, setTables] = useState<Table[]>([])
    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/tables').then(r => r.json()),
            fetch('/api/tenant/settings').then(r => r.json()),
        ]).then(([t, s]) => {
            setTables(t.tables || [])
            setTenant({ code: s.code || s.tenant?.code || '', name: s.name || s.displayName || '', displayName: s.displayName })
        }).finally(() => setLoading(false))
    }, [])

    const zones = [...new Set(tables.map(t => t.zone))].filter(Boolean)
    const filtered = filter === 'all' ? tables : tables.filter(t => t.zone === filter)

    function printAll() { window.print() }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    return (
        <div style={{ fontFamily: "'Inter','Noto Sans Thai',system-ui,sans-serif" }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.07),transparent)', border: '1px solid rgba(37,99,235,0.14)', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h1 style={{ color: C.text, fontSize: '1rem', fontWeight: 700, margin: 0 }}>🔲 QR Code โต๊ะอาหาร</h1>
                    <p style={{ color: C.muted, fontSize: '0.75rem', margin: '4px 0 0' }}>ลูกค้าสแกนเพื่อดูเมนูและสั่งอาหารเอง</p>
                </div>
                <button onClick={printAll} style={{ padding: '8px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: C.text, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                    🖨 Print All
                </button>
            </div>

            {/* Zone filter */}
            {zones.length > 1 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {['all', ...zones].map(z => (
                        <button key={z} onClick={() => setFilter(z)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: filter === z ? C.accent : 'rgba(255,255,255,0.06)', color: filter === z ? '#fff' : C.muted, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {z === 'all' ? 'ทุกโซน' : z}
                        </button>
                    ))}
                </div>
            )}

            {/* Stats */}
            <p style={{ color: C.muted, fontSize: '0.72rem', marginBottom: 16 }}>{filtered.length} โต๊ะ</p>

            {/* QR Grid */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: C.muted }}>
                    <p>ยังไม่มีโต๊ะ กรุณาเพิ่มโต๊ะก่อน</p>
                    <a href="/admin/database/diningtable" style={{ color: '#93c5fd', fontSize: '0.82rem' }}>+ เพิ่มโต๊ะ</a>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
                    {tenant && filtered.map(table => (
                        <QRCard key={table.id} table={table} tenantCode={tenant.code} tenantName={tenant.displayName || tenant.name} />
                    ))}
                </div>
            )}

            <style>{`@media print {
                body { background: white !important; }
                .no-print { display: none !important; }
            }`}</style>
        </div>
    )
}
