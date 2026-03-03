'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const sysInfo = [
    { label: 'Framework', value: 'Next.js 14', icon: '⚡' },
    { label: 'Database', value: 'MySQL 9', icon: '🗄️' },
    { label: 'ORM', value: 'Prisma 5', icon: '🔷' },
    { label: 'Currency', value: 'LAK (ກີບ)', icon: '💱' },
    { label: 'Font', value: 'Noto Sans Lao/Thai', icon: '🔤' },
    { label: 'Version', value: 'v1.0.0', icon: '🏷️' },
]

const POS_PROVIDERS = [
    { id: 'none', name: '— ไม่ใช้ POS Integration —', icon: '❌' },
    { id: 'loyverse', name: 'Loyverse POS', icon: '🟠', apiBase: 'https://api.loyverse.com/v1.0', docsUrl: 'https://developer.loyverse.com/docs/' },
    { id: 'square', name: 'Square POS', icon: '⬛', apiBase: 'https://connect.squareup.com/v2', docsUrl: 'https://developer.squareup.com/docs' },
    { id: 'custom', name: 'Custom API (อื่นๆ)', icon: '🔧', apiBase: '' },
]

const SYNC_INTERVALS = [
    { value: 5, label: 'ทุก 5 นาที' },
    { value: 15, label: 'ทุก 15 นาที' },
    { value: 30, label: 'ทุก 30 นาที' },
    { value: 60, label: 'ทุก 1 ชั่วโมง' },
    { value: 0, label: 'ปิด auto-sync' },
]

interface PosConfig {
    provider: string; apiUrl: string; apiKey: string; storeId: string
    intervalMin: number; enabled: boolean; lastSync: string | null
}

const defaultConfig: PosConfig = {
    provider: 'none', apiUrl: '', apiKey: '', storeId: '',
    intervalMin: 15, enabled: false, lastSync: null,
}

// ─── Reset Test Modal ──────────────────────────────────────────────────────
function ResetTestModal({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState<'confirm' | 'running' | 'done'>('confirm')
    const [result, setResult] = useState<Record<string, number> | null>(null)
    const [typed, setTyped] = useState('')
    const CONFIRM_WORD = 'RESET'

    async function doReset() {
        setStep('running')
        try {
            const res = await fetch('/api/system/reset-test', { method: 'POST' })
            const json = await res.json()
            if (json.success) { setResult(json.data); setStep('done') }
            else { toast.error(json.error || 'รีเซ็ตไม่สำเร็จ'); setStep('confirm') }
        } catch { toast.error('เกิดข้อผิดพลาด'); setStep('confirm') }
    }

    const willClear = [
        { icon: '📦', label: 'การเคลื่อนไหวสต็อค', key: 'movements' },
        { icon: '🧾', label: 'คำสั่งซื้อ POS', key: 'orders' },
        { icon: '📊', label: 'ยอดสต็อค → 0', key: 'inventoryReset' },
    ]

    const willKeep = ['🥩 สินค้า / วัตถุดิบ', '🏷️ หมวดหมู่', '👤 บัญชีผู้ใช้', '📋 สูตรอาหาร (BOM)', '📍 คลังสินค้า']

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}
            onClick={step === 'running' ? undefined : onClose}>
            <div style={{ background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ height: 4, background: step === 'done' ? '#16a34a' : '#DC2626' }} />
                <div style={{ padding: '1.25rem 1.5rem' }}>

                    {step === 'confirm' && (<>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <span style={{ fontSize: '1.8rem' }}>🧹</span>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#DC2626' }}>รีเซ็ตข้อมูลทดสอบ</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>ล้างธุรกรรมทั้งหมด — ยังคง master data ไว้</div>
                            </div>
                        </div>

                        <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', marginBottom: 10, border: '1px solid #FECACA' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#DC2626', marginBottom: 6 }}>❌ จะถูกลบ</div>
                            {willClear.map(w => <div key={w.key} style={{ fontSize: '0.78rem', color: '#7F1D1D', marginBottom: 3 }}>{w.icon} {w.label}</div>)}
                        </div>

                        <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '10px 14px', marginBottom: 14, border: '1px solid #BBF7D0' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', marginBottom: 6 }}>✅ ยังคงไว้</div>
                            {willKeep.map(w => <div key={w} style={{ fontSize: '0.78rem', color: '#065F46', marginBottom: 3 }}>{w}</div>)}
                        </div>

                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
                                พิมพ์ <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, color: '#DC2626', fontWeight: 700 }}>{CONFIRM_WORD}</code> เพื่อยืนยัน
                            </label>
                            <input value={typed} onChange={e => setTyped(e.target.value.toUpperCase())}
                                placeholder="พิมพ์ RESET" className="input" autoFocus
                                style={{ letterSpacing: '0.1em', fontWeight: 700, textAlign: 'center', fontSize: '1rem' }} />
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={onClose} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>ยกเลิก</button>
                            <button onClick={doReset} disabled={typed !== CONFIRM_WORD}
                                style={{ flex: 2, minHeight: 44, borderRadius: 12, border: 'none', background: typed === CONFIRM_WORD ? '#DC2626' : '#9CA3AF', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: typed === CONFIRM_WORD ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                                🧹 รีเซ็ตเดี๋ยวนี้
                            </button>
                        </div>
                    </>)}

                    {step === 'running' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', gap: 14 }}>
                            <div style={{ width: 44, height: 44, border: '4px solid #FCA5A5', borderTopColor: '#DC2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            <div style={{ fontWeight: 700, color: '#DC2626' }}>กำลังรีเซ็ต...</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>กรุณารอสักครู่</div>
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div>
                            <div style={{ textAlign: 'center', padding: '1rem 0', marginBottom: 14 }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>✅</div>
                                <div style={{ fontWeight: 800, color: '#16a34a', fontSize: '1rem' }}>รีเซ็ตสำเร็จ!</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>ระบบพร้อมสำหรับการทดสอบรอบใหม่</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
                                {willClear.map(w => (
                                    <div key={w.key} style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16a34a' }}>{result[w.key] ?? 0}</div>
                                        <div style={{ fontSize: '0.62rem', color: '#047857', fontWeight: 600, marginTop: 2 }}>{w.icon} {w.label}</div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={onClose} style={{ width: '100%', minHeight: 44, borderRadius: 12, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                                เสร็จสิ้น
                            </button>
                        </div>
                    )}
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    )
}

// ─── Main Settings Page ────────────────────────────────────────────────────
export default function SettingsPage() {
    useRoleGuard(['owner'])
    const [posConfig, setPosConfig] = useState<PosConfig>(defaultConfig)
    const [showKey, setShowKey] = useState(false)
    const [testing, setTesting] = useState(false)
    const [showReset, setShowReset] = useState(false)

    useEffect(() => {
        try {
            const saved = localStorage.getItem('pos_integration_config')
            if (saved) setPosConfig(JSON.parse(saved))
        } catch { /* ignore */ }
    }, [])

    function saveConfig(cfg: PosConfig) { localStorage.setItem('pos_integration_config', JSON.stringify(cfg)); setPosConfig(cfg) }
    function handleProviderChange(id: string) {
        const provider = POS_PROVIDERS.find(p => p.id === id)
        saveConfig({ ...posConfig, provider: id, apiUrl: (provider && 'apiBase' in provider ? provider.apiBase : '') || '' })
    }
    async function handleTestConnection() {
        if (!posConfig.apiKey) return toast.error('กรุณาใส่ API Key ก่อน')
        if (!posConfig.apiUrl) return toast.error('กรุณาระบุ API URL')
        setTesting(true)
        try {
            const res = await fetch('/api/pos-integration/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: posConfig.provider, apiUrl: posConfig.apiUrl, apiKey: posConfig.apiKey }) })
            if (res.ok) {
                const json = await res.json()
                if (json.success) { toast.success(`✅ เชื่อมต่อสำเร็จ: ${json.data?.name || posConfig.provider}`); saveConfig({ ...posConfig, lastSync: new Date().toISOString() }) }
                else toast.error(`❌ ${json.error || 'เชื่อมต่อไม่ได้'}`)
            } else toast.error('❌ API ยังไม่พร้อม — บันทึกการตั้งค่าไว้ก่อนได้เลย')
        } catch { toast('💾 บันทึกการตั้งค่าไว้แล้ว — API endpoint ยังไม่ได้สร้าง', { icon: 'ℹ️' }) }
        finally { setTesting(false) }
    }
    function handleSavePosConfig() { localStorage.setItem('pos_integration_config', JSON.stringify(posConfig)); toast.success('💾 บันทึกการตั้งค่า POS Integration แล้ว') }

    const selectedProvider = POS_PROVIDERS.find(p => p.id === posConfig.provider)

    return (
        <div className="page-container" style={{ maxWidth: 860 }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">⚙️ ตั้งค่าระบบ</h1>
                    <p className="page-subtitle">จัดการข้อมูลร้านและการตั้งค่าระบบ</p>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* ── Store Info ── */}
                <div className="card">
                    <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 16, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}><span>🏪</span> ข้อมูลร้าน</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div><label className="label">ชื่อร้าน</label><input defaultValue="43 Garden Cafe & Restaurant" className="input" /></div>
                        <div><label className="label">สกุลเงิน</label><input defaultValue="LAK (ກີບລາວ)" className="input" disabled style={{ opacity: 0.5 }} /></div>
                        <div><label className="label">โซนเวลา</label><input defaultValue="Asia/Vientiane (UTC+7)" className="input" disabled style={{ opacity: 0.5 }} /></div>
                        <div><label className="label">ภาษา</label><input defaultValue="ລາວ / ไทย (Bilingual)" className="input" disabled style={{ opacity: 0.5 }} /></div>
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>💾 บันทึก</button>
                    </div>
                </div>

                {/* ── POS Integration ── */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                        <div>
                            <h2 style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span>🔗</span> POS Integration</h2>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>เชื่อมต่อระบบ POS เพื่อดึงยอดขายและหักสต็อคอัตโนมัติ</p>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
                            <div onClick={() => saveConfig({ ...posConfig, enabled: !posConfig.enabled })}
                                style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: posConfig.enabled ? 'var(--accent)' : 'var(--border)', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: 3, transition: 'left 0.2s', left: posConfig.enabled ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                            </div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: posConfig.enabled ? 'var(--accent)' : 'var(--text-muted)' }}>{posConfig.enabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}</span>
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label className="label">🏷️ ระบบ POS</label>
                            <select value={posConfig.provider} onChange={e => handleProviderChange(e.target.value)} className="input">
                                {POS_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
                            </select>
                        </div>

                        {posConfig.provider !== 'none' && (<>
                            <div style={{ gridColumn: '1/-1' }}>
                                <label className="label">🌐 API Base URL
                                    {selectedProvider && 'docsUrl' in selectedProvider && selectedProvider.docsUrl && (
                                        <a href={selectedProvider.docsUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--accent)', textDecoration: 'none' }}>📄 ดู Docs</a>
                                    )}
                                </label>
                                <input value={posConfig.apiUrl} onChange={e => setPosConfig({ ...posConfig, apiUrl: e.target.value })} className="input" placeholder="https://api.loyverse.com/v1.0" />
                            </div>
                            <div>
                                <label className="label">🔑 API Key / Access Token</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showKey ? 'text' : 'password'} value={posConfig.apiKey} onChange={e => setPosConfig({ ...posConfig, apiKey: e.target.value })} className="input" placeholder="••••••••" style={{ paddingRight: 40 }} />
                                    <button onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }}>{showKey ? '🙈' : '👁️'}</button>
                                </div>
                            </div>
                            <div>
                                <label className="label">🏪 Store ID</label>
                                <input value={posConfig.storeId} onChange={e => setPosConfig({ ...posConfig, storeId: e.target.value })} className="input" placeholder="ปล่อยว่างเพื่อดึงทุกสาขา" />
                            </div>
                            <div>
                                <label className="label">⏱️ Auto-sync ทุก</label>
                                <select value={posConfig.intervalMin} onChange={e => saveConfig({ ...posConfig, intervalMin: parseInt(e.target.value) })} className="input">
                                    {SYNC_INTERVALS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>
                            <div style={{ gridColumn: '1/-1' }}>
                                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '0.75rem 1rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>สถานะการซิงค์ล่าสุด</p>
                                        <p style={{ fontWeight: 600, fontSize: '0.85rem', color: posConfig.lastSync ? '#16a34a' : 'var(--text-muted)' }}>
                                            {posConfig.lastSync ? `✅ ${new Date(posConfig.lastSync).toLocaleString('th-TH')}` : '⚪ ยังไม่เคยซิงค์'}
                                        </p>
                                    </div>
                                    <button onClick={handleTestConnection} disabled={testing} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
                                        {testing ? '⏳ กำลังทดสอบ...' : '🔌 ทดสอบการเชื่อมต่อ'}
                                    </button>
                                </div>
                            </div>
                        </>)}
                    </div>

                    {posConfig.provider !== 'none' && (
                        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button onClick={() => { saveConfig(defaultConfig); toast('🔄 รีเซ็ตการตั้งค่าแล้ว', { icon: 'ℹ️' }) }} className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>🗑️ รีเซ็ต</button>
                            <button onClick={handleSavePosConfig} className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>💾 บันทึกการตั้งค่า</button>
                        </div>
                    )}
                </div>

                {/* ── System Info ── */}
                <div className="card">
                    <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 16, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}><span>🖥️</span> ข้อมูลระบบ</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {sysInfo.map(s => (
                            <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '0.875rem', border: '1px solid var(--border)' }}>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'monospace' }}>{s.icon} {s.label}</p>
                                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>{s.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Credentials ── */}
                <div className="card">
                    <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 16, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}><span>🔑</span> รหัสผ่านเริ่มต้น (จาก seed)</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {[
                            { user: 'owner', pass: 'owner1234', role: 'OWNER', icon: '👑' },
                            { user: 'manager', pass: 'manager1234', role: 'MANAGER', icon: '🏢' },
                            { user: 'warehouse', pass: 'staff1234', role: 'WAREHOUSE', icon: '📦' },
                            { user: 'kitchen', pass: 'staff1234', role: 'KITCHEN', icon: '👨‍🍳' },
                            { user: 'bar', pass: 'staff1234', role: 'BAR', icon: '🍹' },
                            { user: 'cashier', pass: 'staff1234', role: 'CASHIER', icon: '💳' },
                        ].map(u => (
                            <div key={u.user} style={{ background: 'var(--bg)', borderRadius: 10, padding: '0.75rem', border: '1px solid var(--border)' }}>
                                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', marginBottom: 2 }}>{u.icon} {u.user}</p>
                                <p style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--accent)' }}>{u.pass}</p>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{u.role}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Danger Zone ── */}
                <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '1.5rem' }}>
                    <h2 style={{ fontWeight: 700, color: '#DC2626', marginBottom: 4, fontSize: '0.95rem' }}>⚠️ Danger Zone</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>การกระทำเหล่านี้ไม่สามารถย้อนกลับได้</p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'var(--white)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)' }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', marginBottom: 2 }}>🧹 รีเซ็ตข้อมูลทดสอบ</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ล้าง: ประวัติสต็อค, คำสั่งซื้อ, ยอดคงเหลือ &mdash; เก็บ: สินค้า, สูตร, ผู้ใช้</div>
                        </div>
                        <button
                            onClick={() => setShowReset(true)}
                            style={{
                                background: 'transparent', border: '1.5px solid rgba(220,38,38,0.5)',
                                color: '#DC2626', padding: '0.5rem 1.25rem', borderRadius: 10,
                                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700,
                                whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12, transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#DC2626' }}
                        >🧹 รีเซ็ต</button>
                    </div>
                </div>

            </div>

            {showReset && <ResetTestModal onClose={() => setShowReset(false)} />}
        </div>
    )
}
