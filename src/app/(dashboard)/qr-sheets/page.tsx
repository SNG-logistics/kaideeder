'use client'
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

interface Location {
    id: string
    code: string
    name: string
    nameLao: string
    isActive: boolean
}

interface QRItem {
    sku: string
    productName: string
    unit: string
    currentQty: number
    token: string
    qrUrl: string
}

function qrImgUrl(data: string, size = 140) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=8`
}

export default function QRSheetPage() {
    const [locations, setLocations] = useState<Location[]>([])
    const [selectedLocation, setSelectedLocation] = useState('')
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<QRItem[]>([])
    const [locationInfo, setLocationInfo] = useState<{ code: string; name: string } | null>(null)
    const printRef = useRef<HTMLDivElement>(null)
    const [today, setToday] = useState('')

    useEffect(() => {
        setToday(new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }))
    }, [])

    useEffect(() => {
        fetch('/api/locations').then(r => r.json()).then(d => {
            if (d.success) setLocations(d.data.filter((l: Location) => l.isActive))
        })
    }, [])

    async function handleGenerate() {
        if (!selectedLocation) return toast.error('กรุณาเลือก Location')
        setLoading(true); setItems([])
        try {
            const res = await fetch('/api/qr/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationId: selectedLocation })
            })
            const json = await res.json()
            if (json.success) {
                setItems(json.data.tokens)
                setLocationInfo(json.data.location)
                toast.success(`พร้อมพิมพ์ ${json.data.tokens.length} รายการ — Token อายุ 8 ชม.`)
            } else {
                toast.error(json.error || 'เกิดข้อผิดพลาด')
            }
        } catch {
            toast.error('เกิดข้อผิดพลาด')
        } finally {
            setLoading(false)
        }
    }


    return (
        <>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; top: 0; left: 0; width: 100%; }
                    @page { margin: 10mm; size: A4; }
                }
            `}</style>

            {/* Control Panel */}
            <div className="no-print page-container" style={{ maxWidth: 900 }}>
                <div className="page-header">
                    <div>
                        <h1 className="page-title">🖨️ พิมพ์ QR Sheet</h1>
                        <p className="page-subtitle">สแกน QR อัปเดตสต็อคจากมือถือ — ไม่ต้อง login</p>
                    </div>
                </div>

                <div style={{
                    background: 'rgba(232,54,78,0.04)', border: '1.5px solid rgba(232,54,78,0.18)',
                    borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 20,
                    display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, textAlign: 'center',
                }}>
                    {[
                        { icon: '🖨️', title: 'พิมพ์ Sheet', desc: 'เลือก Location แล้วพิมพ์ A4' },
                        { icon: '📱', title: 'สแกน QR', desc: 'มือถือสแกน → กรอกจำนวน' },
                        { icon: '✅', title: 'อัปเดตทันที', desc: 'ระบบบันทึก adjustment อัตโนมัติ' },
                    ].map(s => (
                        <div key={s.title}>
                            <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{s.icon}</div>
                            <p style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: 2 }}>{s.title}</p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="card">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'flex-end' }}>
                        <div>
                            <label className="label">📍 เลือก Location</label>
                            <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="input">
                                <option value="">-- เลือก Location --</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleGenerate} disabled={loading || !selectedLocation} className="btn-primary"
                            style={{ padding: '0.7rem 1.5rem', whiteSpace: 'nowrap' }}>
                            {loading ? '⏳ สร้าง QR...' : '⚡ สร้าง QR'}
                        </button>
                        {items.length > 0 && (
                            <button onClick={() => window.print()}
                                style={{
                                    padding: '0.7rem 1.5rem', whiteSpace: 'nowrap',
                                    background: '#059669', color: 'white', border: 'none',
                                    borderRadius: 10, fontWeight: 700, cursor: 'pointer',
                                    fontSize: '0.875rem', fontFamily: 'inherit',
                                }}>
                                🖨️ Print
                            </button>
                        )}
                    </div>
                    {items.length > 0 && (
                        <div style={{ marginTop: 12, padding: '0.75rem', background: 'rgba(245,158,11,0.08)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.25)' }}>
                            <p style={{ fontSize: '0.78rem', color: '#D97706' }}>
                                ⚠️ QR Token มีอายุ <strong>8 ชั่วโมง</strong> — พิมพ์และใช้ภายในวันเดียว
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Print Area */}
            {items.length > 0 && locationInfo && (
                <div id="print-area" ref={printRef} style={{ padding: '8mm', fontFamily: 'sans-serif', maxWidth: 900, margin: '20px auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 16, borderBottom: '2px solid #E8162A', paddingBottom: 10 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#E8162A' }}>43 Garden — QR Inventory Sheet</h2>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                            {locationInfo.code} ({locationInfo.name}) · {today} · Token หมดอายุ 8 ชม.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        {items.map(item => (
                            <div key={item.sku} style={{
                                border: '1.5px solid #ddd', borderRadius: 8,
                                padding: '10px', textAlign: 'center',
                                breakInside: 'avoid', background: 'white',
                            }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={qrImgUrl(item.qrUrl)} alt={item.sku} width={140} height={140}
                                    style={{ display: 'block', margin: '0 auto 6px' }} />
                                <p style={{ fontWeight: 700, fontSize: 11, margin: '0 0 2px', lineHeight: 1.3 }}>
                                    {item.productName}
                                </p>
                                <p style={{ fontSize: 9, color: '#777', margin: 0 }}>
                                    [{item.sku}] คลัง: {item.currentQty} {item.unit}
                                </p>
                                <div style={{ marginTop: 6, borderTop: '1px dashed #ddd', paddingTop: 6 }}>
                                    <p style={{ fontSize: 8, color: '#aaa', margin: '0 0 3px' }}>นับได้ ({item.unit}):</p>
                                    <div style={{ border: '1px solid #ccc', borderRadius: 4, height: 22, background: '#fafafa' }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <p style={{ marginTop: 12, fontSize: 9, color: '#aaa', textAlign: 'center' }}>
                        สแกน QR → กรอกจำนวน → กด ✅ ระบบอัปเดตสต็อคอัตโนมัติ | 43 Garden Stock System
                    </p>
                </div>
            )}
        </>
    )
}
