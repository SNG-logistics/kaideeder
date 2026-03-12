'use client'
import { useState, useEffect } from 'react'

interface QRPayload {
    productId: string
    locationId: string
    sku: string
    productName: string
    unit: string
    locationCode: string
    locationName: string
    currentQty: number
    exp: number
}

interface PageProps {
    params: Promise<{ token: string }>
}

// Decode JWT payload without verifying (verification is done in API)
function decodeJWT(token: string): QRPayload | null {
    try {
        const base64 = token.split('.')[1]
        const decoded = JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')))
        return decoded
    } catch {
        return null
    }
}

import { use } from 'react'
export default function QRMobilePage({ params }: PageProps) {
    const { token } = use(params)
    const [qty, setQty] = useState('')
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState('')
    const [result, setResult] = useState<{ systemQty: number; actualQty: number; diffQty: number } | null>(null)
    const [payload, setPayload] = useState<QRPayload | null>(null)
    const [expired, setExpired] = useState(false)
    const [savedTime, setSavedTime] = useState('')  // hydration-safe: set on client only

    useEffect(() => {
        const p = decodeJWT(token)
        if (!p) { setError('QR code ไม่ถูกต้อง'); return }
        if (p.exp && Date.now() / 1000 > p.exp) {
            setExpired(true); return
        }
        setPayload(p)
    }, [token])

    async function handleSubmit() {
        const actualQty = parseFloat(qty)
        if (isNaN(actualQty) || actualQty < 0) {
            setError('กรุณากรอกจำนวนที่ถูกต้อง'); return
        }
        setLoading(true); setError('')
        try {
            const res = await fetch('/api/qr/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, actualQty })
            })
            const json = await res.json()
            if (json.success) {
                setResult(json.data)
                setSavedTime(new Date().toLocaleTimeString('th-TH'))
                setDone(true)
            } else {
                setError(json.error || 'เกิดข้อผิดพลาด')
            }
        } catch {
            setError('ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่')
        } finally {
            setLoading(false)
        }
    }

    const containerStyle: React.CSSProperties = {
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#F8F9FA', padding: '1.5rem',
        fontFamily: "'Noto Sans Thai', 'Noto Sans Lao', sans-serif",
    }

    // Expired
    if (expired) return (
        <div style={containerStyle}>
            <div style={{ background: 'white', borderRadius: 20, padding: '2rem', textAlign: 'center', maxWidth: 340, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏰</div>
                <h2 style={{ fontWeight: 800, color: '#DC2626', marginBottom: 8, fontSize: '1.2rem' }}>QR หมดอายุแล้ว</h2>
                <p style={{ color: '#6B7280', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    กรุณาขอ QR Sheet ใหม่จาก Manager<br />Token มีอายุ 8 ชั่วโมงต่อวัน
                </p>
            </div>
        </div>
    )

    // Error decode
    if (error && !payload) return (
        <div style={containerStyle}>
            <div style={{ background: 'white', borderRadius: 20, padding: '2rem', textAlign: 'center', maxWidth: 340, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>❌</div>
                <h2 style={{ fontWeight: 800, color: '#DC2626', marginBottom: 8 }}>QR ไม่ถูกต้อง</h2>
                <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>{error}</p>
            </div>
        </div>
    )

    // Success
    if (done && result) return (
        <div style={containerStyle}>
            <div style={{ background: 'white', borderRadius: 20, padding: '2rem', textAlign: 'center', maxWidth: 340, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
                <h2 style={{ fontWeight: 800, color: '#059669', marginBottom: 8, fontSize: '1.3rem' }}>บันทึกสำเร็จ!</h2>
                <p style={{ fontWeight: 700, color: '#111', marginBottom: 16, fontSize: '1rem' }}>
                    {payload?.productName}
                </p>
                <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '1rem', border: '1px solid #BBF7D0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                        <div>
                            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6B7280' }}>{result.systemQty}</p>
                            <p style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>ระบบ</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{result.actualQty}</p>
                            <p style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>จริง</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: result.diffQty > 0 ? '#059669' : result.diffQty < 0 ? '#DC2626' : '#6B7280' }}>
                                {result.diffQty > 0 ? '+' : ''}{result.diffQty}
                            </p>
                            <p style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>ส่วนต่าง</p>
                        </div>
                    </div>
                </div>
                <p style={{ marginTop: 16, fontSize: '0.78rem', color: '#9CA3AF' }}>
                     {payload?.locationCode} · {savedTime}
                </p>
                <button
                    onClick={() => { setDone(false); setQty(''); setResult(null) }}
                    style={{ marginTop: 16, background: 'none', border: '1px solid #E5E7EB', borderRadius: 10, padding: '0.6rem 1.5rem', cursor: 'pointer', color: '#6B7280', fontSize: '0.85rem', fontFamily: 'inherit' }}
                >
                    สแกนใหม่อีกครั้ง
                </button>
            </div>
        </div>
    )

    // Loading payload
    if (!payload) return (
        <div style={containerStyle}>
            <div style={{ fontSize: '2rem' }}>⏳</div>
        </div>
    )

    // Main form
    return (
        <div style={containerStyle}>
            <div style={{ background: 'white', borderRadius: 20, padding: '2rem', maxWidth: 360, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 16,
                        background: 'linear-gradient(135deg, #E8162A, #FF6B81)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 28, margin: '0 auto 12px', boxShadow: '0 4px 14px rgba(232,22,42,0.35)',
                    }}>📦</div>
                    <h1 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#111', marginBottom: 4, lineHeight: 1.3 }}>
                        {payload.productName}
                    </h1>
                    <p style={{ color: '#9CA3AF', fontSize: '0.78rem' }}>
                        [{payload.sku}] · {payload.locationCode}
                    </p>
                </div>

                {/* Current Stock */}
                <div style={{ background: '#F3F4F6', borderRadius: 12, padding: '0.875rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: 4 }}>สต็อคในระบบปัจจุบัน</p>
                    <p style={{ fontSize: '2rem', fontWeight: 800, color: '#374151' }}>
                        {payload.currentQty} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{payload.unit}</span>
                    </p>
                </div>

                {/* Input */}
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: '#374151', marginBottom: 8 }}>
                        กรอกจำนวนที่นับได้จริง ({payload.unit})
                    </label>
                    <input
                        type="number"
                        inputMode="decimal"
                        value={qty}
                        onChange={e => { setQty(e.target.value); setError('') }}
                        placeholder={`เช่น ${payload.currentQty}`}
                        style={{
                            width: '100%', padding: '0.875rem 1rem', border: '2px solid #E5E7EB',
                            borderRadius: 12, fontSize: '1.5rem', fontWeight: 700, textAlign: 'center',
                            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                            color: '#111', transition: 'border-color 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = '#E8162A'}
                        onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                        autoFocus
                    />
                </div>

                {error && (
                    <div style={{ padding: '0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, marginBottom: 12 }}>
                        <p style={{ color: '#DC2626', fontSize: '0.82rem' }}>❌ {error}</p>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={loading || !qty}
                    style={{
                        width: '100%', padding: '1rem', border: 'none', borderRadius: 14,
                        background: !qty || loading ? '#F3F4F6' : 'linear-gradient(135deg, #E8162A, #C0111F)',
                        color: !qty || loading ? '#9CA3AF' : 'white',
                        fontWeight: 800, fontSize: '1.05rem', cursor: !qty || loading ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.2s',
                        boxShadow: !qty || loading ? 'none' : '0 4px 14px rgba(232,22,42,0.4)',
                    }}
                >
                    {loading ? '⏳ กำลังบันทึก...' : '✅ บันทึกสต็อค'}
                </button>

                <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.7rem', color: '#D1D5DB' }}>
                    43 Garden Stock System · QR Scan
                </p>
            </div>
        </div>
    )
}
