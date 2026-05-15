'use client'
import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Item {
    id: string
    name: string
    unit: string
    qty: string
    aiSuggested?: boolean
}

const mkItem = (): Item => ({ id: crypto.randomUUID(), name: '', unit: '', qty: '' })

export default function StockSheetPage() {
    const today = new Date().toISOString().split('T')[0]
    const [date, setDate] = useState(today)
    const [items, setItems] = useState<Item[]>(() => Array.from({ length: 10 }, mkItem))
    const [aiLoading, setAiLoading] = useState(false)

    const update = (id: string, f: keyof Item, v: string) =>
        setItems(p => p.map(i => i.id === id ? { ...i, [f]: v, aiSuggested: f === 'unit' ? false : i.aiSuggested } : i))

    const addRows = (n = 5) => setItems(p => [...p, ...Array.from({ length: n }, mkItem)])

    const remove = (id: string) => setItems(p => p.length > 1 ? p.filter(i => i.id !== id) : p)

    const aiSuggest = useCallback(async () => {
        const named = items.filter(i => i.name.trim())
        if (!named.length) { toast.error('ใส่ชื่อสินค้าก่อน'); return }
        setAiLoading(true)
        try {
            const res = await fetch('/api/stock-sheet/suggest-units', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: named.map(i => i.name.trim()) }),
            })
            const j = await res.json()
            if (!j.success) { toast.error(j.error || 'AI ไม่ตอบสนอง'); return }
            let idx = 0
            setItems(p => p.map(i => {
                if (!i.name.trim()) return i
                return { ...i, unit: j.data[idx++] ?? 'ชิ้น', aiSuggested: true }
            }))
            toast.success(`AI แนะนำหน่วย ${named.length} รายการ ✅`)
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setAiLoading(false) }
    }, [items])

    const filled = items.filter(i => i.name.trim())

    return (
        <>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-area { display: block !important; }
                    @page { margin: 12mm; size: A4 portrait; }
                    body { font-family: 'Noto Sans Thai', sans-serif; }
                }
                @media screen { .print-area { display: none; } }
            `}</style>

            <div className="no-print" style={{ maxWidth: 780, margin: '0 auto' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 14 }}>
                    <div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>📋 ใบกรอกสต็อค</h1>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 3 }}>กรอกรายการเอง · AI แนะนำหน่วย · พิมพ์ PDF</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="date" className="input" style={{ width: 148, fontSize: '0.85rem' }} value={date} onChange={e => setDate(e.target.value)} />
                        <button
                            onClick={aiSuggest} disabled={aiLoading}
                            style={{ padding: '0.55rem 1rem', borderRadius: 9, border: 'none', background: '#7C3AED', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', opacity: aiLoading ? 0.6 : 1, whiteSpace: 'nowrap' }}
                        >
                            {aiLoading ? '⏳ AI...' : '🤖 AI แนะนำหน่วย'}
                        </button>
                        <button
                            onClick={() => window.print()}
                            style={{ padding: '0.55rem 1rem', borderRadius: 9, border: 'none', background: '#E8364E', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                        >
                            🖨️ พิมพ์ PDF
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                    {/* Header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 110px 90px 32px', background: 'var(--bg)', borderBottom: '2px solid var(--border)', padding: '8px 10px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', gap: 8 }}>
                        <div style={{ textAlign: 'center' }}>#</div>
                        <div>ชื่อวัตถุดิบ / สินค้า</div>
                        <div style={{ textAlign: 'center' }}>หน่วย <span style={{ color: '#7C3AED', fontWeight: 800 }}>AI✨</span></div>
                        <div style={{ textAlign: 'center' }}>จำนวน</div>
                        <div />
                    </div>

                    {/* Item rows */}
                    {items.map((item, idx) => (
                        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 110px 90px 32px', gap: 8, padding: '5px 10px', borderBottom: '1px solid var(--border-light)', alignItems: 'center', background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</div>

                            <input
                                className="input" value={item.name}
                                onChange={e => update(item.id, 'name', e.target.value)}
                                placeholder="เช่น กุ้งแช่น้ำปลา, ไข่ไก่, น้ำดื่ม..."
                                style={{ fontSize: '0.875rem', padding: '0.35rem 0.65rem', minHeight: 34 }}
                                suppressHydrationWarning
                            />

                            <input
                                className="input" value={item.unit}
                                onChange={e => update(item.id, 'unit', e.target.value)}
                                placeholder="หน่วย"
                                style={{ fontSize: '0.875rem', padding: '0.35rem 0.65rem', minHeight: 34, textAlign: 'center', border: item.aiSuggested ? '1.5px solid #7C3AED' : undefined, background: item.aiSuggested ? 'rgba(124,58,237,0.04)' : undefined }}
                                suppressHydrationWarning
                            />

                            <input
                                className="input" type="number" min={0} step={0.01} value={item.qty}
                                onChange={e => update(item.id, 'qty', e.target.value)}
                                placeholder="0"
                                style={{ fontSize: '0.875rem', padding: '0.35rem 0.5rem', minHeight: 34, textAlign: 'center' }}
                                suppressHydrationWarning
                            />

                            <button onClick={() => remove(item.id)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}>✕</button>
                        </div>
                    ))}

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            กรอกแล้ว <strong>{filled.length}</strong> รายการ
                            {filled.filter(i => i.aiSuggested).length > 0 && <span style={{ color: '#7C3AED', marginLeft: 10 }}>🤖 AI {filled.filter(i => i.aiSuggested).length} หน่วย</span>}
                        </span>
                        <button onClick={() => addRows(5)} style={{ padding: '0.35rem 0.875rem', borderRadius: 8, border: '1px dashed #D1D5DB', background: 'transparent', color: '#6B7280', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            + เพิ่ม 5 แถว
                        </button>
                    </div>
                </div>
            </div>

            {/* ── PRINT AREA ── */}
            <div className="print-area" style={{ fontFamily: 'Noto Sans Thai, sans-serif' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 14 }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>ใบกรอกสต็อค</div>
                    <div style={{ fontSize: '0.85rem', color: '#444', marginTop: 4 }}>
                        วันที่: {new Date(date + 'T00:00:00').toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                        &nbsp;·&nbsp; รวม {filled.length} รายการ
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ background: '#f0f0f0' }}>
                            <th style={{ border: '1px solid #999', padding: '6px 8px', width: 36, textAlign: 'center' }}>ที่</th>
                            <th style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'left' }}>ชื่อวัตถุดิบ / สินค้า</th>
                            <th style={{ border: '1px solid #999', padding: '6px 8px', width: 90, textAlign: 'center' }}>หน่วย</th>
                            <th style={{ border: '1px solid #999', padding: '6px 8px', width: 80, textAlign: 'center' }}>จำนวน</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'center', color: '#777' }}>{idx + 1}</td>
                                <td style={{ border: '1px solid #ccc', padding: '6px 8px', fontWeight: item.name ? 600 : 400 }}>{item.name || ''}</td>
                                <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'center' }}>{item.unit}</td>
                                <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>{item.qty}</td>
                            </tr>
                        ))}
                        {/* Extra blank rows */}
                        {Array.from({ length: 5 }).map((_, i) => (
                            <tr key={`x-${i}`}>
                                <td style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'center', color: '#bbb' }}>{items.length + i + 1}</td>
                                <td style={{ border: '1px solid #ccc', padding: '14px 8px' }} />
                                <td style={{ border: '1px solid #ccc', padding: '14px 8px' }} />
                                <td style={{ border: '1px solid #ccc', padding: '14px 8px' }} />
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-around', fontSize: '0.78rem', color: '#555' }}>
                    {['ผู้นับ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ'].map(t => (
                        <div key={t} style={{ textAlign: 'center', borderTop: '1px solid #999', paddingTop: 6, width: 140 }}>{t}</div>
                    ))}
                </div>
            </div>
        </>
    )
}
