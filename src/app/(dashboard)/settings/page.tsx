'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { usePermission } from '@/hooks/usePermission'
import { useStoreBranding, clearStoreBrandingCache } from '@/hooks/useStoreBranding'
import { useTenant } from '@/context/TenantContext'
import { getPrinterSettings, setPrinterSettings, type PrinterSettings } from '@/lib/printerSettings'

// ─── Store Branding Card ─────────────────────────────────────
function StoreBrandingCard() {
    const canManage = usePermission('SETTINGS_MANAGE')
    const branding = useStoreBranding()
    const [name, setName] = useState('')
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setName(branding.displayName)
        setPreview(branding.logoUrl)
    }, [branding.displayName, branding.logoUrl])

    async function saveName() {
        if (!name.trim()) return
        setSaving(true)
        const res = await fetch('/api/settings/store', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: name.trim() }),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            clearStoreBrandingCache()
            toast.success('✅ บันทึกชื่อร้านแล้ว')
        } else toast.error(d.error || 'เกิดข้อผิดพลาด')
    }

    async function handleLogoFile(file: File) {
        if (!file) return
        // Show preview
        const url = URL.createObjectURL(file)
        setPreview(url)
        // Upload
        setUploading(true)
        const fd = new FormData()
        fd.append('logo', file)
        const res = await fetch('/api/settings/store/logo', { method: 'POST', body: fd })
        const d = await res.json()
        setUploading(false)
        if (d.success) {
            clearStoreBrandingCache()
            setPreview(d.data.logoUrl + '?t=' + Date.now()) // cache-bust
            toast.success('✅ อัปโหลดโลโก้สำเร็จ')
        } else toast.error(d.error || 'อัปโหลดไม่สำเร็จ')
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f) handleLogoFile(f)
    }

    if (!canManage) return null

    return (
        <div className="card" style={{ borderColor: 'rgba(232,54,78,0.2)', background: 'rgba(232,54,78,0.02)' }}>
            <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🏡</span> Brand ชื่อร้าน & โลโก้
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>ชื่อและโลโก้จะแสดงใน Sidebar และหน้า login</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>
                {/* Logo upload zone */}
                <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>🖼️ โลโก้ร้าน</p>
                    <div
                        onClick={() => fileRef.current?.click()}
                        onDrop={onDrop}
                        onDragOver={e => e.preventDefault()}
                        style={{
                            width: 100, height: 100, borderRadius: 16,
                            border: '2px dashed var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', overflow: 'hidden', position: 'relative',
                            background: 'var(--bg)', transition: 'border-color 0.2s',
                        }}
                    >
                        {uploading ? (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>⏳<br />อัปโหลด...</div>
                        ) : preview ? (
                            <img src={preview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '0.5rem' }}>
                                <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>🖼️</div>
                                คลิก/ลากวาง
                            </div>
                        )}
                        {preview && !uploading && (
                            <div style={{
                                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: 0, transition: 'opacity 0.2s, background 0.2s',
                                fontSize: '1.2rem',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(0,0,0,0.4)' }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.background = 'rgba(0,0,0,0)' }}
                            >🔄
                            </div>
                        )}
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }}
                    />
                    <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 6, maxWidth: 100 }}>JPG/PNG/WEBP max 5MB</p>
                </div>

                {/* Store name */}
                <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>🏠 ชื่อร้าน (แสดงใน UI)</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveName()}
                            placeholder="ชื่อร้านของคุณ..."
                            className="input"
                            maxLength={100}
                            style={{ flex: 1 }}
                        />
                        <button
                            onClick={saveName}
                            disabled={saving || !name.trim()}
                            className="btn-primary"
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                        >
                            {saving ? '⏳...' : '💾 บันทึก'}
                        </button>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
                        ชื่อปัจจุบัน: <strong>{branding.displayName}</strong>
                    </p>
                    {preview && (
                        <button
                            onClick={async () => {
                                const res = await fetch('/api/settings/store', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ logoUrl: null }),
                                })
                                const d = await res.json()
                                if (d.success) { clearStoreBrandingCache(); setPreview(null); toast.success('ลบโลโก้แล้ว') }
                            }}
                            style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            🗑️ ลบโลโก้
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Menu Banner Card ─────────────────────────────────────────
function MenuBannerCard() {
    const canManage = usePermission('SETTINGS_MANAGE')
    const [bannerPreview, setBannerPreview] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetch('/api/tenant/settings')
            .then(r => r.json())
            .then(d => {
                if (d.settings?.menuBannerBase64) {
                    setBannerPreview(`data:image/jpeg;base64,${d.settings.menuBannerBase64}`)
                }
                setLoaded(true)
            })
    }, [])

    async function handleBannerFile(file: File) {
        if (!file) return
        if (file.size > 10 * 1024 * 1024) { toast.error('ไฟล์ใหญ่เกิน 10MB'); return }
        // Show local preview instantly
        const reader = new FileReader()
        reader.onload = (e) => { if (e.target?.result) setBannerPreview(e.target.result as string) }
        reader.readAsDataURL(file)
        setUploading(true)
        try {
            // ─── Canvas compress: resize to max 1200px, JPEG 0.82 quality ──────────
            const base64 = await new Promise<string>((resolve, reject) => {
                const img = new Image()
                img.onload = () => {
                    const MAX_W = 1200
                    const scale = img.width > MAX_W ? MAX_W / img.width : 1
                    const w = Math.round(img.width * scale)
                    const h = Math.round(img.height * scale)
                    const canvas = document.createElement('canvas')
                    canvas.width = w; canvas.height = h
                    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
                    // Extract raw base64 (strip data URI prefix)
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
                    resolve(dataUrl.split(',')[1])
                }
                img.onerror = reject
                img.src = URL.createObjectURL(file)
            })
            // ─── Save to DB via PATCH ───────────────────────────────────────────────
            const res = await fetch('/api/tenant/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menuBannerBase64: base64 }),
            })
            const d = await res.json()
            if (d.success) {
                toast.success('✅ บันทึก Banner แล้ว')
            } else toast.error(d.error || 'อัปโหลดไม่สำเร็จ')
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setUploading(false) }
    }

    async function deleteBanner() {
        const res = await fetch('/api/tenant/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menuBannerBase64: null }),
        })
        const d = await res.json()
        if (d.success) { setBannerPreview(null); toast.success('ลบ Banner แล้ว') }
        else toast.error(d.error || 'เกิดข้อผิดพลาด')
    }

    if (!canManage) return null

    return (
        <div className="card" style={{ borderColor: 'rgba(42,157,80,0.25)', background: 'rgba(42,157,80,0.02)' }}>
            <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🖼️</span> รูป Banner หน้าสั่งอาหาร (QR Menu)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
                รูปนี้จะแสดงที่ด้านบนของหน้าสแกน QR สั่งอาหาร — JPG/PNG/WEBP max 5MB
            </p>

            {/* Banner Upload Zone — Wide 16:9 */}
            <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleBannerFile(f) }}
                onDragOver={e => e.preventDefault()}
                style={{
                    width: '100%', aspectRatio: '16/5',
                    borderRadius: 14,
                    border: bannerPreview ? '2px solid rgba(42,157,80,0.4)' : '2.5px dashed var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: uploading ? 'wait' : 'pointer',
                    overflow: 'hidden', position: 'relative',
                    background: bannerPreview ? '#000' : 'var(--bg)',
                    transition: 'border-color 0.2s',
                    minHeight: 100,
                }}
            >
                {uploading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid rgba(42,157,80,0.2)', borderTopColor: '#2a9d50', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>กำลังบันทึก...</span>
                    </div>
                ) : bannerPreview ? (
                    <>
                        <img src={bannerPreview} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, display: 'block' }} />
                        {/* Hover overlay */}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'all 0.2s', fontSize: '1rem', color: '#fff', fontWeight: 700, gap: 6 }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.background = 'rgba(0,0,0,0)' }}>
                            🔄 เปลี่ยนรูป
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 6 }}>🖼️</div>
                        <p style={{ fontWeight: 600, fontSize: '0.88rem', margin: '0 0 4px' }}>แตะเพื่ออัปโหลดรูป Banner</p>
                        <p style={{ fontSize: '0.72rem', margin: 0 }}>คลิก/ลากวาง — แนะนำ: ขนาดกว้าง เช่น 1200×400px</p>
                    </div>
                )}
            </div>

            <input
                ref={fileRef} type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerFile(f); e.target.value = '' }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    style={{ flex: 1, minWidth: 140, minHeight: 44, borderRadius: 12, border: 'none', background: uploading ? '#d1d5db' : '#2a9d50', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {uploading ? '⏳ กำลังบันทึก...' : '📷 เลือกรูป Banner'}
                </button>
                {bannerPreview && !uploading && (
                    <button
                        onClick={deleteBanner}
                        style={{ minHeight: 44, borderRadius: 12, border: '1.5px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 5 }}>
                        🗑️ ลบรูป
                    </button>
                )}
            </div>

            {bannerPreview && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    ✅ มีรูป Banner อยู่แล้ว — คลิกรูปหรือปุ่มด้านบนเพื่อเปลี่ยน
                </p>
            )}
            {!loaded && !bannerPreview && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>⏳ กำลังโหลด...</p>
            )}
        </div>
    )
}



// ─── QR Banking Card ──────────────────────────────────────────
function QrBankingCard() {
    const canManage = usePermission('SETTINGS_MANAGE')
    const [preview, setPreview] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetch('/api/tenant/settings')
            .then(r => r.json())
            .then(d => {
                if (d.settings?.qrBankingBase64) {
                    setPreview(`data:image/jpeg;base64,${d.settings.qrBankingBase64}`)
                }
                setLoaded(true)
            })
    }, [])

    async function handleFile(file: File) {
        if (!file) return
        if (file.size > 5 * 1024 * 1024) { toast.error('ไฟล์ใหญ่เกิน 5MB'); return }
        // Show local preview
        const reader = new FileReader()
        reader.onload = (e) => { if (e.target?.result) setPreview(e.target.result as string) }
        reader.readAsDataURL(file)
        setUploading(true)
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const img = new Image()
                img.onload = () => {
                    // Resize to max 800px width (QR banking ไม่ต้องใหญ่มาก)
                    const MAX_W = 800
                    const scale = img.width > MAX_W ? MAX_W / img.width : 1
                    const w = Math.round(img.width * scale)
                    const h = Math.round(img.height * scale)
                    const canvas = document.createElement('canvas')
                    canvas.width = w; canvas.height = h
                    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
                    resolve(canvas.toDataURL('image/jpeg', 0.88).split(',')[1])
                }
                img.onerror = reject
                img.src = URL.createObjectURL(file)
            })
            const res = await fetch('/api/tenant/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrBankingBase64: base64 }),
            })
            const d = await res.json()
            if (d.success) toast.success('✅ บันทึก QR Banking แล้ว')
            else toast.error(d.error || 'อัปโหลดไม่สำเร็จ')
        } catch { toast.error('เกิดข้อผิดพลาด') }
        finally { setUploading(false) }
    }

    async function deleteQR() {
        const res = await fetch('/api/tenant/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qrBankingBase64: null }),
        })
        const d = await res.json()
        if (d.success) { setPreview(null); toast.success('ลบ QR Banking แล้ว') }
        else toast.error(d.error || 'เกิดข้อผิดพลาด')
    }

    if (!canManage) return null

    return (
        <div className="card" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.02)' }}>
            <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📲</span> QR Banking (พิมพ์บนใบเสร็จ)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
                รูป QR โอนเงิน จะพิมพ์ที่ด้านล่างของใบเสร็จทุกใบ — JPG/PNG/WEBP max 5MB
            </p>

            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Preview box — square สำหรับ QR */}
                <div
                    onClick={() => !uploading && fileRef.current?.click()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                    onDragOver={e => e.preventDefault()}
                    style={{
                        width: 160, height: 160, borderRadius: 14, flexShrink: 0,
                        border: preview ? '2px solid rgba(99,102,241,0.5)' : '2.5px dashed var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: uploading ? 'wait' : 'pointer', overflow: 'hidden', position: 'relative',
                        background: 'var(--bg)', transition: 'border-color 0.2s',
                    }}
                >
                    {uploading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                            <div style={{ width: 28, height: 28, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                            <span style={{ fontSize: '0.72rem' }}>กำลังบันทึก...</span>
                        </div>
                    ) : preview ? (
                        <>
                            <img src={preview} alt="QR Banking" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'all 0.2s', fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.background = 'rgba(0,0,0,0)' }}>
                                🔄 เปลี่ยน
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '0.75rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 6 }}>📲</div>
                            <p style={{ fontWeight: 600, fontSize: '0.78rem', margin: '0 0 4px' }}>คลิก/ลากวาง</p>
                            <p style={{ fontSize: '0.68rem', margin: 0 }}>รูป QR Banking</p>
                        </div>
                    )}
                </div>

                {/* Info + Actions */}
                <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.7, marginBottom: 12 }}>
                        <div>✅ รูปนี้จะนำไปพิมพ์ใต้ยอดชำระในใบเสร็จ</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>แนะนำ: รูป QR สี่เหลี่ยมจัตุรัส เช่น 400×400px</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            style={{ minHeight: 40, borderRadius: 10, border: 'none', background: uploading ? '#d1d5db' : '#6366F1', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 5 }}>
                            📷 อัปโหลด QR
                        </button>
                        {preview && !uploading && (
                            <button
                                onClick={deleteQR}
                                style={{ minHeight: 40, borderRadius: 10, border: '1.5px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)', color: '#dc2626', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', padding: '0 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
                                🗑️ ลบ
                            </button>
                        )}
                    </div>
                    {!loaded && !preview && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>⏳ กำลังโหลด...</p>
                    )}
                    {preview && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
                            ✅ มี QR Banking อยู่แล้ว — คลิกรูปเพื่อเปลี่ยน
                        </p>
                    )}
                </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
            />
        </div>
    )
}


function StoreSettingsCard() {

    const canManage = usePermission('SETTINGS_MANAGE')
    const { reload } = useTenant()
    const [form, setForm] = useState({
        displayName: '', storeNameLao: '',
        currency: 'LAK', language: 'th',
        phone: '', address: '', taxId: '', receiptHeader: '',
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetch('/api/tenant/settings')
            .then(r => r.json())
            .then(d => {
                if (d.settings) setForm({
                    displayName: d.settings.displayName ?? '',
                    storeNameLao: d.settings.storeNameLao ?? '',
                    currency: d.settings.currency ?? 'LAK',
                    language: d.settings.language ?? 'th',
                    phone: d.settings.phone ?? '',
                    address: d.settings.address ?? '',
                    taxId: d.settings.taxId ?? '',
                    receiptHeader: d.settings.receiptHeader ?? '',
                })
            })
            .finally(() => setLoading(false))
    }, [])

    async function save() {
        setSaving(true)
        const res = await fetch('/api/tenant/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) { reload(); toast.success('✅ บันทึกข้อมูลร้านแล้ว') }
        else toast.error(d.error || 'เกิดข้อผิดพลาด')
    }

    if (!canManage) return null

    return (
        <div className="card" style={{ borderColor: 'rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.02)' }}>
            <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🏪</span> ข้อมูลร้าน &amp; การตั้งค่า
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>ชื่อร้าน, สกุลเงิน, ภาษา, เบอร์โทร, ที่อยู่ และหัวใบบิล</p>

            {loading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>⏳ กำลังโหลด...</p>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        {/* ชื่อร้าน */}
                        <div>
                            <label className="label">🏠 ชื่อร้าน (ไทย/English)</label>
                            <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                                placeholder="ชื่อร้านของคุณ..." className="input" maxLength={100} />
                        </div>
                        <div>
                            <label className="label">🏠 ຊື່ຮ້ານ (ລາວ)</label>
                            <input value={form.storeNameLao} onChange={e => setForm(f => ({ ...f, storeNameLao: e.target.value }))}
                                placeholder="ຊື່ຮ້ານພາສາລາວ..." className="input" maxLength={100} />
                        </div>

                        {/* สกุลเงิน */}
                        <div>
                            <label className="label">💱 สกุลเงิน</label>
                            <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="input">
                                <option value="LAK">₭ LAK — ກີບລາວ</option>
                                <option value="THB">฿ THB — บาทไทย</option>
                            </select>
                        </div>

                        {/* ภาษา */}
                        <div>
                            <label className="label">🌐 ภาษา UI</label>
                            <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className="input">
                                <option value="th">🇹🇭 ไทย (Thai)</option>
                                <option value="lo">🇱🇦 ລາວ (Lao)</option>
                                <option value="both">🇹🇭🇱🇦 ไทย / ລາວ (Bilingual)</option>
                            </select>
                        </div>

                        {/* เบอร์โทร */}
                        <div>
                            <label className="label">📞 เบอร์โทรร้าน</label>
                            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="+856 20 xxxx xxxx" className="input" maxLength={30} />
                        </div>

                        {/* Tax ID */}
                        <div>
                            <label className="label">🧾 เลขทะเบียนภาษี (ถ้ามี)</label>
                            <input value={form.taxId} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))}
                                placeholder="xxxxxxxxxx" className="input" maxLength={20} />
                        </div>

                        {/* ที่อยู่ */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label className="label">📍 ที่อยู่ร้าน</label>
                            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                placeholder="ที่อยู่ร้าน..." className="input" rows={2}
                                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem' }} maxLength={300} />
                        </div>

                        {/* หัวใบบิล */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label className="label">🖨️ หัวใบบิล (แสดงบนใบเสร็จ)</label>
                            <textarea value={form.receiptHeader} onChange={e => setForm(f => ({ ...f, receiptHeader: e.target.value }))}
                                placeholder={'ชื่อร้าน\nที่อยู่\nเบอร์โทร\nขอบคุณที่ใช้บริการ 🙏'}
                                className="input" rows={4}
                                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem' }} maxLength={500} />
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>ข้อความนี้จะแสดงบนใบเสร็จทุกใบ</p>
                        </div>
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={save} disabled={saving} className="btn-primary"
                            style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
                            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกข้อมูลร้าน'}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}


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


// ─── Printer Settings Card ───────────────────────────────────────────
function PrinterSettingsCard() {
    const [s, setS] = useState<PrinterSettings | null>(null)

    useEffect(() => { setS(getPrinterSettings()) }, [])

    function update(patch: Partial<PrinterSettings>) {
        const next = setPrinterSettings(patch)
        setS(next)
    }

    function testPrint() {
        const w = window.open('', '_blank', 'width=302,height=300,toolbar=0,menubar=0')
        if (!w) return
        const mm = s?.paperWidth ?? '80mm'
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}@page{size:${mm} auto;margin:3mm 2mm}body{font-family:'Courier New',monospace;font-size:14px;width:${mm === '58mm' ? '54mm' : '76mm'}}.t{font-weight:900;font-size:16px;text-align:center;margin-bottom:6px}.d{font-size:11px;text-align:center;color:#444}.line{border-top:1px dashed #000;margin:6px 0}</style></head><body>
<div class="t">🖨️ TEST PRINT</div>
<div class="d">Paper: ${mm} | Copies: ${s?.copies ?? 1}</div>
<div class="line"></div>
<div class="d">Kitchen Auto: ${s?.autoKitchen ? '✅' : '❌'} | Bar Auto: ${s?.autoBar ? '✅' : '❌'}</div>
<div class="d">Receipt Auto: ${s?.autoReceipt ? '✅' : '❌'}</div>
<div class="line"></div>
<div class="d">KAIDEEDER POS</div>
<script>(function(){window.addEventListener('afterprint',function(){window.close()});window.onload=function(){window.focus();window.print()};})()</scr​ipt></body></html>`)
        w.document.close()
    }

    if (!s) return null  // avoid SSR mismatch

    const rowStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', background: 'var(--white)', borderRadius: 10,
        border: '1px solid var(--border)',
    }
    const labelStyle: React.CSSProperties = { fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }
    const subStyle: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }

    // Simple toggle button
    function Toggle({ val, onChange }: { val: boolean; onChange: (v: boolean) => void }) {
        return (
            <button onClick={() => onChange(!val)}
                style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: val ? 'var(--accent)' : '#d1d5db', position: 'relative',
                    transition: 'background 0.2s', flexShrink: 0,
                }}>
                <span style={{
                    position: 'absolute', top: 2, left: val ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                }} />
            </button>
        )
    }

    return (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.02)' }}>
            <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🖨️</span> ตั้งค่าเครื่องพิมพ์
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
                บันทึกในเครื่องนี้เท่านั้น (localStorage) — แต่ละเครื่องตั้งค่าได้อิสระ
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Paper width */}
                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>📏 ขนาด Paper</div>
                        <div style={subStyle}>ใช้กับ slip ครัว / บาร์ / ใบเสร็จ</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {(['80mm', '58mm'] as const).map(w => (
                            <button key={w} onClick={() => update({ paperWidth: w })}
                                style={{
                                    padding: '6px 14px', borderRadius: 8, border: '1.5px solid',
                                    borderColor: s.paperWidth === w ? 'var(--accent)' : 'var(--border)',
                                    background: s.paperWidth === w ? 'var(--accent)' : 'transparent',
                                    color: s.paperWidth === w ? '#fff' : 'var(--text)',
                                    fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
                                    transition: 'all 0.15s',
                                }}>{w}</button>
                        ))}
                    </div>
                </div>

                {/* Copies */}
                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>🖨️ จำนวนสำเนา (slip ครัว/บาร์)</div>
                        <div style={subStyle}>พิมพ์กี่ใบต่อ 1 รอบส่งครัว</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {([1, 2] as const).map(n => (
                            <button key={n} onClick={() => update({ copies: n })}
                                style={{
                                    width: 36, height: 36, borderRadius: 8, border: '1.5px solid',
                                    borderColor: s.copies === n ? 'var(--accent)' : 'var(--border)',
                                    background: s.copies === n ? 'var(--accent)' : 'transparent',
                                    color: s.copies === n ? '#fff' : 'var(--text)',
                                    fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit',
                                    transition: 'all 0.15s',
                                }}>{n}</button>
                        ))}
                    </div>
                </div>

                {/* Auto-kitchen */}
                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>🍳 Auto-Print slip ครัว</div>
                        <div style={subStyle}>พิมพ์อัตโนมัติเมื่อกด &quot;ส่งครัว&quot;</div>
                    </div>
                    <Toggle val={s.autoKitchen} onChange={v => update({ autoKitchen: v })} />
                </div>

                {/* Auto-bar */}
                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>🍹 Auto-Print slip บาร์</div>
                        <div style={subStyle}>พิมพ์อัตโนมัติเมื่อกด &quot;ส่งบาร์&quot;</div>
                    </div>
                    <Toggle val={s.autoBar} onChange={v => update({ autoBar: v })} />
                </div>

                {/* Auto-receipt */}
                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>🧾 Auto-Print ใบเสร็จ</div>
                        <div style={subStyle}>พิมพ์ใบเสร็จอัตโนมัติหลังชำระเงิน</div>
                    </div>
                    <Toggle val={s.autoReceipt} onChange={v => update({ autoReceipt: v })} />
                </div>

            </div>

            {/* Test print */}
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button onClick={testPrint}
                    style={{ flex: 1, minHeight: 40, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    🖨️ พิมพ์ทดสอบ
                </button>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: '4px 12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ fontSize: '1rem' }}>✅</span>
                    <span>บันทึกอัตโนมัติ — ทุกครั้งที่เปลี่ยน</span>
                </div>
            </div>
        </div>
    )
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

// ─── Import Products Modal ─────────────────────────────────────────────────
function ImportProductsModal({ onClose }: { onClose: () => void }) {
    const [file, setFile] = useState<File | null>(null)
    const [mode, setMode] = useState<'upsert' | 'clear_reimport'>('upsert')
    const [step, setStep] = useState<'pick' | 'running' | 'done'>('pick')
    const [result, setResult] = useState<any>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    async function doImport() {
        if (!file) return toast.error('กรุณาเลือกไฟล์ Excel')
        setStep('running')
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('mode', mode)
            const res = await fetch('/api/system/import-products', { method: 'POST', body: fd })
            const json = await res.json()
            if (json.success) { setResult(json.data); setStep('done') }
            else { toast.error(json.error || 'เกิดข้อผิดพลาด'); setStep('pick') }
        } catch { toast.error('เกิดข้อผิดพลาด'); setStep('pick') }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}
            onClick={step === 'running' ? undefined : onClose}>
            <div style={{ background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ height: 4, background: step === 'done' ? '#16a34a' : 'var(--accent)' }} />
                <div style={{ padding: '1.25rem 1.5rem' }}>

                    {step === 'pick' && (<>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <span style={{ fontSize: '1.8rem' }}>📦</span>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>นำเข้าสินค้าจาก Excel</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>รองรับ .xlsx / .xls — อ่านทุก Sheet อัตโนมัติ</div>
                            </div>
                        </div>

                        {/* File drop zone */}
                        <div onClick={() => fileRef.current?.click()}
                            style={{ border: `2px dashed ${file ? '#16a34a' : 'var(--border)'}`, borderRadius: 14, padding: '1.5rem', textAlign: 'center', cursor: 'pointer', marginBottom: 14, background: file ? 'rgba(22,163,74,0.04)' : 'var(--bg)', transition: 'all 0.2s' }}>
                            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
                            <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>{file ? '✅' : '📊'}</div>
                            {file
                                ? <><p style={{ fontWeight: 700, color: '#059669', fontSize: '0.88rem' }}>{file.name}</p><button onClick={e => { e.stopPropagation(); setFile(null) }} style={{ marginTop: 4, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}>เปลี่ยนไฟล์</button></>
                                : <><p style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.88rem', marginBottom: 2 }}>คลิกเพื่อเลือกไฟล์ Excel</p><p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>.xlsx หรือ .xls</p></>}
                        </div>

                        {/* Mode toggle */}
                        <div style={{ marginBottom: 16 }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>โหมดการนำเข้า</p>
                            {[{ v: 'upsert', icon: '🔄', label: 'อัพเดทข้อมูลที่มีอยู่ (ปลอดภัย)', sub: 'SKU ใหม่ = เพิ่ม / SKU เดิม = อัพเดท' },
                            { v: 'clear_reimport', icon: '🗑️', label: 'ล้างแล้ว Import ใหม่ทั้งหมด', sub: '⚠️ จะลบสินค้า BOM คลัง และ PO ทั้งหมดก่อน' }].map(m => (
                                <div key={m.v} onClick={() => setMode(m.v as any)}
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.75rem', borderRadius: 10, border: `1.5px solid ${mode === m.v ? 'var(--accent)' : 'var(--border)'}`, background: mode === m.v ? 'var(--accent-bg)' : 'var(--bg)', cursor: 'pointer', marginBottom: 8 }}>
                                    <span style={{ fontSize: '1.1rem', marginTop: 1 }}>{m.icon}</span>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.82rem', color: mode === m.v ? 'var(--accent)' : 'var(--text)' }}>{m.label}</p>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{m.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={onClose} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem' }}>ยกเลิก</button>
                            <button onClick={doImport} disabled={!file}
                                style={{ flex: 2, minHeight: 44, borderRadius: 12, border: 'none', background: file ? (mode === 'clear_reimport' ? '#DC2626' : 'var(--accent)') : '#9CA3AF', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: file ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                                {mode === 'clear_reimport' ? '🗑️ ล้างแล้ว Import' : '📦 Import'}
                            </button>
                        </div>
                    </>)}

                    {step === 'running' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', gap: 14 }}>
                            <div style={{ width: 44, height: 44, border: '4px solid rgba(201,168,76,0.3)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            <div style={{ fontWeight: 700, color: 'var(--accent)' }}>กำลัง import...</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>อาจใช้เวลา 10-60 วินาที ขึ้นอยู่กับขนาดไฟล์</div>
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div>
                            <div style={{ textAlign: 'center', padding: '0.5rem 0', marginBottom: 16 }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>✅</div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#16a34a' }}>Import เสร็จแล้ว!</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
                                {result.cleared > 0 && <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '0.75rem', textAlign: 'center', border: '1px solid #FECACA' }}><p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#DC2626' }}>{result.cleared}</p><p style={{ fontSize: '0.7rem', color: '#7F1D1D', marginTop: 2 }}>ลบออก</p></div>}
                                <div style={{ background: 'rgba(22,163,74,0.06)', borderRadius: 10, padding: '0.75rem', textAlign: 'center', border: '1px solid rgba(22,163,74,0.2)' }}><p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{result.created}</p><p style={{ fontSize: '0.7rem', color: '#065F46', marginTop: 2 }}>เพิ่มใหม่</p></div>
                                <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 10, padding: '0.75rem', textAlign: 'center', border: '1px solid rgba(59,130,246,0.2)' }}><p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3B82F6' }}>{result.updated}</p><p style={{ fontSize: '0.7rem', color: '#1E3A5F', marginTop: 2 }}>อัพเดท</p></div>
                                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '0.75rem', textAlign: 'center', border: '1px solid var(--border)' }}><p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-muted)' }}>{result.skipped}</p><p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>ข้าม</p></div>
                            </div>
                            {result.errors?.length > 0 && <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '0.75rem', marginBottom: 8 }}><p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', marginBottom: 6 }}>⚠️ Errors ({result.errors.length})</p>{result.errors.map((e: string, i: number) => <p key={i} style={{ fontSize: '0.7rem', color: '#7F1D1D', marginBottom: 2 }}>• {e}</p>)}</div>}
                            {result.unknownCategories?.length > 0 && <div style={{ background: 'rgba(217,119,6,0.06)', borderRadius: 10, padding: '0.75rem', marginBottom: 8, border: '1px solid rgba(217,119,6,0.2)' }}><p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', marginBottom: 6 }}>🔍 เดา Category ไม่ได้ → OTHER ({result.unknownCategories.length})</p><p style={{ fontSize: '0.68rem', color: '#92400E', marginBottom: 6 }}>รายการเหล่านี้ถูก import ไว้แล้ว — ถ้าต้องการย้าย category ให้แก้ใน Products</p>{result.unknownCategories.map((n: string, i: number) => <p key={i} style={{ fontSize: '0.7rem', color: '#78350F', marginBottom: 2 }}>• {n}</p>)}</div>}
                            <button onClick={onClose} style={{ width: '100%', minHeight: 44, borderRadius: 12, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>✅ ปิด</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function SettingsPage() {
    useRoleGuard(['owner'])
    const [posConfig, setPosConfig] = useState<PosConfig>(defaultConfig)
    const [showKey, setShowKey] = useState(false)
    const [testing, setTesting] = useState(false)
    const [showReset, setShowReset] = useState(false)
    const [showImport, setShowImport] = useState(false)

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

                {/* ── Brand ── */}
                <StoreBrandingCard />

                {/* ── Menu Banner ── */}
                <MenuBannerCard />

                {/* ── QR Banking ── */}
                <QrBankingCard />

                {/* ── User Management ── */}
                <div className="card" style={{ borderColor: 'rgba(59,130,246,0.25)', background: 'rgba(59,130,246,0.03)' }}>
                    <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}><span>👥</span> จัดการผู้ใช้ (User Management)</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>เพิ่ม/แก้ไข/ปิดใช้งานผู้ใช้ในร้าน — กำหนด Role และสิทธิ์การเข้าถึง</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'var(--white)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', marginBottom: 2 }}>👤 บัญชีพนักงานและสิทธิ์การใช้งาน</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Roles: Owner · Manager · Purchaser · Warehouse · Kitchen · Bar · Cashier · Viewer</div>
                        </div>
                        <a href="/settings/users"
                            style={{ background: 'transparent', border: '1.5px solid rgba(59,130,246,0.5)', color: '#3B82F6', padding: '0.5rem 1.25rem', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12, textDecoration: 'none', transition: 'all 0.15s', display: 'inline-block' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#3B82F6'; e.currentTarget.style.color = '#fff' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3B82F6' }}
                        >👥 จัดการ Users →</a>
                    </div>
                </div>

                {/* ── Store Info (real form) ── */}
                <StoreSettingsCard />

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

                {/* ── นำเข้าสินค้า ── */}
                <div className="card" style={{ borderColor: 'rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.02)' }}>
                    <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem' }}>📦 นำเข้าสินค้า</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>เพิ่ม/อัพเดทสินค้าจากไฟล์ Excel — หรือล้างแล้ว import ใหม่</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', background: 'var(--white)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', marginBottom: 2 }}>📊 Import จาก Excel (.xlsx)</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>อ่านหลาย Sheet — อัพเดทหรือล้าง+import ใหม่แบบ Clean slate</div>
                        </div>
                        <button onClick={() => setShowImport(true)}
                            style={{ background: 'transparent', border: '1.5px solid rgba(59,130,246,0.5)', color: '#3B82F6', padding: '0.5rem 1.25rem', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 12, transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#3B82F6'; e.currentTarget.style.color = '#fff' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3B82F6' }}
                        >📦 นำเข้า</button>
                    </div>
                </div>

                {/* ── Printer Settings ── */}
                <PrinterSettingsCard />

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
            {showImport && <ImportProductsModal onClose={() => setShowImport(false)} />}
        </div>
    )
}
