'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────────
interface InventoryItem {
  id: string; code: string; name: string
  itemRole: string; itemKind: string; categoryKey?: string
  baseUnit: string; purchaseUnit?: string; status: string
  aiConfidence?: number; aiStatus?: string
  _count?: { issues: number }
  conversions: { fromUnit: string; toUnit: string; ratio: number }[]
}
interface AiSuggestion {
  item_role?: string | null; item_kind?: string | null; category_key?: string | null
  protein_family?: string | null; cut_part?: string | null; form_state?: string | null
  base_unit?: string | null; purchase_unit?: string | null; code?: string | null
}
interface Duplicate { item_id: string; name: string; score: number; match_type: string }

const ROLE_LABELS: Record<string, string> = { RAW: '🥩 วัตถุดิบ', PREP: '🍲 เตรียม', SUPPLY: '📦 วัสดุ', SERVICE: '🎭 บริการ' }
const KIND_LABELS: Record<string, string> = { INGREDIENT: 'วัตถุดิบ', SEMI_FINISHED: 'กึ่งสำเร็จ', NON_STOCK: 'ไม่นับสต็อก' }
const STATUS_COLORS: Record<string, string> = { DRAFT: '#6B7280', NEED_REVIEW: '#D97706', ACTIVE: '#059669', ARCHIVED: '#9CA3AF' }

function ConfidenceBadge({ score }: { score?: number }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const color = pct >= 85 ? '#059669' : pct >= 60 ? '#D97706' : '#DC2626'
  const bg = pct >= 85 ? '#ECFDF5' : pct >= 60 ? '#FFFBEB' : '#FEF2F2'
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px',
      borderRadius: 20, background: bg, color, border: `1px solid ${color}30`,
      whiteSpace: 'nowrap',
    }}>🤖 {pct}%</span>
  )
}

// ─── Add Item Form Modal ──────────────────────────────────────────────
function AddItemModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [duplicates, setDuplicates] = useState<Duplicate[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [form, setForm] = useState({
    itemRole: '', itemKind: 'INGREDIENT', categoryKey: '',
    baseUnit: '', purchaseUnit: '', code: '',
    trackStock: true, isPurchasable: true, isSellable: false,
  })
  const [conversions, setConversions] = useState<{ fromUnit: string; toUnit: string; ratio: string }[]>([])
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced AI classify on name change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (name.trim().length < 2) {
      setSuggestion(null); setDuplicates([]); setWarnings([]); return
    }
    debounceRef.current = setTimeout(async () => {
      setAiLoading(true)
      try {
        const res = await fetch('/api/items/ai-classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        const j = await res.json()
        if (j.success) {
          setSuggestion(j.data.suggested)
          setConfidence(j.data.confidence)
          setDuplicates(j.data.duplicates ?? [])
          setWarnings(j.data.warnings ?? [])
        }
      } catch { /* silent */ } finally { setAiLoading(false) }
    }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [name])

  function applySuggestion() {
    if (!suggestion) return
    setForm(f => ({
      ...f,
      itemRole: suggestion.item_role ?? f.itemRole,
      itemKind: 'INGREDIENT',
      categoryKey: suggestion.category_key ?? f.categoryKey,
      baseUnit: suggestion.base_unit ?? f.baseUnit,
      purchaseUnit: suggestion.purchase_unit ?? f.purchaseUnit,
      code: suggestion.code ?? f.code,
    }))
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('กรุณาระบุชื่อรายการ'); return }
    if (!form.itemRole) { toast.error('กรุณาเลือกประเภทรายการ'); return }
    if (!form.baseUnit) { toast.error('กรุณาระบุหน่วยฐาน'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, ...form,
          aiConfidence: confidence,
          code: form.code || undefined,
        }),
      })
      const j = await res.json()
      if (!j.success) { toast.error(j.error || 'บันทึกไม่สำเร็จ'); setSaving(false); return }

      const itemId = j.data.item.id
      // Save conversions
      for (const c of conversions) {
        if (!c.fromUnit || !c.toUnit || !c.ratio) continue
        await fetch(`/api/items/${itemId}/conversions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromUnit: c.fromUnit, toUnit: c.toUnit, ratio: parseFloat(c.ratio) }),
        })
      }
      toast.success('บันทึกรายการเรียบร้อย')
      onSaved()
    } catch { toast.error('เกิดข้อผิดพลาด') } finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: '1rem', backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease-out'
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 24, width: '100%', maxWidth: 760,
        boxShadow: '0 20px 60px rgba(0,0,0,0.1), 0 0 0 1px rgba(226, 232, 240, 0.8)', maxHeight: '90vh', overflowY: 'auto',
        animation: 'slideUpReflow 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, borderBottom: '1px solid #F1F5F9', padding: '1.5rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', border: '1px solid #E2E8F0' }}>
                🧺
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>เพิ่มรายการวัตถุดิบใหม่</h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748B' }}>ระบบ AI จะช่วยแนะนำหมวดหมู่และหน่วยให้อัตโนมัติ</p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: '#F8FAFC', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748B', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#F1F5F9'} onMouseOut={e=>e.currentTarget.style.background='#F8FAFC'}>✕</button>
          </div>
        </div>
        
        <div style={{ padding: '1.5rem' }}>

          {/* Name input with AI trigger */}
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>ชื่อรายการ / วัตถุดิบ <span style={{color: '#EF4444'}}>*</span></label>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="เช่น หมูสามชั้นสด, อกไก่, ไข่ไก่..."
              style={{
                width: '100%', padding: '14px 44px 14px 16px', borderRadius: 12,
                border: '1px solid #E2E8F0', fontSize: '1rem', color: '#0F172A',
                fontFamily: 'inherit', background: '#F8FAFC', boxSizing: 'border-box',
                outline: 'none', transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = '#6366F1'; e.target.style.background = 'white'; e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)' }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.background = '#F8FAFC'; e.target.style.boxShadow = 'none' }}
            />
            {aiLoading && (
              <div style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                width: 20, height: 20, border: '3px solid #E2E8F0',
                borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.7s linear infinite',
              }} />
            )}
          </div>

          {/* AI Suggest Panel */}
          {suggestion && !aiLoading && (
            <div style={{
              background: 'linear-gradient(to right, #F0FDF4, #ECFDF5)', border: '1px solid #A7F3D0',
              borderRadius: 16, padding: '16px', marginBottom: 20, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>🤖</div>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#064E3B' }}>AI แนะนำข้อมูล</span>
                  <ConfidenceBadge score={confidence ?? undefined} />
                </div>
                <button onClick={applySuggestion} style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '6px 16px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)', transition: 'transform 0.1s'
                }} onMouseOver={e=>e.currentTarget.style.transform='scale(1.02)'} onMouseOut={e=>e.currentTarget.style.transform='none'}>✓ นำไปใช้</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  ['ประเภท', suggestion.item_role],
                  ['หมวด', suggestion.category_key],
                  ['ส่วน', suggestion.cut_part],
                  ['รูปแบบ', suggestion.form_state],
                  ['หน่วยฐาน', suggestion.base_unit],
                  ['หน่วยซื้อ', suggestion.purchase_unit],
                  ['รหัส', suggestion.code],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <span key={k as string} style={{
                    fontSize: '0.75rem', background: 'white', border: '1px solid #A7F3D0', color: '#065F46',
                    padding: '4px 12px', borderRadius: 20, fontWeight: 600, boxShadow: '0 1px 2px rgba(16, 185, 129, 0.05)'
                  }}>{k}: <strong style={{color: '#047857'}}>{v}</strong></span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div style={{ background: 'linear-gradient(to right, #FFFBEB, #FEF3C7)', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 14px', marginBottom: 20 }}>
              {warnings.map((w, i) => (
                <div key={i} style={{ fontSize: '0.8rem', color: '#B45309', display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 500, marginBottom: i !== warnings.length -1 ? 6 : 0 }}>
                  <span>⚠️</span><span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Duplicate Panel */}
          {duplicates.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #FCD34D', borderRadius: 16, padding: '14px 16px', marginBottom: 20, boxShadow: '0 4px 12px rgba(245, 158, 11, 0.05)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#B45309', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🔎</span> พบรายการที่มีอยู่แล้วในระบบ ({duplicates.length} รายการ)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {duplicates.slice(0, 3).map(d => (
                  <div key={d.item_id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontSize: '0.8rem', color: '#78350F', padding: '8px 12px',
                    background: '#FFFBEB', borderRadius: 8
                  }}>
                    <span style={{ fontWeight: 600 }}>{d.name}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, background: '#FDE68A', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem' }}>
                      {d.match_type} {Math.round(d.score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>ประเภท <span style={{color: '#EF4444'}}>*</span></label>
              <select value={form.itemRole} onChange={e => setForm(f => ({ ...f, itemRole: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: '0.9rem', fontFamily: 'inherit', background: '#F8FAFC', color: '#0F172A', outline: 'none', transition: 'border-color 0.2s', cursor: 'pointer' }}
                onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} >
                <option value="">-- เลือกประเภท --</option>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>ชนิด <span style={{color: '#EF4444'}}>*</span></label>
              <select value={form.itemKind} onChange={e => setForm(f => ({ ...f, itemKind: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: '0.9rem', fontFamily: 'inherit', background: '#F8FAFC', color: '#0F172A', outline: 'none', transition: 'border-color 0.2s', cursor: 'pointer' }}
                onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} >
                {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>หน่วยฐาน <span style={{color: '#EF4444'}}>*</span></label>
              <input value={form.baseUnit} onChange={e => setForm(f => ({ ...f, baseUnit: e.target.value }))}
                placeholder="g, ml, ชิ้น, ฟอง..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: '0.9rem', fontFamily: 'inherit', background: '#F8FAFC', color: '#0F172A', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }} 
                onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>หน่วยซื้อ</label>
              <input value={form.purchaseUnit} onChange={e => setForm(f => ({ ...f, purchaseUnit: e.target.value }))}
                placeholder="kg, ถุง, แพ็ค..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: '0.9rem', fontFamily: 'inherit', background: '#F8FAFC', color: '#0F172A', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }} 
                onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>หมวดหมู่ (Category)</label>
              <input value={form.categoryKey} onChange={e => setForm(f => ({ ...f, categoryKey: e.target.value }))}
                placeholder="MEAT, SEAFOOD, VEGETABLE..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #E2E8F0', fontSize: '0.9rem', fontFamily: 'inherit', background: '#F8FAFC', color: '#0F172A', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }} 
                onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>รหัสรายการ (SKU Code)</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="ระบบจะสร้างให้อัตโนมัติ หากเว้นว่าง"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px dashed #CBD5E1', fontSize: '0.9rem', fontFamily: 'inherit', background: 'white', color: '#0F172A', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' }} 
                onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#CBD5E1'} />
            </div>
          </div>

          {/* Toggle options */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {([
              ['trackStock', '📦 ติดตามสต็อก'],
              ['isPurchasable', '🛒 อนุญาตซื้อเข้า'],
              ['isSellable', '💰 อนุญาตขายได้'],
            ] as [keyof typeof form, string][]).map(([k, label]) => {
              const active = !!form[k]
              return (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, [k]: !f[k] }))}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20,
                    border: `1px solid ${active ? '#6366F1' : '#E2E8F0'}`,
                    background: active ? '#EEF2FF' : '#F8FAFC',
                    color: active ? '#4338CA' : '#64748B',
                    fontFamily: 'inherit', fontWeight: 600, fontSize: '0.82rem',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }} onMouseOver={e=>{if(!active)e.currentTarget.style.background='#F1F5F9'}} onMouseOut={e=>{if(!active)e.currentTarget.style.background='#F8FAFC'}}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: active ? '#6366F1' : 'white', border: `1.5px solid ${active ? '#6366F1' : '#CBD5E1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {active && <span style={{ color: 'white', fontSize: '10px' }}>✓</span>}
                  </div>
                  {label}
                </button>
              )
            })}
          </div>

          {/* Conversion sub-form */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: conversions.length ? 12 : 0 }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', display: 'block' }}>⚖️ การแปลงหน่วย (Unit Conversions)</span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>* จำเป็นเมื่อหน่วยที่รับเข้ามา ไม่ตรงกับหน่วยฐานที่ใช้ในสูตร</span>
              </div>
              <button onClick={() => setConversions(c => [...c, { fromUnit: '', toUnit: '', ratio: '' }])}
                style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, color: '#334155', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                onMouseOver={e=>e.currentTarget.style.borderColor='#CBD5E1'} onMouseOut={e=>e.currentTarget.style.borderColor='#E2E8F0'}>
                + เพิ่มการแปลง
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conversions.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'white', padding: '10px 14px', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <input value={c.fromUnit} placeholder="จาก (เช่น kg)" onChange={e => setConversions(cs => cs.map((x, j) => j === i ? { ...x, fromUnit: e.target.value } : x))}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.85rem', fontFamily: 'inherit', background: '#F8FAFC', outline: 'none' }} onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  <span style={{ color: '#94A3B8', fontSize: '1rem' }}>→</span>
                  <input value={c.toUnit} placeholder="เป็น (เช่น g)" onChange={e => setConversions(cs => cs.map((x, j) => j === i ? { ...x, toUnit: e.target.value } : x))}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.85rem', fontFamily: 'inherit', background: '#F8FAFC', outline: 'none' }} onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  <span style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: 600 }}>คูณด้วย</span>
                  <input value={c.ratio} type="number" placeholder="เช่น 1000" onChange={e => setConversions(cs => cs.map((x, j) => j === i ? { ...x, ratio: e.target.value } : x))}
                    style={{ width: 100, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.85rem', fontFamily: 'inherit', background: '#F8FAFC', outline: 'none' }} onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                  <button onClick={() => setConversions(cs => cs.filter((_, j) => j !== i))}
                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer', color: '#DC2626', width: 34, height: 34, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', transition: 'background 0.2s' }}
                    onMouseOver={e=>e.currentTarget.style.background='#FEE2E2'} onMouseOut={e=>e.currentTarget.style.background='#FEF2F2'}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', background: '#F8FAFC', borderRadius: '0 0 24px 24px', display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button onClick={onClose} style={{
            padding: '10px 24px', borderRadius: 12, border: '1px solid #E2E8F0',
            background: 'white', color: '#475569', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem',
            transition: 'background 0.2s'
          }} onMouseOver={e=>e.currentTarget.style.background='#F1F5F9'} onMouseOut={e=>e.currentTarget.style.background='white'}>ยกเลิก</button>
          
          <button onClick={handleSave} disabled={saving} style={{
            padding: '10px 28px', borderRadius: 12, border: 'none',
            background: saving ? '#94A3B8' : 'linear-gradient(135deg, #10B981, #059669)', color: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem',
            boxShadow: saving ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.3)', transition: 'transform 0.1s, box-shadow 0.2s'
          }} 
          onMouseOver={e=>{if(!saving){e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)'}}} 
          onMouseOut={e=>{if(!saving){e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 14px rgba(16, 185, 129, 0.3)'}}}>
            {saving ? '⏳ กำลังบันทึก...' : '✓ บันทึกรายการ'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function InventoryCatalogPage() {
  useRoleGuard(['owner', 'manager', 'warehouse', 'purchaser'])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [draftCount, setDraftCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (roleFilter) params.set('role', roleFilter)
    if (statusFilter) params.set('status', statusFilter)
    params.set('limit', '100')
    const [res, draftRes] = await Promise.all([
      fetch(`/api/items?${params}`),
      fetch('/api/items?status=DRAFT&limit=1'),
    ])
    const j = await res.json()
    const dj = await draftRes.json()
    if (j.success) { setItems(j.data.items); setTotal(j.data.total) }
    if (dj.success) setDraftCount(dj.data.total)
    setLoading(false)
  }, [search, roleFilter, statusFilter])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function runAudit() {
    setAuditLoading(true)
    try {
      const res = await fetch('/api/audit/items', { method: 'POST' })
      const j = await res.json()
      if (j.success) {
        toast.success(`ตรวจสอบแล้ว: พบ ${j.data.issuesCreated} ปัญหา, ${j.data.recsCreated} คำแนะนำ`)
        fetchItems()
      } else toast.error('เกิดข้อผิดพลาดในการตรวจสอบ')
    } catch { toast.error('เกิดข้อผิดพลาด') } finally { setAuditLoading(false) }
  }

  const needReviewCount = items.filter(i => i.status === 'NEED_REVIEW').length

  return (
    <div className="page-container" style={{ maxWidth: 1280, padding: '1.5rem', background: '#F8FAFC', minHeight: '100vh', borderRadius: 24, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ 
            width: 52, height: 52, borderRadius: 16, 
            background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontSize: '1.6rem', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), 0 4px 10px rgba(99, 102, 241, 0.1)' 
          }}>
            🧺
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>คลังวัตถุดิบ (Catalog)</h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748B' }}>
              Master data วัตถุดิบ / ของเตรียม — <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: 12, fontWeight: 700, fontSize: '0.75rem', marginLeft: 4 }}>{total} รายการ</span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/inventory-catalog/duplicates" passHref>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 12, border: '1px solid #E2E8F0',
              background: 'white', color: '#475569', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem',
              whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              transition: 'all 0.2s'
            }} onMouseOver={e => e.currentTarget.style.borderColor = '#8B5CF6'} onMouseOut={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
              🔗 จัดการข้อมูลซ้ำ
            </button>
          </Link>
          <button onClick={runAudit} disabled={auditLoading} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 12, border: '1px solid #E2E8F0',
            background: 'white', color: '#475569', cursor: auditLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem',
            whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            transition: 'all 0.2s'
          }} onMouseOver={e => e.currentTarget.style.borderColor = '#CBD5E1'} onMouseOut={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
            {auditLoading ? <span style={{ animation: 'spin 1s linear infinite' }}>↻</span> : '🔍'}
            {auditLoading ? 'กำลังตรวจสอบ...' : 'ตรวจ Catalog'}
          </button>
          <button onClick={() => setShowAdd(true)} style={{ 
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', 
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem',
            whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            transition: 'transform 0.1s, box-shadow 0.2s'
          }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)' }} onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 300, lineHeight: 1 }}>+</span> เพิ่มรายการ
          </button>
        </div>
      </div>

      {/* Control Panel (Tabs & Filters contained together) */}
      <div style={{ 
        background: 'white', borderRadius: 16, padding: '16px', marginBottom: 20,
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #F1F5F9' 
      }}>
        
        {/* Status Tab Bar */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed #E2E8F0' }}>
          {([
            { label: 'ทั้งหมด', value: '', color: '#64748B', icon: '📋' },
            { label: 'Active', value: 'ACTIVE', color: '#10B981', icon: '✅' },
            { label: 'รอตรวจสอบ', value: 'NEED_REVIEW', color: '#F59E0B', icon: '⚠️' },
            { label: `Draft${draftCount > 0 ? ` (${draftCount})` : ''}`, value: 'DRAFT', color: '#6366F1', icon: '📝' },
            { label: 'Archived', value: 'ARCHIVED', color: '#94A3B8', icon: '🗃' },
          ] as { label: string; value: string; color: string; icon: string }[]).map(tab => {
            const active = statusFilter === tab.value
            return (
              <button key={tab.value} onClick={() => setStatusFilter(tab.value)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 20, 
                border: `1px solid ${active ? tab.color : '#E2E8F0'}`,
                background: active ? tab.color + '12' : '#F8FAFC',
                color: active ? tab.color : '#475569',
                fontFamily: 'inherit', fontWeight: active ? 700 : 500, fontSize: '0.82rem',
                cursor: 'pointer', transition: 'all 0.2s',
              }} onMouseOver={e => { if(!active) e.currentTarget.style.background = '#F1F5F9' }} onMouseOut={e => { if(!active) e.currentTarget.style.background = '#F8FAFC' }}>
                <span style={{ fontSize: '0.9rem' }}>{tab.icon}</span> {tab.label}
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', color: '#94A3B8' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อ, รหัส..." 
              style={{ padding: '9px 12px 9px 36px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', width: 220, fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s', background: '#F8FAFC' }}
              onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} 
            style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', background: '#F8FAFC', cursor: 'pointer', color: '#334155' }}>
            <option value="">ทุกประเภท</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter('') }} 
            style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: '0.85rem', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.background = 'white'}
            >
            🔄 รีเซ็ต
          </button>
        </div>
      </div>

      {/* Need review banner */}
      {needReviewCount > 0 && statusFilter !== 'NEED_REVIEW' && (
        <div style={{
          marginBottom: 20, padding: '12px 20px', borderRadius: 16,
          background: 'linear-gradient(to right, #FFFBEB, #FEF3C7)', border: '1px solid #FDE68A',
          display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)'
        }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#F59E0B20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>⚠️</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#92400E' }}>พบรายการรอตรวจสอบ (Confidence ต่ำ)</div>
            <div style={{ fontSize: '0.78rem', color: '#B45309' }}>มี {needReviewCount} รายการที่ AI มั่นใจน้อยกว่า 85% กรุณาตรวจสอบความถูกต้อง</div>
          </div>
          <button onClick={() => setStatusFilter('NEED_REVIEW')} style={{
            marginLeft: 'auto', padding: '8px 16px', borderRadius: 10, border: 'none',
            background: '#F59E0B', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)', transition: 'transform 0.1s'
          }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>ดูรายการ</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, border: '4px solid #F1F5F9', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}>กำลังโหลด...</span>
        </div>
      ) : items.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 0', gap: 16, background: 'white', borderRadius: 16, border: '1px solid #F1F5F9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <div style={{ width: 80, height: 80, background: '#F8FAFC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>📭</div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 6px', color: '#334155', fontSize: '1.2rem', fontWeight: 800 }}>ไม่พบรายการวัตถุดิบ</h3>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.9rem' }}>คลิกเพิ่มรายการแรกเพื่อเริ่มต้นใช้งาน</p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ marginTop: 8, padding: '10px 24px', borderRadius: 12, border: 'none', background: '#F1F5F9', color: '#475569', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }} onMouseOver={e=>{e.currentTarget.style.background='#E2E8F0'; e.currentTarget.style.color='#1E293B'}} onMouseOut={e=>{e.currentTarget.style.background='#F1F5F9'; e.currentTarget.style.color='#475569'}}>+ เพิ่มรายการใหม่</button>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>รหัส</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ชื่อรายการ</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ประเภท</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>หมวด</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>หน่วย</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>สถานะ</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>AI</th>
                  <th style={{ padding: '14px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>ปัญหา</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#F8FAFC'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>{item.code}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1E293B', fontSize: '0.9rem' }}>{item.name}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', background: '#F1F5F9', padding: '4px 10px', borderRadius: 8 }}>{ROLE_LABELS[item.itemRole] ?? item.itemRole}</span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#64748B' }}>{item.categoryKey ?? '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{item.baseUnit}</span>
                        {item.purchaseUnit && (
                          <>
                            <span style={{ color: '#CBD5E1' }}>/</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94A3B8' }}>{item.purchaseUnit}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 12,
                        background: (STATUS_COLORS[item.status] ?? '#6B7280') + '15',
                        color: STATUS_COLORS[item.status] ?? '#6B7280',
                        border: `1px solid ${STATUS_COLORS[item.status] ?? '#6B7280'}30`, whiteSpace: 'nowrap'
                      }}>{item.status}</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}><ConfidenceBadge score={item.aiConfidence ?? undefined} /></td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {(item._count?.issues ?? 0) > 0
                        ? <span style={{ fontSize: '0.75rem', background: '#FEF2F2', color: '#DC2626', padding: '3px 10px', borderRadius: 14, fontWeight: 700, border: '1px solid #FECACA' }}>{item._count?.issues}</span>
                        : <span style={{ color: '#E2E8F0', fontSize: '1rem' }}>✓</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); fetchItems() }} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
