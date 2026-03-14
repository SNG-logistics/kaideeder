'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Column schema per model ────────────────────────────────────────
type ColType = 'id' | 'text' | 'number' | 'boolean' | 'select' | 'date' | 'relation' | 'color'
type ColDef = { key: string; label: string; type: ColType; options?: string[]; width?: number; readOnly?: boolean }

const SCHEMA: Record<string, ColDef[]> = {
    tenant: [
        { key: 'id',          label: 'ID',          type: 'id',     width: 110, readOnly: true },
        { key: 'code',        label: 'Code',        type: 'text',   width: 100 },
        { key: 'name',        label: 'Name',        type: 'text',   width: 180 },
        { key: 'displayName', label: 'Display',     type: 'text',   width: 180 },
        { key: 'status',      label: 'Status',      type: 'select', width: 110, options: ['ACTIVE','INACTIVE','SUSPENDED'] },
        { key: 'currency',    label: 'Currency',    type: 'select', width: 90,  options: ['LAK','THB','USD'] },
        { key: 'language',    label: 'Lang',        type: 'select', width: 80,  options: ['th','lo','en','both'] },
        { key: 'phone',       label: 'Phone',       type: 'text',   width: 120 },
        { key: 'subEndsAt',   label: 'Sub Ends',    type: 'date',   width: 120 },
        { key: 'createdAt',   label: 'Created',     type: 'date',   width: 120, readOnly: true },
    ],
    user: [
        { key: 'id',       label: 'ID',       type: 'id',     width: 110, readOnly: true },
        { key: 'tenantId', label: 'Tenant',   type: 'relation', width: 110, readOnly: true },
        { key: 'username', label: 'Username', type: 'text',   width: 140 },
        { key: 'name',     label: 'Full Name',type: 'text',   width: 160 },
        { key: 'role',     label: 'Role',     type: 'select', width: 110, options: ['OWNER','MANAGER','CASHIER','KITCHEN','VIEWER'] },
        { key: 'isActive', label: 'Active',   type: 'boolean',width: 70 },
        { key: 'createdAt',label: 'Created',  type: 'date',   width: 120, readOnly: true },
    ],
    category: [
        { key: 'id',       label: 'ID',       type: 'id',     width: 110, readOnly: true },
        { key: 'tenantId', label: 'Tenant',   type: 'relation', width: 110, readOnly: true },
        { key: 'code',     label: 'Code',     type: 'text',   width: 90 },
        { key: 'name',     label: 'Name',     type: 'text',   width: 160 },
        { key: 'nameEn',   label: 'Name EN',  type: 'text',   width: 140 },
        { key: 'color',    label: 'Color',    type: 'color',  width: 90 },
        { key: 'icon',     label: 'Icon',     type: 'text',   width: 60 },
        { key: 'isActive', label: 'Active',   type: 'boolean',width: 70 },
    ],
    diningtable: [
        { key: 'id',       label: 'ID',       type: 'id',     width: 110, readOnly: true },
        { key: 'tenantId', label: 'Tenant',   type: 'relation', width: 110, readOnly: true },
        { key: 'number',   label: 'No.',      type: 'number', width: 60 },
        { key: 'name',     label: 'Name',     type: 'text',   width: 100 },
        { key: 'zone',     label: 'Zone',     type: 'text',   width: 120 },
        { key: 'seats',    label: 'Seats',    type: 'number', width: 60 },
        { key: 'status',   label: 'Status',   type: 'select', width: 110, options: ['AVAILABLE','OCCUPIED','RESERVED','INACTIVE'] },
        { key: 'isActive', label: 'Active',   type: 'boolean',width: 70 },
    ],
    product: [
        { key: 'id',         label: 'ID',       type: 'id',     width: 110, readOnly: true },
        { key: 'tenantId',   label: 'Tenant',   type: 'relation', width: 110, readOnly: true },
        { key: 'name',       label: 'Name',     type: 'text',   width: 200 },
        { key: 'nameEn',     label: 'Name EN',  type: 'text',   width: 160 },
        { key: 'sku',        label: 'SKU',      type: 'text',   width: 110 },
        { key: 'unit',       label: 'Unit',     type: 'text',   width: 70 },
        { key: 'costPrice',  label: 'Cost',     type: 'number', width: 90 },
        { key: 'price',      label: 'Price',    type: 'number', width: 90 },
        { key: 'isActive',   label: 'Active',   type: 'boolean',width: 70 },
        { key: 'createdAt',  label: 'Created',  type: 'date',   width: 120, readOnly: true },
    ],
    order: [
        { key: 'id',        label: 'ID',       type: 'id',     width: 110, readOnly: true },
        { key: 'tenantId',  label: 'Tenant',   type: 'relation', width: 110, readOnly: true },
        { key: 'status',    label: 'Status',   type: 'select', width: 110, options: ['OPEN','CLOSED','CANCELLED','PENDING'] },
        { key: 'total',     label: 'Total',    type: 'number', width: 100, readOnly: true },
        { key: 'note',      label: 'Note',     type: 'text',   width: 200 },
        { key: 'createdAt', label: 'Created',  type: 'date',   width: 120, readOnly: true },
    ],
}

// ── Status colors ──────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
    ACTIVE: '#34d399', INACTIVE: '#f87171', SUSPENDED: '#fbbf24',
    AVAILABLE: '#34d399', OCCUPIED: '#f87171', RESERVED: '#fbbf24',
    OPEN: '#60a5fa', CLOSED: '#64748b', CANCELLED: '#f87171', PENDING: '#fbbf24',
    OWNER: '#a78bfa', MANAGER: '#60a5fa', CASHIER: '#34d399', KITCHEN: '#fbbf24', VIEWER: '#64748b',
}

function fmtDate(v: any) {
    if (!v) return '—'
    try { return new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) } catch { return String(v) }
}

// ── Cell renderer / editor ─────────────────────────────────────────
function Cell({ col, value, onChange, active, onActivate, rowChanged }: {
    col: ColDef; value: any; onChange: (v: any) => void
    active: boolean; onActivate: () => void; rowChanged: boolean
}) {
    const ref = useRef<HTMLInputElement | HTMLSelectElement>(null)
    useEffect(() => { if (active && ref.current && !col.readOnly) ref.current.focus() }, [active])

    const base: React.CSSProperties = {
        display: 'flex', alignItems: 'center', height: '100%',
        padding: '0 10px', fontSize: '0.75rem', cursor: col.readOnly ? 'default' : 'pointer',
        minWidth: col.width ?? 120, maxWidth: col.width ?? 120, overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        background: active && !col.readOnly ? 'rgba(37,99,235,0.12)' : 'transparent',
        boxSizing: 'border-box',
        outline: active && !col.readOnly ? '2px solid rgba(37,99,235,0.5)' : 'none',
        outlineOffset: '-1px',
    }

    const inputStyle: React.CSSProperties = {
        width: '100%', background: 'none', border: 'none', outline: 'none',
        color: '#e2e8f0', fontSize: '0.75rem', fontFamily: 'inherit', padding: 0,
    }

    if (col.type === 'id') return (
        <div style={{ ...base, cursor: 'default' }} title={String(value ?? '')}>
            <span style={{ color: '#374151', fontFamily: 'monospace', fontSize: '0.68rem' }}>
                {String(value ?? '').slice(0, 10)}…
            </span>
        </div>
    )

    if (col.type === 'relation') return (
        <div style={{ ...base, cursor: 'default' }} title={String(value ?? '')}>
            <span style={{ color: '#2563eb', fontFamily: 'monospace', fontSize: '0.68rem' }}>
                {String(value ?? '').slice(0, 10)}…
            </span>
        </div>
    )

    if (col.type === 'boolean') return (
        <div style={{ ...base, justifyContent: 'center' }}>
            <div onClick={() => !col.readOnly && onChange(!value)} style={{
                width: 32, height: 18, borderRadius: 9, cursor: col.readOnly ? 'default' : 'pointer',
                background: value ? '#2563eb' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
                <div style={{ position: 'absolute', top: 2, left: value ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
        </div>
    )

    if (col.type === 'color') return (
        <div style={{ ...base }} onClick={onActivate}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: value || '#374151', border: '1px solid rgba(255,255,255,0.1)', marginRight: 6, flexShrink: 0 }} />
            {active ? <input ref={ref as any} value={value ?? ''} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, width: 70 }} /> : <span style={{ color: '#e2e8f0' }}>{value || '—'}</span>}
        </div>
    )

    if (col.type === 'select') {
        const color = STATUS_COLOR[value] || '#94a3b8'
        if (!active || col.readOnly) return (
            <div style={{ ...base }} onClick={onActivate}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: color + '20', color }}>{value || '—'}</span>
            </div>
        )
        return (
            <div style={{ ...base }}>
                <select ref={ref as any} value={value ?? ''} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {col.options?.map(o => <option key={o} value={o} style={{ background: '#0d1220' }}>{o}</option>)}
                </select>
            </div>
        )
    }

    if (col.type === 'date') return (
        <div style={{ ...base }} title={String(value ?? '')}>
            <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{fmtDate(value)}</span>
        </div>
    )

    // text / number
    if (!active || col.readOnly) return (
        <div style={{ ...base, whiteSpace: 'nowrap', overflow: 'hidden' }} onClick={() => !col.readOnly && onActivate()} title={String(value ?? '')}>
            <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{value ?? '—'}</span>
        </div>
    )
    return (
        <div style={{ ...base }}>
            <input ref={ref as any} value={value ?? ''} onChange={e => onChange(e.target.value)} style={inputStyle} />
        </div>
    )
}

// ── Main grid ──────────────────────────────────────────────────────
const PAGE_SIZE = 50

export default function PrismaGridClient({ modelKey }: { modelKey: string }) {
    const router = useRouter()
    const cols = SCHEMA[modelKey] ?? []
    const [records, setRecords] = useState<any[]>([])
    const [edits, setEdits] = useState<Record<string, Record<string, any>>>({})  // { id: { field: newVal } }
    const [saving, setSaving] = useState<Record<string, boolean>>({})
    const [deleted, setDeleted] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(0)
    const [activeCell, setActiveCell] = useState<{ rowId: string; colKey: string } | null>(null)
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
    const [sortCol, setSortCol] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    useEffect(() => {
        setLoading(true)
        fetch(`/api/admin/db-list/${modelKey}`)
            .then(r => r.json()).then(d => { setRecords(d.records || []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [modelKey])

    const showToast = (msg: string, ok: boolean) => {
        setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
    }

    const getValue = (record: any, key: string) =>
        edits[record.id]?.[key] !== undefined ? edits[record.id][key] : record[key]

    const setCellValue = (id: string, key: string, val: any) =>
        setEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), [key]: val } }))

    const rowHasChanges = (id: string) => !!edits[id] && Object.keys(edits[id]).length > 0

    async function saveRow(id: string) {
        const changes = edits[id]
        if (!changes || Object.keys(changes).length === 0) return
        setSaving(prev => ({ ...prev, [id]: true }))
        try {
            const res = await fetch(`/api/admin/db-list/${modelKey}/${id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes),
            })
            if (res.ok) {
                const json = await res.json()
                setRecords(prev => prev.map(r => r.id === id ? json.record : r))
                setEdits(prev => { const n = { ...prev }; delete n[id]; return n })
                showToast('Saved ✓', true)
            } else {
                const json = await res.json()
                showToast(json.error || 'Save failed', false)
            }
        } catch { showToast('Network error', false) }
        setSaving(prev => ({ ...prev, [id]: false }))
    }

    async function deleteRow(id: string) {
        if (!confirm('Delete this record?')) return
        try {
            const res = await fetch(`/api/admin/db-list/${modelKey}/${id}`, { method: 'DELETE' })
            if (res.ok) setDeleted(prev => new Set([...prev, id]))
            else showToast((await res.json()).error || 'Failed', false)
        } catch { showToast('Error', false) }
    }

    // Sort & filter
    let rows = records.filter(r => !deleted.has(r.id))
    if (search) {
        const s = search.toLowerCase()
        rows = rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(s)))
    }
    if (sortCol) {
        rows = [...rows].sort((a, b) => {
            const av = String(a[sortCol] ?? ''), bv = String(b[sortCol] ?? '')
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
        })
    }
    const total = rows.length
    const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    function toggleSort(key: string) {
        if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortCol(key); setSortDir('asc') }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, padding: '8px 16px', borderRadius: 9, fontWeight: 600, fontSize: '0.8rem', background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, color: toast.ok ? '#34d399' : '#f87171', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                    {toast.msg}
                </div>
            )}

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 10px' }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search all fields…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '0.8rem', fontFamily: 'inherit' }} />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#374151', whiteSpace: 'nowrap' }}>{total} rows</span>
                <Link href={`/admin/database/${modelKey}/new`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: '#2563eb', color: '#fff', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Row
                </Link>
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[1,2,3,4,5].map(i => <div key={i} style={{ height: 36, borderRadius: 4, background: 'rgba(255,255,255,0.03)', animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' }} />)}
                    <style>{`@keyframes shimmer{0%{background-position:200%}100%{background-position:-200%}}`}</style>
                </div>
            )}

            {/* Grid */}
            {!loading && (
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 320px)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                    <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
                        {/* Header */}
                        <thead>
                            <tr style={{ background: '#0a1020', position: 'sticky', top: 0, zIndex: 10 }}>
                                {/* Row number */}
                                <th style={{ width: 36, minWidth: 36, padding: '8px 6px', borderRight: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.65rem', color: '#374151' }}>#</span>
                                </th>
                                {cols.map(col => (
                                    <th key={col.key} style={{ width: col.width, minWidth: col.width, padding: '8px 10px', borderRight: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                        onClick={() => toggleSort(col.key)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: col.readOnly ? '#374151' : '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{col.label}</span>
                                            {sortCol === col.key && <span style={{ fontSize: '0.6rem', color: '#60a5fa' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                                        </div>
                                    </th>
                                ))}
                                {/* Actions col */}
                                <th style={{ width: 100, minWidth: 100, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.length === 0 && (
                                <tr><td colSpan={cols.length + 2} style={{ padding: 40, textAlign: 'center', color: '#374151', fontSize: '0.82rem' }}>
                                    {search ? 'No results matching search' : 'No records yet'}
                                </td></tr>
                            )}
                            {pageRows.map((record, idx) => {
                                const changed = rowHasChanges(record.id)
                                const isSaving = saving[record.id]
                                return (
                                    <tr key={record.id} style={{ background: changed ? 'rgba(37,99,235,0.05)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', borderBottom: '1px solid rgba(255,255,255,0.04)', height: 36 }}
                                        onMouseEnter={e => { if (!changed) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)' }}
                                        onMouseLeave={e => { if (!changed) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}
                                    >
                                        {/* Row number */}
                                        <td style={{ width: 36, minWidth: 36, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.04)', color: '#334155', fontSize: '0.65rem', padding: '0 4px' }}>
                                            {page * PAGE_SIZE + idx + 1}
                                        </td>
                                        {cols.map(col => (
                                            <td key={col.key} style={{ padding: 0, height: 36 }} onDoubleClick={() => !col.readOnly && setActiveCell({ rowId: record.id, colKey: col.key })}>
                                                <Cell
                                                    col={col}
                                                    value={getValue(record, col.key)}
                                                    onChange={v => setCellValue(record.id, col.key, v)}
                                                    active={activeCell?.rowId === record.id && activeCell?.colKey === col.key}
                                                    onActivate={() => !col.readOnly && setActiveCell({ rowId: record.id, colKey: col.key })}
                                                    rowChanged={changed}
                                                />
                                            </td>
                                        ))}
                                        {/* Actions */}
                                        <td style={{ padding: '0 8px', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', gap: 5 }}>
                                                {changed && (
                                                    <button onClick={() => saveRow(record.id)} disabled={isSaving} style={{ padding: '3px 8px', borderRadius: 5, border: 'none', background: '#2563eb', color: '#fff', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                                        {isSaving ? '…' : '💾'}
                                                    </button>
                                                )}
                                                {changed && (
                                                    <button onClick={() => setEdits(prev => { const n = { ...prev }; delete n[record.id]; return n })} style={{ padding: '3px 6px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#64748b', fontSize: '0.68rem', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                                                )}
                                                <Link href={`/admin/database/${modelKey}/${record.id}`} style={{ padding: '3px 7px', borderRadius: 5, border: '1px solid rgba(37,99,235,0.2)', background: 'rgba(37,99,235,0.08)', color: '#93c5fd', fontSize: '0.68rem', textDecoration: 'none' }}>⤢</Link>
                                                <button onClick={() => deleteRow(record.id)} style={{ padding: '3px 6px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: '0.68rem', cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!loading && total > PAGE_SIZE && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', justifyContent: 'center' }}>
                    <button onClick={() => setPage(0)} disabled={page === 0} style={pgBtn}>«</button>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={pgBtn}>‹</button>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
                    <button onClick={() => setPage(p => Math.min(Math.ceil(total / PAGE_SIZE) - 1, p + 1))} disabled={page >= Math.ceil(total / PAGE_SIZE) - 1} style={pgBtn}>›</button>
                    <button onClick={() => setPage(Math.ceil(total / PAGE_SIZE) - 1)} disabled={page >= Math.ceil(total / PAGE_SIZE) - 1} style={pgBtn}>»</button>
                </div>
            )}

            {/* Changed rows summary */}
            {Object.keys(edits).length > 0 && (
                <div style={{ padding: '8px 14px', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, fontSize: '0.75rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>⚠️ {Object.keys(edits).length} row(s) with unsaved changes — click 💾 to save each row</span>
                    <button onClick={() => setEdits({})} style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(37,99,235,0.3)', background: 'transparent', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>Discard all</button>
                </div>
            )}
        </div>
    )
}

const pgBtn: React.CSSProperties = {
    padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.03)', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
}
