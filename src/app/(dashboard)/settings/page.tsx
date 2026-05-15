'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { usePermission } from '@/hooks/usePermission'
import { useStoreBranding, clearStoreBrandingCache } from '@/hooks/useStoreBranding'
import QRCode from 'qrcode'
import { useTenant } from '@/context/TenantContext'
import { getPrinterSettings, setPrinterSettings, setStationPrinter, type PrinterSettings, type StationPrinterConfig } from '@/lib/printerSettings'

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
                    const b64 = d.settings.qrBankingBase64
                    const mime = b64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg'
                    setPreview(`data:${mime};base64,${b64}`)
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

// ─── Payment Config Card ──────────────────────────────────────
function PaymentConfigCard() {
    const canManage = usePermission('SETTINGS_MANAGE')
    const { settings } = useTenant()
    const [config, setConfig] = useState({
        provider: 'manual' as string,
        accountName: '',
        accountNumber: '',
        promptpayId: '',
        isActive: false,
        acceptedMethods: ['BANK_TRANSFER', 'QR'] as string[],
    })
    const [loaded, setLoaded] = useState(false)
    const [saving, setSaving] = useState(false)

    const tenantCode = settings?.code ?? ''

    useEffect(() => {
        fetch('/api/tenant/payment/config')
            .then(r => r.json())
            .then(d => {
                if (d.config) setConfig(prev => ({ ...prev, ...d.config }))
                setLoaded(true)
            })
            .catch(() => setLoaded(true))
    }, [])

    async function save() {
        setSaving(true)
        const res = await fetch('/api/tenant/payment/config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) toast.success('✅ บันทึก Payment Config แล้ว')
        else toast.error(d.error || 'เกิดข้อผิดพลาด')
    }

    function toggleMethod(method: string) {
        setConfig(prev => ({
            ...prev,
            acceptedMethods: prev.acceptedMethods.includes(method)
                ? prev.acceptedMethods.filter(m => m !== method)
                : [...prev.acceptedMethods, method],
        }))
    }

    if (!canManage) return null

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '9px 12px', borderRadius: 10,
        border: '1.5px solid var(--border)', background: 'var(--bg)',
        color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit',
        outline: 'none',
    }

    const methodBadge = (id: string, label: string, icon: string) => {
        const active = config.acceptedMethods.includes(id)
        return (
            <button
                key={id}
                onClick={() => toggleMethod(id)}
                style={{
                    padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${active ? 'rgba(99,102,241,0.6)' : 'var(--border)'}`,
                    background: active ? 'rgba(99,102,241,0.1)' : 'var(--bg)',
                    color: active ? '#6366F1' : 'var(--text-muted)',
                    fontWeight: active ? 700 : 500, fontSize: '0.78rem', cursor: 'pointer',
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                }}
            >
                {icon} {label}
            </button>
        )
    }

    return (
        <div className="card" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.02)' }}>
            <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💳</span> ตั้งค่าการรับชำระเงิน (Payment Config)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 4 }}>
                ข้อมูลบัญชีรับโอน และรองรับการเชื่อมต่อ Payment Gateway ในอนาคต
            </p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16, padding: '6px 10px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)' }}>
                <span style={{ fontSize: '0.72rem', color: '#6366F1', fontWeight: 600 }}>📡 Webhook URL:</span>
                <code style={{ fontSize: '0.7rem', color: '#4F46E5', wordBreak: 'break-all' }}>
                    {typeof window !== 'undefined' ? window.location.origin : ''}/api/public/payment/notify?tenantCode={tenantCode}
                </code>
            </div>

            {!loaded ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>⏳ กำลังโหลด...</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Provider */}
                    <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
                            🏦 ช่องทางการชำระเงิน (Provider)
                        </label>
                        <select
                            value={config.provider}
                            onChange={e => setConfig(prev => ({ ...prev, provider: e.target.value }))}
                            style={inputStyle}
                        >
                            <option value="manual">Manual (รับสลิปแล้วยืนยันเอง)</option>
                            <option value="promptpay">PromptPay / พร้อมเพย์</option>
                            <option value="gbprimepay">GBPrimePay</option>
                            <option value="omise">Omise</option>
                            <option value="stripe">Stripe</option>
                        </select>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {config.provider === 'manual' && '✅ รับสลิปลูกค้า → staff ยืนยันเองใน Delivery Dashboard'}
                            {config.provider === 'promptpay' && '🏦 รับชำระผ่าน PromptPay — เชื่อมต่อผ่าน webhook ธนาคาร'}
                            {['gbprimepay', 'omise', 'stripe'].includes(config.provider) && '🔌 ต้องตั้งค่า Merchant ID + Secret Key'}
                        </p>
                    </div>

                    {/* Account Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
                                ชื่อบัญชี / PromptPay Alias
                            </label>
                            <input
                                style={inputStyle}
                                placeholder="ชื่อร้าน / ชื่อเจ้าของบัญชี"
                                value={config.accountName}
                                onChange={e => setConfig(prev => ({ ...prev, accountName: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
                                เลขบัญชี / PromptPay ID
                            </label>
                            <input
                                style={inputStyle}
                                placeholder="เลขบัญชีธนาคาร หรือ เบอร์โทรมือถือ"
                                value={config.accountNumber}
                                onChange={e => setConfig(prev => ({ ...prev, accountNumber: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Accepted Methods */}
                    <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8, display: 'block' }}>
                            วิธีชำระที่รองรับ
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {methodBadge('BANK_TRANSFER', 'โอนเงิน', '🏦')}
                            {methodBadge('QR', 'QR Banking', '📲')}
                            {methodBadge('PROMPTPAY', 'PromptPay', '⚡')}
                            {methodBadge('CARD', 'บัตรเครดิต', '💳')}
                        </div>
                    </div>

                    {/* Is Active Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: config.isActive ? 'rgba(34,197,94,0.06)' : 'var(--bg)', border: `1.5px solid ${config.isActive ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer' }} onClick={() => setConfig(prev => ({ ...prev, isActive: !prev.isActive }))}>
                        <div style={{ width: 40, height: 22, borderRadius: 11, background: config.isActive ? '#22C55E' : '#D1D5DB', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                            <div style={{ position: 'absolute', top: 3, left: config.isActive ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                                {config.isActive ? '✅ เปิดรับชำระออนไลน์' : '⏸ ปิดการรับชำระออนไลน์'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ลูกค้าจะยังต้องแนบสลิปเพื่อยืนยัน</div>
                        </div>
                    </div>

                    <button
                        onClick={save}
                        disabled={saving}
                        style={{ alignSelf: 'flex-start', padding: '10px 22px', borderRadius: 11, border: 'none', background: saving ? '#d1d5db' : '#6366F1', color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    >
                        {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึก Payment Config'}
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── Delivery Link & QR Card ─────────────────────────────────

function DeliveryLinkCard() {
    const canManage = usePermission('SETTINGS_MANAGE')
    const { settings } = useTenant()
    const [qrDataUrl, setQrDataUrl] = useState<string>('')

    // The host might vary by environments, for now hardcoding delivery domain or using location context.
    const deliveryUrl = settings?.code ? `https://delivery.kaideeder.com/d/${settings.code}` : ''

    useEffect(() => {
        if (!deliveryUrl) return
        QRCode.toDataURL(deliveryUrl, {
            width: 140, margin: 1,
            color: { dark: '#000000', light: '#FFFFFF' },
        }).then(url => setQrDataUrl(url))
        .catch(err => console.error('QR Generate Error:', err))
    }, [deliveryUrl])

    function copyLink() {
        if (!deliveryUrl) return
        navigator.clipboard.writeText(deliveryUrl)
        toast.success('📋 คัดลอกลิงก์แล้ว')
    }

    function downloadQR() {
        if (!qrDataUrl || !settings) return
        
        const canvas = document.createElement('canvas')
        canvas.width = 180; canvas.height = 220
        const ctx = canvas.getContext('2d')!
        
        // พื้นหลังขาว
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 180, 220)
        
        // วาดรูปลงไป
        const img = new Image()
        img.onload = () => {
            ctx.drawImage(img, 20, 16, 140, 140)
            
            // วาดตัวหนังสือ
            ctx.fillStyle = '#1f2937'
            ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(settings.displayName || settings.name || 'Delivery', 90, 175)
            
            ctx.font = '10px system-ui, -apple-system, sans-serif'
            ctx.fillStyle = '#6b7280'
            ctx.fillText('สแกนสั่งเดลิเวอรี่', 90, 195)
            
            const link = document.createElement('a')
            link.download = `delivery-qr-${settings.code}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        }
        img.src = qrDataUrl
    }

    if (!canManage || !settings) return null

    return (
        <div className="card" style={{ borderColor: 'rgba(236,72,153,0.25)', background: 'rgba(236,72,153,0.02)' }}>
            <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🛵</span> ลิงก์ระบบจัดส่ง (Delivery Link & QR)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
                คัดลอกลิงก์หรือดาวน์โหลด QR Code ไปแปะในเพจ เพื่อให้ลูกค้าสั่งเดลิเวอรี่
            </p>

            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* QR Code */}
                <div style={{ background: '#fff', padding: 8, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexShrink: 0, width: 156, height: 156, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {qrDataUrl ? <img src={qrDataUrl} alt="Delivery QR" style={{ width: 140, height: 140, display: 'block' }} /> : <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Loading QR...</div>}
                </div>

                {/* Link & Actions */}
                <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
                            🔗 URL สำหรับนำไปแชร์
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input 
                                readOnly 
                                value={deliveryUrl} 
                                className="input" 
                                style={{ flex: 1, color: '#DB2777', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }} 
                                onClick={e => e.currentTarget.select()}
                            />
                            <button 
                                onClick={copyLink}
                                style={{ padding: '0 14px', borderRadius: 10, background: '#EC4899', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}
                            >
                                📋 คัดลอก
                            </button>
                        </div>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        • สามารถส่ง URL ให้ลูกค้าใน Line หรือ Messenger<br/>
                        • หรือนำรูป QR Code ไปใส่ในรูปโปสเตอร์โฆษณา
                    </div>

                    <button 
                        onClick={downloadQR}
                        style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 10, border: '1.5px solid rgba(236,72,153,0.3)', background: 'rgba(236,72,153,0.06)', color: '#DB2777', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        ⬇️ ดาวน์โหลดรูป QR Code
                    </button>
                </div>
            </div>
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
        closingHour: 0,
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
                    closingHour: d.settings.closingHour ?? 0,
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

                        {/* เวลาปิดร้าน — Business Day Boundary */}
                        <div style={{ gridColumn: '1/-1', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                            <label className="label" style={{ color: '#818cf8', marginBottom: 8 }}>🕐 เวลาปิดร้าน (สำหรับสรุปยอดรายวัน)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <select
                                    value={form.closingHour}
                                    onChange={e => setForm(f => ({ ...f, closingHour: Number(e.target.value) }))}
                                    className="input"
                                    style={{ maxWidth: 180 }}
                                >
                                    <option value={0}>🌙 00:00 น. — เที่ยงคืน (ค่าเริ่มต้น)</option>
                                    <option value={1}>🌙 01:00 น. — ตี 1</option>
                                    <option value={2}>🌙 02:00 น. — ตี 2</option>
                                    <option value={3}>🌙 03:00 น. — ตี 3</option>
                                    <option value={4}>🌙 04:00 น. — ตี 4</option>
                                    <option value={5}>🌅 05:00 น. — ตี 5</option>
                                    <option value={6}>🌅 06:00 น. — 6 โมงเช้า</option>
                                </select>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flex: 1 }}>
                                    {form.closingHour === 0 ? (
                                        <>วันใหม่เริ่ม <strong>00:00 น.</strong> ตามปกติ<br />
                                        <span style={{ color: '#94a3b8' }}>ออเดอร์ตี 1 จะนับเป็นของวันถัดไป</span></>
                                    ) : (
                                        <>วันธุรกิจเริ่ม <strong>{String(form.closingHour).padStart(2,'0')}:00 น.</strong> และสิ้นสุด <strong>{String(form.closingHour).padStart(2,'0')}:00 น. วันถัดไป</strong><br />
                                        <span style={{ color: '#a5b4fc' }}>✅ ออเดอร์ก่อน {String(form.closingHour).padStart(2,'0')}:00 น. จะนับเป็นยอดของ<strong>วันก่อน</strong></span></>
                                    )}
                                </div>
                            </div>
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

// ─── Toggle button (reusable) ─────────────────────────────────────────────
function Toggle({ val, onChange }: { val: boolean; onChange: (v: boolean) => void }) {
    return (
        <button onClick={() => onChange(!val)} style={{
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

// ─── Notification Sound Test Card ─────────────────────────────────────────
function NotificationTestCard() {
    const [testing, setTesting] = useState<string | null>(null)

    function playUrgentBuzzer() {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
            const vol = 1.0
            const t = audioCtx.currentTime
            const pulses: [number, number, number][] = [
                [880,  0.0,  vol],
                [880,  0.28, vol],
                [1046, 0.56, vol * 1.2],
            ]
            pulses.forEach(([freq, delay, gain]) => {
                const osc = audioCtx.createOscillator()
                const g = audioCtx.createGain()
                osc.connect(g); g.connect(audioCtx.destination)
                osc.type = 'square'; osc.frequency.value = freq
                g.gain.setValueAtTime(0, t + delay)
                g.gain.linearRampToValueAtTime(gain * 0.4, t + delay + 0.01)
                g.gain.setValueAtTime(gain * 0.4, t + delay + 0.18)
                g.gain.linearRampToValueAtTime(0, t + delay + 0.24)
                osc.start(t + delay); osc.stop(t + delay + 0.28)
            })
        } catch (e) { console.error('buzzer error', e) }
    }

    function playBellChime() {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
            const vol = 1.0
            const t = audioCtx.currentTime
            const tones: [number, number, number][] = [
                [1046, 0,    vol],
                [880,  0.3,  vol * 0.8],
                [698,  0.65, vol * 0.6],
                [1046, 1.0,  vol],
                [880,  1.3,  vol * 0.8],
            ]
            tones.forEach(([freq, delay, gain]) => {
                const osc = audioCtx.createOscillator()
                const g = audioCtx.createGain()
                osc.connect(g); g.connect(audioCtx.destination)
                osc.type = 'triangle'; osc.frequency.value = freq
                g.gain.setValueAtTime(0, t + delay)
                g.gain.linearRampToValueAtTime(gain, t + delay + 0.02)
                g.gain.exponentialRampToValueAtTime(0.01, t + delay + 1.2)
                osc.start(t + delay); osc.stop(t + delay + 1.3)
            })
        } catch (e) { console.error('chime error', e) }
    }

    function playSpeech(msg: string) {
        if (!('speechSynthesis' in window)) { toast.error('เบราว์เซอร์ไม่รองรับ Speech'); return }
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(msg)
        utterance.lang = 'th-TH'
        utterance.rate = 1.0
        utterance.volume = 1.0
        const voices = window.speechSynthesis.getVoices()
        const thaiVoice = voices.find(v => v.lang === 'th-TH' || v.lang === 'th')
        if (thaiVoice) utterance.voice = thaiVoice
        window.speechSynthesis.speak(utterance)
    }

    async function testOrderNew() {
        setTesting('order')
        playUrgentBuzzer()
        setTimeout(() => playSpeech('โต๊ะ 3 โซนใน สั่งอาหาร'), 900)
        toast('📢 ทดสอบ: ออเดอร์ใหม่ (Beep x3 + เสียงพูด)', { icon: '🛎️' })
        setTimeout(() => setTesting(null), 1500)
    }

    async function testBillRequest() {
        setTesting('bill')
        playBellChime()
        setTimeout(() => playSpeech('โต๊ะ 5 โซนวีไอพี เรียกเช็คบิล'), 1600)
        toast('🔔 ทดสอบ: เรียกเช็คบิล (Bell + เสียงพูด)', { icon: '🔔' })
        setTimeout(() => setTesting(null), 2000)
    }

    async function testBothSequence() {
        setTesting('both')
        toast('🎵 ทดสอบเสียงทั้งคู่ต่อเนื่อง...', { icon: '🎵' })
        // ORDER_NEW first
        playUrgentBuzzer()
        setTimeout(() => playSpeech('โต๊ะ 3 สั่งอาหาร'), 900)
        // Then BILL_REQUEST
        setTimeout(() => { playBellChime() }, 2500)
        setTimeout(() => playSpeech('โต๊ะ 7 เรียกเช็คบิล'), 4000)
        setTimeout(() => setTesting(null), 5000)
    }

    const btnBase: React.CSSProperties = {
        flex: 1, minHeight: 52, borderRadius: 12, border: 'none',
        fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
        fontFamily: 'inherit', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4,
        transition: 'all 0.15s', position: 'relative',
    }

    return (
        <div className="card" style={{ borderColor: 'rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.02)' }}>
            <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🔔</span> ทดสอบระบบแจ้งเตือน
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
                ทดสอบเสียงแจ้งเตือนทั้งหมด — ต้องเปิดเสียงเบราว์เซอร์ก่อน · ใช้งานได้เฉพาะบนเครื่องที่เปิด POS
            </p>

            {/* Sound comparison diagram */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginBottom: 14, padding: '10px 14px', background: 'rgba(139,92,246,0.05)', borderRadius: 10, border: '1px solid rgba(139,92,246,0.15)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📢</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7C3AED' }}>ออเดอร์ใหม่ (QR)</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>Beep-Beep-BEEP</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Square wave · เร่งด่วน</div>
                </div>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>≠</div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🔔</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669' }}>เรียกเช็คบิล</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>Ding-Dong...</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Triangle wave · นุ่มนวล</div>
                </div>
            </div>

            {/* Test buttons */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <button
                    onClick={testOrderNew}
                    disabled={testing !== null}
                    style={{ ...btnBase, background: testing === 'order' ? '#6D28D9' : 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', boxShadow: '0 4px 12px rgba(109,40,217,0.3)' }}
                >
                    <span style={{ fontSize: '1.3rem' }}>{testing === 'order' ? '⏳' : '📢'}</span>
                    <span>ออเดอร์ใหม่</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>Beep x3 + พูด</span>
                </button>
                <button
                    onClick={testBillRequest}
                    disabled={testing !== null}
                    style={{ ...btnBase, background: testing === 'bill' ? '#047857' : 'linear-gradient(135deg,#059669,#047857)', color: '#fff', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                >
                    <span style={{ fontSize: '1.3rem' }}>{testing === 'bill' ? '⏳' : '🔔'}</span>
                    <span>เรียกเช็คบิล</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>Bell + พูด</span>
                </button>
                <button
                    onClick={testBothSequence}
                    disabled={testing !== null}
                    style={{ ...btnBase, background: testing === 'both' ? '#1D4ED8' : 'linear-gradient(135deg,#3B82F6,#1D4ED8)', color: '#fff', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
                >
                    <span style={{ fontSize: '1.3rem' }}>{testing === 'both' ? '⏳' : '🎵'}</span>
                    <span>ทดสอบทั้งคู่</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>ต่อเนื่อง 5 วิ</span>
                </button>
            </div>

            {/* Speech only test */}
            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onClick={() => { playSpeech('โต๊ะ 3 โซนใน สั่งอาหาร'); toast('🗣️ ทดสอบเสียงพูด: ออเดอร์', { icon: '🗣️' }) }}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: '1.5px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.06)', color: '#7C3AED', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    🗣️ ทดสอบเสียงพูด (ออเดอร์)
                </button>
                <button
                    onClick={() => { playSpeech('โต๊ะ 5 โซนวีไอพี เรียกเช็คบิล'); toast('🗣️ ทดสอบเสียงพูด: เช็คบิล', { icon: '🗣️' }) }}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: '1.5px solid rgba(5,150,105,0.3)', background: 'rgba(5,150,105,0.06)', color: '#059669', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    🗣️ ทดสอบเสียงพูด (เช็คบิล)
                </button>
            </div>

            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(139,92,246,0.05)', borderRadius: 8, fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                💡 <strong>หากไม่ได้ยินเสียง:</strong> คลิกปุ่ม "🔔 แตะที่นี่เพื่อเปิดเสียงแจ้งเตือน" ที่ด้านบน → กลับมากดทดสอบอีกครั้ง<br/>
                🎙️ <strong>Speech ต้องการ:</strong> Chrome/Edge + ติดตั้ง Thai voice ในระบบ (Windows: Settings → Time &amp; Language → Speech)
            </div>
        </div>
    )
}

// ─── Global Auto-Print Card ───────────────────────────────────────────────
function AutoPrintCard() {
    const [s, setS] = useState<PrinterSettings | null>(null)
    useEffect(() => { setS(getPrinterSettings()) }, [])
    if (!s) return null

    function update(patch: Partial<PrinterSettings>) {
        setS(setPrinterSettings(patch))
    }

    const rowStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 14px', background: 'var(--white)', borderRadius: 10,
        border: '1px solid var(--border)',
    }
    const labelStyle: React.CSSProperties = { fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }
    const subStyle: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }

    return (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.02)' }}>
            <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🖨️</span> ตั้งค่าระบบพิมพ์
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 14 }}>
                บันทึกในเครื่องนี้เท่านั้น (localStorage) — แต่ละเครื่องตั้งค่าได้อิสระ
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>🍳 Auto-Print slip ครัว</div>
                        <div style={subStyle}>พิมพ์อัตโนมัติเมื่อกด &quot;ส่งครัว&quot;</div>
                    </div>
                    <Toggle val={s.autoKitchen} onChange={v => update({ autoKitchen: v })} />
                </div>
                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>🍹 Auto-Print slip บาร์</div>
                        <div style={subStyle}>พิมพ์อัตโนมัติเมื่อกด &quot;ส่งบาร์&quot;</div>
                    </div>
                    <Toggle val={s.autoBar} onChange={v => update({ autoBar: v })} />
                </div>
                <div style={rowStyle}>
                    <div>
                        <div style={labelStyle}>🧾 Auto-Print ใบเสร็จ</div>
                        <div style={subStyle}>พิมพ์ใบเสร็จอัตโนมัติหลังชำระเงิน</div>
                    </div>
                    <Toggle val={s.autoReceipt} onChange={v => update({ autoReceipt: v })} />
                </div>
            </div>
        </div>
    )
}

// ─── Station Printer Card (Kitchen / Bar / Receipt) ──────────────────────
type StationKey = 'kitchenPrinter' | 'barPrinter' | 'receiptPrinter'

function StationPrinterCard({ stationKey, label, icon, accentColor, stationType }: {
    stationKey: StationKey
    label: string
    icon: string
    accentColor: string
    stationType: 'KITCHEN' | 'BAR' | 'RECEIPT'
}) {
    const [cfg, setCfg] = useState<StationPrinterConfig | null>(null)
    const [testing, setTesting] = useState(false)

    useEffect(() => {
        const s = getPrinterSettings()
        setCfg(s[stationKey])
    }, [stationKey])

    // อัปเดต config ของ station นี้
    function update(patch: Partial<StationPrinterConfig>) {
        const next = { ...cfg!, ...patch }
        setStationPrinter(stationType, next)
        setCfg(next)
    }

    // ทดสอบพิมพ์ TCP ตรง
    async function testTCP() {
        if (!cfg) return
        setTesting(true)
        try {
            const res = await fetch('/api/print/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ip: cfg.ip,
                    port: cfg.port,
                    station: stationType === 'RECEIPT' ? 'KITCHEN' : stationType,
                    tableName: 'TEST',
                    orderNumber: 'T001',
                    items: [
                        { name: `${icon} ${label} — TEST PRINT`, quantity: 1 },
                        { name: `IP: ${cfg.ip}:${cfg.port}`, quantity: 1 },
                        { name: `Paper: ${cfg.paperWidth}  Cut: ${cfg.autoCut ? 'ON' : 'OFF'}`, quantity: 1 },
                        { name: 'KAIDEEDER POS', quantity: 1 },
                    ],
                    autoCut: cfg.autoCut,
                    copies: cfg.copies,
                }),
            })
            const d = await res.json()
            if (d.ok) toast.success(`✅ ${label}: พิมพ์สำเร็จ (${d.bytes} bytes)`)
            else toast.error(`❌ ${label}: ${d.error}`)
        } catch (e: any) {
            toast.error(`TCP failed: ${e.message}`)
        } finally {
            setTesting(false)
        }
    }

    // ทดสอบ browser print
    function testBrowser() {
        if (!cfg) return
        const mm = cfg.paperWidth
        const w = window.open('', '_blank', 'width=302,height=300,toolbar=0,menubar=0')
        if (!w) return
        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;700;900&family=Noto+Sans+Thai:wght@400;700;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}@page{size:${mm} auto;margin:3mm 2mm}body{font-family:'Noto Sans Lao','Noto Sans Thai','Courier New',monospace;font-size:14px;width:${mm === '58mm' ? '54mm' : '76mm'}}.t{font-weight:900;font-size:16px;text-align:center;margin-bottom:6px}.d{font-size:11px;text-align:center;color:#444}.line{border-top:1px dashed #000;margin:6px 0}</style></head><body>
<div class="t">${icon} ${label}</div>
<div class="d">TEST PRINT — Browser</div>
<div class="line"></div>
<div class="d">Paper: ${mm} | Copies: ${cfg.copies}</div>
<div class="d">AutoCut: ${cfg.autoCut ? 'ON' : 'OFF'}</div>
<div class="line"></div>
<div class="d">KAIDEEDER POS</div>
<script>(function(){window.addEventListener('afterprint',function(){window.close()});window.onload=function(){window.focus();window.print()};})()</scr` + `ipt></body></html>`)
        w.document.close()
    }

    if (!cfg) return null

    const statusBg = cfg.enabled ? `rgba(${accentColor},0.06)` : 'var(--bg)'
    const statusBorder = cfg.enabled ? `rgba(${accentColor},0.3)` : 'var(--border)'

    return (
        <div style={{
            border: `1.5px solid ${statusBorder}`,
            borderRadius: 14, padding: '14px 16px',
            background: statusBg,
            transition: 'all 0.2s',
        }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>{label}</div>
                        <div style={{ fontSize: '0.7rem', color: cfg.enabled ? `rgb(${accentColor})` : 'var(--text-muted)', fontWeight: 600 }}>
                            {cfg.enabled ? `✅ TCP เปิด · ${cfg.ip}:${cfg.port}` : '⚪ ปิด TCP — ใช้ Browser print'}
                        </div>
                    </div>
                </div>
                <Toggle val={cfg.enabled} onChange={v => update({ enabled: v })} />
            </div>

            {/* IP + Port */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 10 }}>
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>🌐 IP Address (WiFi / LAN)</div>
                    <input
                        value={cfg.ip}
                        onChange={e => update({ ip: e.target.value })}
                        placeholder="192.168.18.xxx"
                        className="input"
                        style={{ fontSize: '0.88rem', fontFamily: 'monospace' }}
                    />
                </div>
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Port</div>
                    <input
                        value={cfg.port}
                        onChange={e => update({ port: Number(e.target.value) || 9100 })}
                        type="number"
                        className="input"
                        style={{ fontSize: '0.88rem', fontFamily: 'monospace' }}
                    />
                </div>
            </div>

            {/* Paper + Copies + AutoCut */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                {/* Paper width */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {(['80mm', '58mm'] as const).map(w => (
                        <button key={w} onClick={() => update({ paperWidth: w })} style={{
                            padding: '4px 10px', borderRadius: 7, border: '1.5px solid',
                            borderColor: cfg.paperWidth === w ? `rgb(${accentColor})` : 'var(--border)',
                            background: cfg.paperWidth === w ? `rgba(${accentColor},0.12)` : 'transparent',
                            color: cfg.paperWidth === w ? `rgb(${accentColor})` : 'var(--text)',
                            fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit',
                        }}>{w}</button>
                    ))}
                </div>
                {/* Copies */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {([1, 2] as const).map(n => (
                        <button key={n} onClick={() => update({ copies: n })} style={{
                            width: 30, height: 30, borderRadius: 7, border: '1.5px solid',
                            borderColor: cfg.copies === n ? `rgb(${accentColor})` : 'var(--border)',
                            background: cfg.copies === n ? `rgba(${accentColor},0.12)` : 'transparent',
                            color: cfg.copies === n ? `rgb(${accentColor})` : 'var(--text)',
                            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
                        }}>{n}</button>
                    ))}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>สำเนา</span>
                </div>
                {/* Auto-cut */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>✂️ ตัดกระดาษ</span>
                    <Toggle val={cfg.autoCut} onChange={v => update({ autoCut: v })} />
                </div>
            </div>

            {/* Test buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onClick={testTCP}
                    disabled={testing || !cfg.enabled}
                    style={{
                        flex: 1, minHeight: 36, borderRadius: 9, border: 'none',
                        background: !cfg.enabled ? '#E5E7EB' : `rgba(${accentColor},0.9)`,
                        color: !cfg.enabled ? '#9CA3AF' : '#fff',
                        fontWeight: 700, fontSize: '0.78rem', cursor: !cfg.enabled ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                >
                    {testing ? '⏳ กำลังส่ง...' : '🖨️ ทดสอบ TCP'}
                </button>
                <button
                    onClick={testBrowser}
                    style={{
                        minHeight: 36, borderRadius: 9, border: '1.5px solid var(--border)',
                        background: 'var(--bg)', color: 'var(--text)',
                        fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                        fontFamily: 'inherit', padding: '0 12px',
                    }}
                >
                    🌐 Browser
                </button>
            </div>
        </div>
    )
}

// ─── Printer Settings Card (wrapper รวม 3 stations) ──────────────────────
function PrinterSettingsCard() {
    return (
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.01)' }}>
            <h2 style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🖨️</span> ตั้งค่าเครื่องพิมพ์ (Multi-Printer)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
                แต่ละ station ตั้ง IP แยกกัน — รองรับ WiFi &amp; LAN ในเครื่องเดียวกัน · บันทึก per-device (localStorage)
            </p>

            {/* 3 station cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StationPrinterCard
                    stationKey="kitchenPrinter"
                    stationType="KITCHEN"
                    label="เครื่องปริ้นครัว"
                    icon="🍳"
                    accentColor="234,88,12"
                />
                <StationPrinterCard
                    stationKey="barPrinter"
                    stationType="BAR"
                    label="เครื่องปริ้นบาร์"
                    icon="🍹"
                    accentColor="37,99,235"
                />
                <StationPrinterCard
                    stationKey="receiptPrinter"
                    stationType="RECEIPT"
                    label="เครื่องปริ้นใบเสร็จ"
                    icon="🧾"
                    accentColor="5,150,105"
                />
            </div>

            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(245,158,11,0.06)', borderRadius: 8, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                ⚠️ <strong>ต้องอยู่ network เดียวกัน</strong> — เซิร์ฟเวอร์ส่ง TCP ไปที่ IP:Port โดยตรง<br />
                💡 ถ้า TCP ล้มเหลว ระบบจะ fallback เป็น Browser print อัตโนมัติ
            </div>
        </div>
    )
}



// ─── Module-level constants ───────────────────────────────────────────────
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
        { icon: '🧾', label: 'คำสั่งซื้อ POS', key: 'orders' },
        { icon: '📋', label: 'รายการสินค้าในออเดอร์', key: 'orderItems' },
        { icon: '💳', label: 'การชำระเงิน', key: 'payments' },
        { icon: '🚚', label: 'ข้อมูล Delivery', key: 'deliveryInfos' },
        { icon: '📦', label: 'การเคลื่อนไหวสต็อค', key: 'movements' },
        { icon: '🛒', label: 'ใบสั่งซื้อ (PO)', key: 'purchaseOrders' },
        { icon: '🔄', label: 'โอนย้ายสินค้า', key: 'stockTransfers' },
        { icon: '📝', label: 'ปรับปรุงสต็อค', key: 'stockAdjustments' },
        { icon: '📊', label: 'นับสต็อค', key: 'stockCounts' },
        { icon: '🍳', label: 'บันทึกแปรรูป', key: 'prepProductions' },
        { icon: '📥', label: 'Import ยอดขาย', key: 'salesImports' },
        { icon: '🏷️', label: 'คิว SKU', key: 'skuSuggestions' },
        { icon: '🤖', label: 'AI/Validation', key: 'aiRecommendations' },
        { icon: '📈', label: 'ยอดสต็อค → 0', key: 'inventoryReset' },
        { icon: '🪑', label: 'โต๊ะ → ว่าง', key: 'tablesReset' },
    ]

    const willKeep = [
        '🥩 สินค้า / วัตถุดิบ',
        '🏷️ หมวดหมู่',
        '👤 บัญชีผู้ใช้',
        '📋 สูตรอาหาร (BOM)',
        '🍳 สูตรแปรรูป (Prep Recipe)',
        '📍 คลังสินค้า',
        '🏢 Supplier',
        '🪑 โต๊ะ (เก็บไว้ set เป็นว่าง)',
    ]

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}
            onClick={step === 'running' ? undefined : onClose}>
            <div style={{ background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ height: 4, background: step === 'done' ? '#16a34a' : '#DC2626', flexShrink: 0 }} />
                <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto' }}>

                    {step === 'confirm' && (<>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <span style={{ fontSize: '1.8rem' }}>🧹</span>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#DC2626' }}>รีเซ็ตข้อมูลทดสอบ</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>ล้างธุรกรรมทั้งหมด — ยังคง master data ไว้</div>
                            </div>
                        </div>

                        <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', marginBottom: 10, border: '1px solid #FECACA' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#DC2626', marginBottom: 6 }}>❌ จะถูกลบ / รีเซ็ต</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px 12px' }}>
                                {willClear.map(w => <div key={w.key} style={{ fontSize: '0.75rem', color: '#7F1D1D', lineHeight: 1.6 }}>{w.icon} {w.label}</div>)}
                            </div>
                        </div>

                        <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '10px 14px', marginBottom: 14, border: '1px solid #BBF7D0' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', marginBottom: 6 }}>✅ ยังคงไว้</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px 12px' }}>
                                {willKeep.map(w => <div key={w} style={{ fontSize: '0.75rem', color: '#065F46', lineHeight: 1.6 }}>{w}</div>)}
                            </div>
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
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>กรุณารอสักครู่ (อาจใช้เวลา 10-30 วินาที)</div>
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
                                {willClear.filter(w => (result[w.key] ?? 0) > 0).map(w => (
                                    <div key={w.key} style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16a34a' }}>{result[w.key] ?? 0}</div>
                                        <div style={{ fontSize: '0.6rem', color: '#047857', fontWeight: 600, marginTop: 2 }}>{w.icon} {w.label}</div>
                                    </div>
                                ))}
                            </div>
                            {willClear.filter(w => (result[w.key] ?? 0) === 0).length > 0 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>
                                    {willClear.filter(w => (result[w.key] ?? 0) === 0).map(w => w.label).join(', ')} — ไม่มีข้อมูลที่ต้องลบ
                                </div>
                            )}
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

                {/* ── Delivery Link ── */}
                <DeliveryLinkCard />

                {/* ── QR Banking ── */}
                <QrBankingCard />

                {/* ── Payment Config ── */}
                <PaymentConfigCard />

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

                {/* ── Notification Test ── */}
                <NotificationTestCard />

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
