// @ts-nocheck
// fix-encoding.js — run AFTER: git restore --source=592a282 "src/app/(dashboard)/products/page.tsx"
const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'src/app/(dashboard)/products/page.tsx')

// Read with explicit UTF-8
let content = fs.readFileSync(filePath, 'utf8')

console.log('Lines before patch:', content.split('\n').length)
console.log('Has ImportRawModal state:', content.includes('showImportRaw'))

// 1. Add showImportRaw state if missing
if (!content.includes('showImportRaw')) {
    content = content.replace(
        `const [photoProduct, setPhotoProduct] = useState<Product | null>(null)`,
        `const [photoProduct, setPhotoProduct] = useState<Product | null>(null)\n    const [showImportRaw, setShowImportRaw] = useState(false)`
    )
    console.log('✓ Added showImportRaw state')
}

// 2. Add Import button if missing
if (!content.includes('setShowImportRaw(true)')) {
    content = content.replace(
        `<button onClick={() => { setEditProduct(null); setShowForm(true) }} className="btn-primary"`,
        `{/* Import Button */}
                    <button
                        onClick={() => setShowImportRaw(true)}
                        style={{
                            minHeight: 44, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                            padding: '0.5rem 1rem', borderRadius: 10, cursor: 'pointer',
                            background: '#fff', border: '1.5px solid var(--accent)',
                            color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F0FDF4')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >
                        📂 Import Excel
                    </button>
                    <button onClick={() => { setEditProduct(null); setShowForm(true) }} className="btn-primary"`
    )
    console.log('✓ Added Import button')
}

// 3. Add ImportRawModal render before </style> tag
if (!content.includes('<ImportRawModal')) {
    content = content.replace(
        `            <style>{\`@keyframes spin { to { transform: rotate(360deg); } }\`}</style>`,
        `            {showImportRaw && (
                <ImportRawModal
                    onClose={() => setShowImportRaw(false)}
                    onDone={() => { setShowImportRaw(false); fetchProducts() }}
                />
            )}

            <style>{\`@keyframes spin { to { transform: rotate(360deg); } }\`}</style>`
    )
    console.log('✓ Added ImportRawModal render')
}

// 4. Add ImportRawModal component if missing
if (!content.includes('function ImportRawModal')) {
    const modalCode = `
// ─── Import Raw Materials Modal ───────────────────────────────────────────────
type RawImportResult = { row: number; status: 'created' | 'skipped' | 'error'; name: string; category?: string; guessed?: boolean; reason?: string }
type RawImportSummary = { created: number; skipped: number; errors: number; autoMatched: number; total: number; results: RawImportResult[] }

function ImportRawModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [dragging, setDragging] = useState(false)
    const [importing, setImporting] = useState(false)
    const [summary, setSummary] = useState<RawImportSummary | null>(null)
    const [importError, setImportError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFile = (f: File) => {
        if (!f.name.match(/\\.(xlsx|xls)$/i)) { setImportError('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls)'); return }
        setFile(f); setImportError(null); setSummary(null)
    }
    const onFilePick = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }
    const onDropFile = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); setDragging(false)
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
    }

    const doImport = async () => {
        if (!file) return
        setImporting(true); setImportError(null)
        const fd = new FormData(); fd.append('file', file)
        try {
            const res = await fetch('/api/products/import-raw', { method: 'POST', body: fd })
            const json = await res.json()
            if (json.success) { setSummary(json.data); toast.success(\`✅ Import สำเร็จ \${json.data.created} รายการ\`) }
            else setImportError(json.error || 'Import ไม่สำเร็จ')
        } catch { setImportError('เกิดข้อผิดพลาดในการ Import') }
        finally { setImporting(false) }
    }

    const downloadTemplate = () => {
        const rows = [
            ['ชื่อวัตถุดิบ', 'หน่วย', 'ต้นทุน', 'หน่วยรอง', 'ค่าแปลง', 'หมายเหตุ'],
            ['อกไก่สด', 'กก.', 85000, '', '', ''],
            ['หมูสับ', 'กก.', 60000, '', '', ''],
            ['กุ้งขาว', 'กก.', 120000, '', '', ''],
            ['ซอสหอยนางรม', 'ลิตร', 30000, '', '', ''],
            ['ถุงพลาสติก 500g', 'ถุง', 1500, '', '', ''],
        ]
        const csv = rows.map(r => r.map(v => \`"\${v}"\`).join(',')).join('\\n')
        const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
        a.download = 'template-rawmaterial-import.csv'; a.click()
    }

    const statusIcon = (s: string) => s === 'created' ? '✅' : s === 'skipped' ? '⏭️' : '❌'
    const statusColor = (s: string) => s === 'created' ? '#059669' : s === 'skipped' ? '#D97706' : '#DC2626'

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: '1rem', backdropFilter: 'blur(5px)',
        }} onClick={onClose}>
            <div style={{
                background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 560,
                maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ height: 4, background: 'linear-gradient(135deg,var(--accent),#10B981)', borderRadius: '20px 20px 0 0' }} />

                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent)' }}>📂 Import วัตถุดิบจาก Excel</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>สต็อกเริ่มต้นที่ 0 — นับทีหลังใน Stock Count</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'var(--bg)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }}>✕</button>
                </div>

                <div style={{ padding: '1.25rem' }}>
                    <div style={{
                        background: '#F0FDF4', borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        border: '1px solid #BBF7D0',
                    }}>
                        <span style={{ fontSize: '0.78rem', color: '#065F46', fontWeight: 500 }}>📋 ดาวน์โหลด template สำหรับกรอกข้อมูล</span>
                        <button onClick={downloadTemplate} style={{
                            padding: '5px 12px', borderRadius: 8, border: '1px solid #10B981', flexShrink: 0,
                            background: '#fff', color: '#059669', fontWeight: 700,
                            fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                        }}>⬇ Template</button>
                    </div>

                    <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                        <strong style={{ color: 'var(--text)' }}>คอลัมน์:</strong>{' '}
                        <span style={{ color: '#DC2626' }}>ชื่อวัตถุดิบ*</span>, หน่วย, ต้นทุน, หน่วยรอง, ค่าแปลง, หมายเหตุ
                        <br />
                        <span style={{ color: '#059669' }}>✔ หมวดหมู่จะถูก detect อัตโนมัติ จากชื่อวัตถุดิบ</span>
                    </div>

                    {!summary && (
                        <div
                            onDragOver={e => { e.preventDefault(); setDragging(true) }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={onDropFile}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: \`2.5px dashed \${dragging ? '#10B981' : file ? '#10B981' : '#BBF7D0'}\`,
                                borderRadius: 16, padding: '2rem 1.25rem', textAlign: 'center',
                                background: dragging || file ? '#F0FDF4' : 'var(--bg)',
                                cursor: 'pointer', transition: 'all 0.18s', marginBottom: 12,
                            }}
                        >
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFilePick} />
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{file ? '📄' : '📁'}</div>
                            {file ? (
                                <>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#059669' }}>{file.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB — คลิกเพื่อเปลี่ยนไฟล์</div>
                                </>
                            ) : (
                                <>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>รองรับ .xlsx และ .xls</div>
                                </>
                            )}
                        </div>
                    )}

                    {importError && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: '0.82rem', fontWeight: 500, marginBottom: 12 }}>❌ {importError}</div>
                    )}

                    {summary && (
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                                {[
                                    { label: 'เพิ่มแล้ว', value: summary.created, color: '#059669', bg: '#F0FDF4', border: '#A7F3D0' },
                                    { label: '🤖 Auto', value: summary.autoMatched, color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
                                    { label: 'ข้าม (ซ้ำ)', value: summary.skipped, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                                    { label: 'ผิดพลาด', value: summary.errors, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                                ].map(s => (
                                    <div key={s.label} style={{ background: s.bg, border: \`1px solid \${s.border}\`, borderRadius: 10, padding: '8px 0', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                                        <div style={{ fontSize: '0.62rem', color: s.color, fontWeight: 600, padding: '0 4px' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                                {summary.results.map((r, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
                                        borderBottom: '1px solid var(--border-light)',
                                        background: i % 2 === 0 ? 'var(--white)' : 'var(--bg)',
                                    }}>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 28, flexShrink: 0 }}>#{r.row}</span>
                                        <span>{statusIcon(r.status)}</span>
                                        <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                        {r.status === 'created' && r.category && (
                                            <span style={{
                                                fontSize: '0.65rem', flexShrink: 0,
                                                background: r.guessed ? '#EEF2FF' : '#F0FDF4',
                                                color: r.guessed ? '#6366F1' : '#059669',
                                                border: \`1px solid \${r.guessed ? '#C7D2FE' : '#A7F3D0'}\`,
                                                borderRadius: 6, padding: '2px 6px', fontWeight: 700,
                                                maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>{r.guessed ? '🤖 ' : ''}{r.category}</span>
                                        )}
                                        {r.reason && <span style={{ fontSize: '0.68rem', color: statusColor(r.status), flexShrink: 0, maxWidth: 130, textAlign: 'right' }}>{r.reason}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={summary ? onDone : onClose} style={{
                            flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid var(--border)',
                            background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit',
                            fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)',
                        }}>ยิง</button>
                        {!summary && (
                            <button onClick={doImport} disabled={!file || importing} style={{
                                flex: 2, minHeight: 44, borderRadius: 12, border: 'none',
                                background: !file || importing ? '#9CA3AF' : 'linear-gradient(135deg,var(--accent),#10B981)',
                                color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                                cursor: !file || importing ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                                boxShadow: !file || importing ? 'none' : '0 4px 14px rgba(5,150,105,0.35)',
                            }}>
                                {importing ? '⏳ กำลัง Import...' : '📂 เริ่ม Import'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
`
    content = content + modalCode
    console.log('✓ Added ImportRawModal component')
}

// Write back with UTF-8 (no BOM)
fs.writeFileSync(filePath, content, 'utf8')
console.log('Lines after patch:', content.split('\n').length)
console.log('Final checks:')
console.log('  showImportRaw state  :', content.includes('showImportRaw') ? '✓' : '✗')
console.log('  Import button        :', content.includes('setShowImportRaw(true)') ? '✓' : '✗')
console.log('  ImportRawModal render:', content.includes('<ImportRawModal') ? '✓' : '✗')
console.log('  ImportRawModal func  :', content.includes('function ImportRawModal') ? '✓' : '✗')
console.log('\n✅ Done! File written with UTF-8 encoding.')
