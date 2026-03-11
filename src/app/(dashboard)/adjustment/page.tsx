'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useRef, useCallback, type ChangeEvent } from 'react'
import toast from 'react-hot-toast'

interface Product { id: string; sku: string; name: string; unit: string }
interface Location { id: string; code: string; name: string }
interface AdjItem { productId: string; actualQty: number }

// ---- Searchable Product Combobox ----
function ProductCombobox({ products, value, onChange }: {
    products: Product[]
    value: string
    onChange: (productId: string) => void
}) {
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)
    const selected = products.find(p => p.id === value)
    const displayValue = open ? query : (selected ? `[${selected.sku}] ${selected.name}` : '')

    const filtered = query.length === 0
        ? products.slice(0, 50)
        : products.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.sku.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 40)

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false); setQuery('')
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    return (
        <div ref={ref} style={{ position: 'relative', flex: 1 }}>
            <input
                type="text"
                className="input"
                placeholder="🔍 พิมพ์ชื่อหรือ SKU..."
                value={displayValue}
                style={{ fontSize: '0.85rem', width: '100%' }}
                onFocus={() => { setOpen(true); setQuery('') }}
                onChange={e => { setQuery(e.target.value); setOpen(true) }}
            />
            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: 'var(--white)', border: '1px solid var(--border)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    maxHeight: 240, overflowY: 'auto', marginTop: 4,
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>ไม่พบสินค้า</div>
                    ) : filtered.map(p => (
                        <div
                            key={p.id}
                            onMouseDown={() => { onChange(p.id); setOpen(false); setQuery('') }}
                            style={{
                                padding: '0.5rem 0.875rem', cursor: 'pointer', fontSize: '0.82rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: p.id === value ? 'var(--accent-bg)' : 'transparent',
                                borderBottom: '1px solid var(--border-light)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                            onMouseLeave={e => (e.currentTarget.style.background = p.id === value ? 'var(--accent-bg)' : 'transparent')}
                        >
                            <span style={{ fontWeight: p.id === value ? 700 : 400, color: 'var(--text)' }}>{p.name}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 8 }}>{p.sku} · {p.unit}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function AdjustmentPage() {
    useRoleGuard(['owner', 'manager', 'warehouse'])
    const [products, setProducts] = useState<Product[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [selectedLoc, setSelectedLoc] = useState('')
    const [reason, setReason] = useState('นับสต็อค (Physical Count)')
    const [note, setNote] = useState('')
    const [items, setItems] = useState<AdjItem[]>([])
    const [saving, setSaving] = useState(false)
    const [showScanModal, setShowScanModal] = useState(false)
    const [showCreateLoc, setShowCreateLoc] = useState(false)
    const [newLocName, setNewLocName] = useState('คลังหลัก')
    const [newLocCode, setNewLocCode] = useState('MAIN')
    const [creatingLoc, setCreatingLoc] = useState(false)

    async function createLocation() {
        if (!newLocName.trim() || !newLocCode.trim()) return
        setCreatingLoc(true)
        try {
            const res = await fetch('/api/locations', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newLocName.trim(), code: newLocCode.trim() }),
            })
            const j = await res.json()
            if (j.success) {
                setLocations([j.data])
                setSelectedLoc(j.data.id)
                setShowCreateLoc(false)
                toast.success(`✅ สร้างคลัง "${j.data.name}" เรียบร้อย`)
            } else toast.error(j.error)
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setCreatingLoc(false) }
    }

    useEffect(() => {
        fetch('/api/products?limit=500').then(r => r.json()).then(j => j.success && setProducts(j.data.products))
        fetch('/api/locations').then(r => r.json()).then(j => {
            if (j.success) { setLocations(j.data); if (j.data.length > 0) setSelectedLoc(j.data[0].id) }
        })
    }, [])

    function addItem() {
        setItems([...items, { productId: '', actualQty: 0 }])
    }

    async function handleSave() {
        if (!selectedLoc) return toast.error('กรุณาเลือกคลัง')
        const validItems = items.filter(i => i.productId)
        if (validItems.length === 0) return toast.error('กรุณาเพิ่มรายการและเลือกสินค้า')
        setSaving(true)
        try {
            const res = await fetch('/api/adjustment', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locationId: selectedLoc, reason, note, items: validItems })
            })
            const json = await res.json()
            if (json.success) { toast.success('✅ ปรับสต็อคเรียบร้อย'); setItems([]) }
            else toast.error(json.error)
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setSaving(false) }
    }

    const selectedLocName = locations.find(l => l.id === selectedLoc)?.name || ''

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">⚖️ ปรับสต็อค / นับของจริง</h1>
                    <p className="page-subtitle">บันทึก Physical Count — ระบบจะปรับค่าสต็อคให้ตรงกับจำนวนจริง</p>
                </div>
                {selectedLocName && (
                    <div style={{ background: 'var(--accent-bg)', border: '1px solid rgba(232,54,78,0.2)', borderRadius: 10, padding: '0.5rem 1rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>คลังที่เลือก</span>
                        <p style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem' }}>{selectedLocName}</p>
                    </div>
                )}
            </div>

            <div className="card">
                {/* Config row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
                    <div>
                        <label className="label">📍 คลัง *</label>
                        {locations.length === 0 ? (
                            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 12px' }}>
                                <div style={{ fontSize: '0.78rem', color: '#D97706', fontWeight: 700, marginBottom: 8 }}>⚠ ยังไม่มีคลัง — กรุณาสร้างคลังก่อน</div>
                                {!showCreateLoc ? (
                                    <button onClick={() => setShowCreateLoc(true)} style={{
                                        background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 8,
                                        padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'inherit',
                                    }}>🏠 สร้างคลังใหม่</button>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <input value={newLocName} onChange={e => setNewLocName(e.target.value)}
                                                placeholder="ชื่อคลัง" className="input" style={{ flex: 2, minHeight: 34, fontSize: '0.82rem' }} />
                                            <input value={newLocCode} onChange={e => setNewLocCode(e.target.value.toUpperCase())}
                                                placeholder="รหัส" className="input" style={{ flex: 1, minHeight: 34, fontSize: '0.82rem', fontFamily: 'monospace' }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => setShowCreateLoc(false)} style={{
                                                flex: 1, padding: '5px', borderRadius: 8, border: '1px solid #D1D5DB',
                                                background: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit',
                                            }}>ยกเลิก</button>
                                            <button onClick={createLocation} disabled={creatingLoc} style={{
                                                flex: 2, padding: '5px', borderRadius: 8, border: 'none',
                                                background: creatingLoc ? '#A7F3D0' : '#059669', color: '#fff',
                                                cursor: creatingLoc ? 'wait' : 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
                                            }}>{creatingLoc ? '⏳ กำลังสร้าง...' : '✅ สร้างคลัง'}</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                        <select value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)} className="input">
                            {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                        </select>
                        )}
                    </div>
                    <div>
                        <label className="label">📝 เหตุผล *</label>
                        <select value={reason} onChange={e => setReason(e.target.value)} className="input">
                            <option>นับสต็อค (Physical Count)</option>
                            <option>สต็อคเริ่มต้น (Opening Stock)</option>
                            <option>ของเสีย (Waste)</option>
                            <option>หาย / สูญหาย</option>
                            <option>อื่นๆ</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">หมายเหตุเพิ่มเติม</label>
                        <input value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="รายละเอียดเพิ่มเติม" />
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>
                        📦 รายการปรับสต็อค <span style={{ color: 'var(--accent)', marginLeft: 6 }}>{items.length} รายการ</span>
                    </h3>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setShowScanModal(true)}
                            style={{
                                fontSize: '0.8rem', padding: '0.35rem 0.875rem',
                                background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
                                color: '#fff', border: 'none', borderRadius: 8,
                                cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', gap: 5,
                            }}
                        >📷 สแกนใบนับ</button>
                        <button onClick={addItem} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.875rem' }}>➕ เพิ่มรายการ</button>
                    </div>
                </div>

                {items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border)', borderRadius: 14 }}>
                        <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>📋</p>
                        <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>เริ่มนับของจริง</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>เลือกสินค้าแล้วกรอก &ldquo;จำนวนจริง&rdquo; ที่นับได้</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '0 0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>สินค้า (พิมพ์ค้นหาได้)</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', width: 160, textAlign: 'center' }}>จำนวนจริง (นับได้)</span>
                            <span style={{ width: 36 }}></span>
                        </div>
                        {items.map((item, i) => (
                            <div key={i} style={{
                                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center',
                                background: 'var(--bg)', borderRadius: 10, padding: '0.625rem', border: '1px solid var(--border)'
                            }}>
                                {/* ✅ Searchable combobox */}
                                <ProductCombobox
                                    products={products}
                                    value={item.productId}
                                    onChange={productId => { const ni = [...items]; ni[i].productId = productId; setItems(ni) }}
                                />
                                <input type="number" value={item.actualQty}
                                    onChange={e => { const ni = [...items]; ni[i].actualQty = parseFloat(e.target.value) || 0; setItems(ni) }}
                                    className="input" placeholder="จำนวนจริง" min={0} step={0.1}
                                    style={{ width: 160, fontSize: '0.9rem', textAlign: 'right', color: 'var(--accent)', fontWeight: 700 }} />
                                <button onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                                    style={{ width: 36, background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <button onClick={handleSave} disabled={saving || items.length === 0} className="btn-primary" style={{ padding: '0.65rem 1.75rem', fontSize: '0.925rem' }}>
                        {saving ? '⏳ กำลังบันทึก...' : '✅ บันทึกปรับสต็อค'}
                    </button>
                </div>
            </div>

            {showScanModal && (
                <StockCountScanModal
                    products={products}
                    onClose={() => setShowScanModal(false)}
                    onImport={(scanned) => {
                        setItems(prev => [...prev, ...scanned])
                        setShowScanModal(false)
                        toast.success(`✅ นำเข้า ${scanned.length} รายการแล้ว`)
                    }}
                />
            )}
        </div>
    )
}

// ══════════════════════════════════════════════════════════════
// STOCK COUNT SCAN MODAL
// ══════════════════════════════════════════════════════════════
interface ScannedRow {
    rawName: string
    qty: number
    unit: string
    productId: string | null
    productName: string | null
    productSku: string | null
    productUnit: string | null
    matched: boolean
}

function StockCountScanModal({ products, onClose, onImport }: {
    products: Product[]
    onClose: () => void
    onImport: (items: AdjItem[]) => void
}) {
    const [mode, setMode] = useState<'choose' | 'camera' | 'scanning' | 'review'>('choose')
    const [scanned, setScanned] = useState<ScannedRow[]>([])
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [editQty, setEditQty] = useState<Record<number, number>>({})
    const [editProduct, setEditProduct] = useState<Record<number, string>>({})
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
    }, [])
    useEffect(() => () => stopCamera(), [stopCamera])

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            })
            streamRef.current = stream
            if (videoRef.current) videoRef.current.srcObject = stream
            setMode('camera')
        } catch { toast.error('ไม่สามารถเปิดกล้องได้') }
    }, [])

    async function scanImage(base64: string) {
        setMode('scanning')
        try {
            const res = await fetch('/api/stock-count/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64 }),
            })
            const json = await res.json()
            if (!json.success) { toast.error(json.error || 'สแกนไม่สำเร็จ'); setMode('choose'); return }
            const rows: ScannedRow[] = json.data.items
            setScanned(rows)
            // Pre-select all matched rows
            const sel = new Set<number>()
            rows.forEach((r, i) => { if (r.matched) sel.add(i) })
            setSelected(sel)
            setMode('review')
            toast.success(`🤖 อ่านได้ ${rows.length} รายการ (จับคู่สำเร็จ ${json.data.matched} รายการ)`)
        } catch { toast.error('เกิดข้อผิดพลาด'); setMode('choose') }
    }

    const captureAndScan = async () => {
        const video = videoRef.current
        if (!video) return
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth; canvas.height = video.videoHeight
        canvas.getContext('2d')!.drawImage(video, 0, 0)
        const base64 = canvas.toDataURL('image/jpeg', 0.92)
        stopCamera()
        await scanImage(base64)
    }

    const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async ev => {
            const base64 = ev.target?.result as string
            await scanImage(base64)
        }
        reader.readAsDataURL(file)
    }

    const toggleSelect = (i: number) => {
        setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
    }

    const handleImport = () => {
        const items: AdjItem[] = []
        selected.forEach(i => {
            const row = scanned[i]
            const prodId = editProduct[i] ?? row.productId
            const qty = editQty[i] ?? row.qty
            if (prodId) items.push({ productId: prodId, actualQty: qty })
        })
        if (!items.length) { toast.error('กรุณาเลือกอย่างน้อย 1 รายการ'); return }
        onImport(items)
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: '0.75rem',
        }} onClick={e => { if (e.target === e.currentTarget) { stopCamera(); onClose() } }}>
            <div style={{
                background: 'var(--white)', borderRadius: 18, width: '100%', maxWidth: 620,
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            }}>
                {/* Header */}
                <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                            {mode === 'scanning' ? '🤖 AI กำลังอ่านใบนับ...' : mode === 'review' ? '✅ ตรวจสอบรายการ' : '📷 สแกนใบนับสต็อค'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {mode === 'choose' && 'ถ่ายหรืออัปโหลดรูปใบนับสต็อค AI จะอ่านและนำเข้าให้อัตโนมัติ'}
                            {mode === 'review' && `พบ ${scanned.length} รายการ — เลือกรายการที่ต้องการนำเข้า`}
                        </div>
                    </div>
                    <button onClick={() => { stopCamera(); onClose() }}
                        style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)', flexShrink: 0 }}>✕</button>
                </div>

                <div style={{ overflowY: 'auto', flexGrow: 1, padding: '1rem' }}>
                    {/* ── CHOOSE ── */}
                    {mode === 'choose' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <button onClick={startCamera} style={{
                                    padding: '2rem 1rem', borderRadius: 14, border: '2px dashed var(--border)',
                                    background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.18s',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.background = 'rgba(124,58,237,0.05)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}>
                                    <span style={{ fontSize: '2.2rem' }}>📷</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>ถ่ายรูปใบนับ</span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>ใช้กล้องถ่ายใบกระดาษ</span>
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} style={{
                                    padding: '2rem 1rem', borderRadius: 14, border: '2px dashed var(--border)',
                                    background: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.18s',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = 'rgba(37,99,235,0.05)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}>
                                    <span style={{ fontSize: '2.2rem' }}>🖼️</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>อัปโหลดรูป</span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>JPG, PNG จาก Gallery</span>
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
                            </div>
                            <div style={{ padding: '0.75rem', background: 'rgba(124,58,237,0.06)', borderRadius: 10, border: '1px solid rgba(124,58,237,0.15)' }}>
                                <div style={{ fontSize: '0.76rem', color: '#7C3AED', fontWeight: 600, marginBottom: 4 }}>💡 วิธีถ่ายให้ได้ผลดี</div>
                                <ul style={{ fontSize: '0.72rem', color: 'var(--text-muted)', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.7 }}>
                                    <li>วางใบนับให้ตรงกับกล้อง ไม่เอียง</li>
                                    <li>แสงสว่างพอ ตัวเลขชัดเจน อ่านง่าย</li>
                                    <li>รองรับตัวเขียนมือได้ (พิมพ์ + เขียนมือ)</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* ── CAMERA ── */}
                    {mode === 'camera' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
                                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => { stopCamera(); setMode('choose') }} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>← กลับ</button>
                                <button onClick={captureAndScan} style={{ flex: 2, padding: '0.6rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.95rem' }}>📸 ถ่ายและสแกน</button>
                            </div>
                        </div>
                    )}

                    {/* ── SCANNING ── */}
                    {mode === 'scanning' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: 16 }}>
                            <div style={{ width: 52, height: 52, border: '4px solid #E9D8FD', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1.05rem' }}>🤖 AI กำลังอ่านใบนับ...</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ใช้เวลาประมาณ 5-15 วินาที</div>
                        </div>
                    )}

                    {/* ── REVIEW ── */}
                    {mode === 'review' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* Select all bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <button onClick={() => setSelected(new Set(scanned.map((_, i) => i)))}
                                    style={{ fontSize: '0.76rem', background: 'none', border: 'none', color: '#7C3AED', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>
                                    ☑ เลือกทั้งหมด
                                </button>
                                <button onClick={() => setSelected(new Set())}
                                    style={{ fontSize: '0.76rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                                    ยกเลิกทั้งหมด
                                </button>
                            </div>

                            {scanned.map((row, i) => {
                                const isSelected = selected.has(i)
                                const prodId = editProduct[i] ?? row.productId
                                const qty = editQty[i] ?? row.qty
                                const displayProd = products.find(p => p.id === prodId)
                                return (
                                    <div key={i} style={{
                                        borderRadius: 10, border: `1px solid ${isSelected ? (row.matched ? '#86EFAC' : '#FCD34D') : 'var(--border)'}`,
                                        background: isSelected ? (row.matched ? 'rgba(134,239,172,0.08)' : 'rgba(252,211,77,0.08)') : 'var(--bg)',
                                        padding: '0.6rem 0.75rem', transition: 'all 0.15s',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            {/* Checkbox */}
                                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(i)}
                                                style={{ marginTop: 4, accentColor: '#7C3AED', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {/* Raw name from AI */}
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                                                    AI อ่านได้: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{row.rawName}</span>
                                                    {row.unit && <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>({row.unit})</span>}
                                                </div>
                                                {/* Product match */}
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <select
                                                        value={prodId || ''}
                                                        onChange={e => setEditProduct(prev => ({ ...prev, [i]: e.target.value }))}
                                                        style={{
                                                            flex: 1, minWidth: 180, padding: '4px 8px', borderRadius: 7,
                                                            border: `1px solid ${prodId ? '#86EFAC' : '#FCD34D'}`,
                                                            background: 'var(--white)', fontSize: '0.78rem', fontFamily: 'inherit',
                                                            color: 'var(--text)', cursor: 'pointer',
                                                        }}>
                                                        <option value="">— เลือกสินค้า —</option>
                                                        {products.map(p => <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>)}
                                                    </select>
                                                    {/* Qty input */}
                                                    <input
                                                        type="number" min={0} step={0.1}
                                                        value={qty}
                                                        onChange={e => setEditQty(prev => ({ ...prev, [i]: parseFloat(e.target.value) || 0 }))}
                                                        style={{
                                                            width: 90, padding: '4px 8px', borderRadius: 7,
                                                            border: '1px solid var(--border)', textAlign: 'right',
                                                            fontWeight: 700, color: 'var(--accent)', fontSize: '0.88rem', fontFamily: 'inherit',
                                                        }} />
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                        {displayProd?.unit || row.unit || ''}
                                                    </span>
                                                </div>
                                                {!row.matched && (
                                                    <div style={{ fontSize: '0.68rem', color: '#D97706', marginTop: 3, fontWeight: 600 }}>
                                                        ⚠ ไม่พบสินค้าในระบบ — กรุณาเลือกให้ถูกต้อง
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {mode === 'review' && (
                    <div style={{ padding: '0.875rem 1.2rem', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
                        <button onClick={() => setMode('choose')} style={{ flex: 1, padding: '0.6rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>🔄 สแกนใหม่</button>
                        <button onClick={handleImport} style={{ flex: 2, padding: '0.6rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem' }}>
                            ✅ นำเข้า {selected.size} รายการ
                        </button>
                    </div>
                )}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
