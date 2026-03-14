'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Field definitions per model ────────────────────────────────────
type FieldDef = {
    key: string
    label: string
    type: 'text' | 'email' | 'select' | 'textarea' | 'boolean' | 'readonly' | 'date'
    options?: string[]
    readOnly?: boolean
    hint?: string
}

const FIELDS: Record<string, FieldDef[]> = {
    tenant: [
        { key: 'id', label: 'ID', type: 'readonly' },
        { key: 'code', label: 'Store Code', type: 'text', hint: 'Unique identifier (e.g. store-001)' },
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'displayName', label: 'Display Name', type: 'text' },
        { key: 'storeNameLao', label: 'Lao Name', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
        { key: 'currency', label: 'Currency', type: 'select', options: ['LAK', 'THB', 'USD'] },
        { key: 'language', label: 'Language', type: 'select', options: ['th', 'lo', 'en', 'both'] },
        { key: 'phone', label: 'Phone', type: 'text' },
        { key: 'address', label: 'Address', type: 'textarea' },
        { key: 'taxId', label: 'Tax ID', type: 'text' },
        { key: 'timezone', label: 'Timezone', type: 'text' },
        { key: 'subEndsAt', label: 'Subscription Ends', type: 'date' },
        { key: 'createdAt', label: 'Created At', type: 'readonly' },
        { key: 'updatedAt', label: 'Updated At', type: 'readonly' },
    ],
    user: [
        { key: 'id', label: 'ID', type: 'readonly' },
        { key: 'tenantId', label: 'Tenant ID', type: 'readonly' },
        { key: 'username', label: 'Username', type: 'text' },
        { key: 'name', label: 'Full Name', type: 'text' },
        { key: 'role', label: 'Role', type: 'select', options: ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'VIEWER'] },
        { key: 'isActive', label: 'Active', type: 'boolean' },
        { key: 'createdAt', label: 'Created At', type: 'readonly' },
        { key: 'updatedAt', label: 'Updated At', type: 'readonly' },
    ],
    product: [
        { key: 'id', label: 'ID', type: 'readonly' },
        { key: 'tenantId', label: 'Tenant ID', type: 'readonly' },
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'nameEn', label: 'Name (EN)', type: 'text' },
        { key: 'sku', label: 'SKU', type: 'text' },
        { key: 'barcode', label: 'Barcode', type: 'text' },
        { key: 'unit', label: 'Unit', type: 'text' },
        { key: 'costPrice', label: 'Cost Price', type: 'text' },
        { key: 'price', label: 'Price', type: 'text' },
        { key: 'isActive', label: 'Active', type: 'boolean' },
        { key: 'createdAt', label: 'Created At', type: 'readonly' },
    ],
    order: [
        { key: 'id', label: 'ID', type: 'readonly' },
        { key: 'tenantId', label: 'Tenant ID', type: 'readonly' },
        { key: 'status', label: 'Status', type: 'select', options: ['OPEN', 'CLOSED', 'CANCELLED', 'PENDING'] },
        { key: 'total', label: 'Total', type: 'readonly' },
        { key: 'note', label: 'Note', type: 'textarea' },
        { key: 'createdAt', label: 'Created At', type: 'readonly' },
    ],
}

const C = {
    card: '#0d1220', border: 'rgba(255,255,255,0.07)', accent: '#2563eb',
    text: '#e2e8f0', textMuted: '#64748b', error: '#f87171', success: '#34d399',
}

function formatReadonly(val: any): string {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
        return new Date(val).toLocaleString('th-TH')
    }
    return String(val)
}

// ── Single field renderer ──────────────────────────────────────────
function Field({ def, value, onChange }: { def: FieldDef; value: any; onChange: (v: any) => void }) {
    const inputStyle = {
        width: '100%', padding: '8px 12px', borderRadius: 8, boxSizing: 'border-box' as const,
        background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
        color: C.text, fontSize: '0.83rem', fontFamily: 'inherit', outline: 'none',
        transition: 'border-color 0.15s',
    }

    if (def.type === 'readonly') {
        return (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.04)`, color: C.textMuted, fontSize: '0.78rem', fontFamily: 'monospace', wordBreak: 'break-all' as const }}>
                {formatReadonly(value)}
            </div>
        )
    }
    if (def.type === 'boolean') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                    onClick={() => onChange(!value)}
                    style={{
                        width: 40, height: 22, borderRadius: 11, cursor: 'pointer', transition: 'background 0.2s',
                        background: value ? C.accent : 'rgba(255,255,255,0.1)',
                        position: 'relative',
                    }}
                >
                    <div style={{
                        position: 'absolute', top: 3, left: value ? 20 : 3,
                        width: 16, height: 16, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }} />
                </div>
                <span style={{ color: value ? C.success : C.textMuted, fontSize: '0.78rem', fontWeight: 600 }}>
                    {value ? 'Active' : 'Inactive'}
                </span>
            </div>
        )
    }
    if (def.type === 'select') {
        return (
            <select value={value ?? ''} onChange={e => onChange(e.target.value)} style={{
                ...inputStyle, appearance: 'auto', cursor: 'pointer',
            }}>
                {def.options?.map(o => <option key={o} value={o} style={{ background: '#0d1220' }}>{o}</option>)}
            </select>
        )
    }
    if (def.type === 'textarea') {
        return (
            <textarea
                rows={3} value={value ?? ''} onChange={e => onChange(e.target.value)}
                style={{ ...inputStyle, resize: 'vertical' as const, lineHeight: 1.5 }}
            />
        )
    }
    // text / email / date
    return (
        <input
            type={def.type === 'date' ? 'datetime-local' : 'text'}
            value={def.type === 'date' && value ? value.slice(0, 16) : (value ?? '')}
            onChange={e => onChange(e.target.value)}
            onFocus={e => (e.target.style.borderColor = 'rgba(37,99,235,0.6)')}
            onBlur={e => (e.target.style.borderColor = C.border)}
            style={inputStyle}
        />
    )
}

// ── Main Edit Form ─────────────────────────────────────────────────
export default function RecordEditClient({
    modelKey, recordId,
}: { modelKey: string; recordId: string }) {
    const router = useRouter()
    const fields = FIELDS[modelKey] ?? []
    const [data, setData] = useState<Record<string, any>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
    const isNew = recordId === 'new'

    useEffect(() => {
        if (isNew) { setLoading(false); return }
        fetch(`/api/admin/db-list/${modelKey}/${recordId}`)
            .then(r => r.json())
            .then(d => { if (d.record) setData(d.record); setLoading(false) })
            .catch(() => setLoading(false))
    }, [modelKey, recordId])

    function showToast(msg: string, ok: boolean) {
        setToast({ msg, ok })
        setTimeout(() => setToast(null), 3000)
    }

    async function handleSave() {
        setSaving(true)
        try {
            const url = isNew ? `/api/admin/db-list/${modelKey}` : `/api/admin/db-list/${modelKey}/${recordId}`
            const method = isNew ? 'POST' : 'PATCH'
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
            const json = await res.json()
            if (res.ok) {
                showToast('Saved successfully!', true)
                if (isNew) router.push(`/admin/database/${modelKey}/${json.record.id}`)
            } else {
                showToast(json.error || 'Save failed', false)
            }
        } catch { showToast('Network error', false) }
        setSaving(false)
    }

    async function handleDelete() {
        if (!confirm('Delete this record? This cannot be undone.')) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/db-list/${modelKey}/${recordId}`, { method: 'DELETE' })
            if (res.ok) { router.push(`/admin/database/${modelKey}`) }
            else { showToast((await res.json()).error || 'Delete failed', false) }
        } catch { showToast('Network error', false) }
        setDeleting(false)
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{
                        height: 56, borderRadius: 10,
                        background: 'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.03) 75%)',
                        backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
                    }} />
                ))}
                <style>{`@keyframes shimmer{0%{background-position:200%}100%{background-position:-200%}}`}</style>
            </div>
        )
    }

    // Group fields: readonly last
    const editFields = fields.filter(f => f.type !== 'readonly')
    const readonlyFields = fields.filter(f => f.type === 'readonly')

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: '0.82rem',
                    background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: toast.ok ? '#34d399' : '#f87171',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>{toast.ok ? '✅' : '❌'} {toast.msg}</div>
            )}

            {/* Edit fields card */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.text }}>Editable Fields</span>
                </div>
                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                    {editFields.map(def => (
                        <div key={def.key}>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                                {def.label}
                                {def.hint && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6, color: '#374151' }}>— {def.hint}</span>}
                            </label>
                            <Field def={def} value={data[def.key]} onChange={v => setData(prev => ({ ...prev, [def.key]: v }))} />
                        </div>
                    ))}
                </div>

                {/* Action buttons */}
                <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={handleSave} disabled={saving} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 22px', borderRadius: 9, border: 'none',
                        background: C.accent, color: '#fff', fontWeight: 600, fontSize: '0.83rem',
                        cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                        fontFamily: 'inherit', transition: 'opacity 0.15s',
                    }}>
                        {saving ? '⏳ Saving…' : '💾 Save Changes'}
                    </button>
                    <button onClick={() => router.back()} style={{
                        padding: '8px 16px', borderRadius: 9, border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.textMuted, fontWeight: 500, fontSize: '0.83rem',
                        cursor: 'pointer', fontFamily: 'inherit',
                    }}>← Back</button>
                    {!isNew && (
                        <button onClick={handleDelete} disabled={deleting} style={{
                            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.25)',
                            background: 'rgba(239,68,68,0.06)', color: C.error, fontWeight: 500, fontSize: '0.83rem',
                            cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                        }}>
                            {deleting ? '⏳ Deleting…' : '🗑 Delete Record'}
                        </button>
                    )}
                </div>
            </div>

            {/* Readonly / metadata card */}
            {readonlyFields.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.textMuted }}>Read-only Metadata</span>
                    </div>
                    <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '12px' }}>
                        {readonlyFields.map(def => (
                            <div key={def.key}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{def.label}</div>
                                <Field def={def} value={data[def.key]} onChange={() => { }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
