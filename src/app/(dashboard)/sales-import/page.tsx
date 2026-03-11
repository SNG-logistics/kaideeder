'use client'

import { useCurrency } from '@/context/TenantContext';
import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'


interface ImportResult {
    importId: string; totalItems: number; totalAmount: number
    deducted: number; unmatched: number; message: string
}

export default function SalesImportPage() {
    const { fmt } = useCurrency()

    const [file, setFile] = useState<File | null>(null)
    const [saleDate, setSaleDate] = useState('')  // init empty; set client-side to avoid SSR mismatch
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<ImportResult | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    // Init saleDate client-side only (avoids SSR hydration mismatch)
    useEffect(() => { setSaleDate(new Date().toISOString().split('T')[0]) }, [])

    async function handleImport() {
        if (!file) return toast.error('กรุณาเลือกไฟล์ Excel')
        if (!saleDate) return toast.error('กรุณาระบุวันที่ขาย')
        setLoading(true); setResult(null)
        const formData = new FormData()
        formData.append('file', file); formData.append('saleDate', saleDate)
        try {
            const res = await fetch('/api/sales/import', { method: 'POST', body: formData })
            const json = await res.json()
            if (json.success) { setResult(json.data); toast.success('นำเข้าสำเร็จ!') }
            else toast.error(json.error || 'เกิดข้อผิดพลาด')
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setLoading(false) }
    }

    function handleDownloadTemplate() {
        window.open('/api/sales/sample-template', '_blank')
        toast.success('ดาวน์โหลด template แล้ว — เปิดด้วย Excel แล้วกรอกข้อมูล')
    }

    return (
        <div className="page-container" style={{ maxWidth: 860 }}>
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">💾 นำเข้ายอดขาย</h1>
                    <p className="page-subtitle">Auto ตัดสต็อคตาม Recipe/BOM — อัพโหลดไฟล์ Excel จาก POS หรือบันทึกเอง</p>
                </div>
            </div>

            {/* No-POS Banner */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(232,54,78,0.06) 0%, rgba(232,54,78,0.02) 100%)',
                border: '1.5px solid rgba(232,54,78,0.2)', borderRadius: 16,
                padding: '1.25rem 1.5rem', marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
            }}>
                <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem', marginBottom: 4 }}>
                        🏪 ไม่มีเครื่อง POS? ไม่เป็นไร
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        ดาวน์โหลด Template Excel → กรอกยอดขายประจำวัน → อัพโหลดกลับมา → ระบบตัดสต็อคให้อัตโนมัติ
                    </p>
                </div>
                <button
                    onClick={handleDownloadTemplate}
                    style={{
                        background: 'var(--accent)', color: 'white', border: 'none',
                        borderRadius: 10, padding: '0.6rem 1.2rem', fontWeight: 700,
                        fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap',
                        boxShadow: '0 4px 12px rgba(232,54,78,0.3)', fontFamily: 'inherit',
                    }}
                >
                    ⬇️ ดาวน์โหลดไฟล์ตัวอย่าง
                </button>
            </div>

            {/* Format Info */}
            <div style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '1rem 1.25rem', marginBottom: 16,
            }}>
                <p style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: 10 }}>
                    📋 รูปแบบไฟล์ที่รองรับ (.xlsx / .xls / .csv)
                </p>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1.5px solid var(--border)' }}>
                                {['ลำดับ', 'ชื่อสินค้า', 'ราคา/หน่วย', 'จำนวน', 'หมวด'].map(h => (
                                    <th key={h} style={{
                                        padding: '6px 12px', textAlign: 'left', fontWeight: 700,
                                        color: 'var(--accent)', background: 'rgba(232,54,78,0.05)',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['1', 'ข้าวผัดหมู', '35,000', '5', 'อาหาร'],
                                ['2', 'ต้มยำกุ้ง', '55,000', '3', 'อาหาร'],
                                ['3', 'น้ำเปล่า', '10,000', '10', 'เครื่องดื่ม'],
                            ].map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)', opacity: 0.7 }}>
                                    {row.map((cell, j) => (
                                        <td key={j} style={{ padding: '6px 12px', color: 'var(--text)', fontFamily: j === 0 || j === 2 || j === 3 ? 'monospace' : 'inherit' }}>{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    💡 ชื่อสินค้าต้องตรงกับ Recipe/BOM ที่บันทึกไว้ในระบบ เพื่อให้ตัดสต็อคได้อัตโนมัติ
                </p>
            </div>

            {/* Upload Card */}
            <div className="card" style={{ marginBottom: 16 }}>
                <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 16, fontSize: '0.95rem' }}>📁 อัพโหลดไฟล์</h2>

                {/* Drop Zone */}
                <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
                    style={{
                        border: `2px dashed ${isDragging ? 'var(--accent)' : file ? '#10B981' : 'var(--border)'}`,
                        borderRadius: 16, padding: '2rem', textAlign: 'center',
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: isDragging ? 'var(--accent-bg)' : file ? 'rgba(16,185,129,0.05)' : 'var(--bg)',
                    }}
                >
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                        onChange={e => setFile(e.target.files?.[0] || null)} />
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>{file ? '✅' : '📊'}</div>
                    {file ? (
                        <div>
                            <p style={{ fontWeight: 700, color: '#059669', fontSize: '0.95rem' }}>{file.name}</p>
                            <button onClick={e => { e.stopPropagation(); setFile(null) }}
                                style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>
                                เปลี่ยนไฟล์
                            </button>
                        </div>
                    ) : (
                        <>
                            <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>รองรับ .xlsx, .xls, .csv</p>
                        </>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                    <div>
                        <label className="label">📅 วันที่ขาย</label>
                        <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="input" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button onClick={handleImport} disabled={!file || loading} className="btn-primary" style={{ width: '100%', padding: '0.7rem', fontSize: '0.925rem' }}>
                            {loading ? '⏳ กำลังประมวลผล...' : '🚀 นำเข้าและตัดสต็อค'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Result */}
            {result && (
                <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: '1.5rem', marginBottom: 16 }}>
                    <h2 style={{ fontWeight: 700, color: '#059669', marginBottom: 16, fontSize: '0.95rem' }}>✅ ผลการนำเข้า</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        {[
                            { label: 'รายการทั้งหมด', value: result.totalItems, color: 'var(--text)' },
                            { label: 'ยอดขายรวม', value: fmt(result.totalAmount), color: 'var(--accent)' },
                            { label: 'ตัดสต็อคแล้ว', value: result.deducted, color: '#059669' },
                            { label: 'ไม่พบ Recipe', value: result.unmatched, color: result.unmatched > 0 ? '#D97706' : '#059669' },
                        ].map((s, i) => (
                            <div key={i} style={{ background: 'var(--white)', borderRadius: 12, padding: '0.875rem', textAlign: 'center', border: '1px solid var(--border)' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</p>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                    {result.unmatched > 0 && (
                        <div style={{ marginTop: 12, padding: '0.75rem', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10 }}>
                            <p style={{ fontSize: '0.85rem', color: '#D97706' }}>
                                ⚠️ มี {result.unmatched} รายการไม่มี Recipe —{' '}
                                <a href="/recipes" style={{ fontWeight: 600, color: 'var(--accent)', textDecoration: 'underline' }}>เพิ่ม Recipe/BOM ที่นี่</a>
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Flow Steps */}
            <div className="card">
                <h3 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 16, fontSize: '0.9rem' }}>🔄 ขั้นตอนการทำงาน</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {[
                        { icon: '🏪', step: 'มี POS', desc: 'Export Excel จาก POS → อัพโหลดที่นี่', color: 'var(--accent)' },
                        { icon: '📝', step: 'ไม่มี POS', desc: 'ดาวน์โหลด Template → กรอกยอดขาย → อัพโหลด', color: '#7C3AED' },
                        { icon: '🔗', step: 'Match Recipe', desc: 'ระบบจับคู่ชื่อเมนูกับ Recipe/BOM ในระบบ', color: '#D97706' },
                        { icon: '✅', step: 'ตัดสต็อคอัตโนมัติ', desc: 'วัตถุดิบลดอัตโนมัติตาม BOM ของแต่ละเมนู', color: '#059669' },
                    ].map((s, i) => (
                        <div key={i} style={{
                            background: 'var(--bg)', borderRadius: 12, padding: '0.875rem',
                            border: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}>
                            <span style={{ fontSize: '1.25rem' }}>{s.icon}</span>
                            <div>
                                <p style={{ fontWeight: 700, fontSize: '0.82rem', color: s.color, marginBottom: 2 }}>{s.step}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
