'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface Product { id: string; sku: string; name: string; unit: string }
interface Location { id: string; code: string; name: string }
interface TransferItem { productId: string; quantity: number }

export default function TransferPage() {
    useRoleGuard(['owner', 'manager', 'warehouse'])
    const [products, setProducts] = useState<Product[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [fromLocId, setFromLocId] = useState('')
    const [toLocId, setToLocId] = useState('')
    const [items, setItems] = useState<TransferItem[]>([])
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)
    const [history, setHistory] = useState<unknown[]>([])
    const [tab, setTab] = useState<'new' | 'history'>('new')

    useEffect(() => {
        fetch('/api/products?limit=500').then(r => r.json()).then(j => j.success && setProducts(j.data.products))
        fetch('/api/locations').then(r => r.json()).then(j => {
            if (j.success) {
                setLocations(j.data)
                if (j.data.length >= 2) {
                    setFromLocId(j.data[0].id)
                    setToLocId(j.data[5]?.id || j.data[1].id)
                }
            }
        })
        fetchHistory()
    }, [])

    async function fetchHistory() {
        const res = await fetch('/api/transfer')
        const json = await res.json()
        if (json.success) setHistory(json.data)
    }

    function addItem() {
        if (products.length === 0) return
        setItems([...items, { productId: products[0].id, quantity: 1 }])
    }

    async function handleSave() {
        if (!fromLocId || !toLocId) return toast.error('กรุณาเลือกคลัง')
        if (fromLocId === toLocId) return toast.error('คลังต้นทางและปลายทางต้องไม่เหมือนกัน')
        if (items.length === 0) return toast.error('กรุณาเพิ่มรายการ')
        setSaving(true)
        try {
            const res = await fetch('/api/transfer', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromLocationId: fromLocId, toLocationId: toLocId, note, items })
            })
            const json = await res.json()
            if (json.success) {
                toast.success(`✅ โอนคลังเรียบร้อย ${json.data.items} รายการ`)
                setItems([]); setNote(''); fetchHistory()
            } else toast.error(json.error)
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    const fromName = locations.find(l => l.id === fromLocId)?.name || ''
    const toName = locations.find(l => l.id === toLocId)?.name || ''

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">🔄 เบิก / โอนคลัง</h1>
                    <p className="page-subtitle">ย้ายสินค้าระหว่างคลัง — สต็อคอัปเดตทันที</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['new', 'history'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            padding: '0.45rem 1.125rem', borderRadius: 10,
                            border: tab === t ? 'none' : '1px solid var(--border)',
                            cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
                            background: tab === t ? 'var(--accent)' : 'var(--white)',
                            color: tab === t ? 'white' : 'var(--text-muted)',
                            transition: 'all 0.18s',
                        }}>
                            {t === 'new' ? '➕ สร้างใหม่' : '📋 ประวัติ'}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'new' ? (
                <div className="card">
                    {/* From → To */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
                        <div style={{ flex: 1 }}>
                            <label className="label">📤 จากคลัง</label>
                            <select value={fromLocId} onChange={e => setFromLocId(e.target.value)} className="input">
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                            </select>
                        </div>
                        {/* Arrow */}
                        <div style={{ paddingBottom: 8, textAlign: 'center', minWidth: 80 }}>
                            {fromName && toName ? (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>โอนไป</div>
                            ) : null}
                            <div style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>→</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="label">📥 ไปคลัง</label>
                            <select value={toLocId} onChange={e => setToLocId(e.target.value)} className="input">
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Route display */}
                    {fromName && toName && fromLocId !== toLocId && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                            background: 'var(--accent-bg)', borderRadius: 10, padding: '0.6rem 1rem',
                            border: '1px solid rgba(232,54,78,0.15)'
                        }}>
                            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{fromName}</span>
                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{toName}</span>
                        </div>
                    )}

                    <div style={{ marginBottom: 16 }}>
                        <label className="label">หมายเหตุ</label>
                        <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="เหตุผลการเบิก" />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <h3 style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>
                            📦 รายการเบิก <span style={{ color: 'var(--accent)', marginLeft: 6 }}>{items.length} รายการ</span>
                        </h3>
                        <button onClick={addItem} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.875rem' }}>➕ เพิ่มรายการ</button>
                    </div>

                    {items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem', border: '2px dashed var(--border)', borderRadius: 14, color: 'var(--text-muted)' }}>
                            <p style={{ marginBottom: 4 }}>📦 ยังไม่มีรายการ</p>
                            <p style={{ fontSize: '0.8rem' }}>กด &ldquo;เพิ่มรายการ&rdquo; เพื่อเริ่ม</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {items.map((item, i) => (
                                <div key={i} style={{
                                    display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center',
                                    background: 'var(--bg)', borderRadius: 10, padding: '0.625rem', border: '1px solid var(--border)'
                                }}>
                                    <select value={item.productId} onChange={e => { const ni = [...items]; ni[i].productId = e.target.value; setItems(ni) }}
                                        className="input" style={{ fontSize: '0.85rem' }}>
                                        {products.map(p => <option key={p.id} value={p.id}>[{p.sku}] {p.name} ({p.unit})</option>)}
                                    </select>
                                    <input type="number" value={item.quantity}
                                        onChange={e => { const ni = [...items]; ni[i].quantity = parseFloat(e.target.value) || 0; setItems(ni) }}
                                        className="input" placeholder="จำนวน" min={0.1} step={0.1} style={{ width: 120, fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }} />
                                    <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        <button onClick={handleSave} disabled={saving || items.length === 0} className="btn-primary" style={{ padding: '0.65rem 1.75rem', fontSize: '0.925rem' }}>
                            {saving ? '⏳ กำลังบันทึก...' : '✅ บันทึกโอนคลัง'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="table">
                        <thead><tr>
                            <th>วันที่</th><th>จาก</th><th>ไป</th><th>รายการ</th><th>สถานะ</th><th>ผู้เบิก</th>
                        </tr></thead>
                        <tbody>
                            {(history as { transferDate: string; fromLocation: { name: string }; toLocation: { name: string }; _count: { items: number }; status: string; requestedBy?: { name: string } }[]).map((h, i) => (
                                <tr key={i}>
                                    <td style={{ fontSize: '0.82rem' }}>{new Date(h.transferDate).toLocaleDateString('th-TH')}</td>
                                    <td style={{ fontWeight: 600, fontSize: '0.84rem' }}>{h.fromLocation.name}</td>
                                    <td style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--accent)' }}>{h.toLocation.name}</td>
                                    <td style={{ fontWeight: 700 }}>{h._count.items} รายการ</td>
                                    <td><span style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>{h.status}</span></td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{h.requestedBy?.name || '-'}</td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>ยังไม่มีประวัติการโอน</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
