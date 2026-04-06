'use client'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface Recommendation {
  id: string
  recommendationType: string
  title: string
  detailsJson: Record<string, unknown>
  confidenceScore: number
  riskLevel: string
  status: string
  createdAt: string
  inventoryItem?: { id: string; name: string; code: string; status: string } | null
}

const RISK_COLORS: Record<string, string> = { LOW: '#059669', MEDIUM: '#D97706', HIGH: '#DC2626' }
const RISK_BG: Record<string, string> = { LOW: '#ECFDF5', MEDIUM: '#FFFBEB', HIGH: '#FEF2F2' }
const TYPE_ICONS: Record<string, string> = {
  FIX_METADATA: '🔧',
  CREATE_ALIAS: '🔤',
  REVIEW_DUPLICATE: '🔎',
}

export default function RecommendationInboxPage() {
  useRoleGuard(['owner', 'manager', 'warehouse'])
  const [recs, setRecs] = useState<Recommendation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('OPEN')
  const [acting, setActing] = useState<string | null>(null)

  const fetchRecs = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/recommendations?entity_type=ITEM&status=${statusFilter}&limit=50`)
    const j = await res.json()
    if (j.success) { setRecs(j.data.recommendations); setTotal(j.data.total) }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { fetchRecs() }, [fetchRecs])

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActing(id)
    try {
      const res = await fetch(`/api/recommendations/${id}/${action}`, { method: 'POST' })
      const j = await res.json()
      if (j.success) {
        toast.success(action === 'approve' ? '✅ ยืนยันคำแนะนำแล้ว' : '❌ ปฏิเสธคำแนะนำแล้ว')
        fetchRecs()
      } else toast.error(j.error || 'เกิดข้อผิดพลาด')
    } catch { toast.error('เกิดข้อผิดพลาด') } finally { setActing(null) }
  }

  return (
    <div className="page-container" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, marginBottom: '1.25rem', paddingBottom: '1rem',
        borderBottom: '2px solid var(--border)', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/inventory-catalog" style={{ fontSize: '0.78rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>← Catalog</Link>
          </div>
          <h1 className="page-title">📥 Recommendation Inbox</h1>
          <p className="page-subtitle">คำแนะนำจาก AI รอการยืนยัน — <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{total}</span> รายการ</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['OPEN', 'APPROVED', 'REJECTED'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${statusFilter === s ? 'var(--accent)' : 'var(--border)'}`,
              background: statusFilter === s ? 'var(--accent)' : 'var(--white)',
              color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.78rem',
              transition: 'all 0.15s',
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>กำลังโหลด...</span>
        </div>
      ) : recs.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', gap: 12 }}>
          <span style={{ fontSize: '3rem' }}>✅</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>ไม่มีคำแนะนำที่รอดำเนินการ</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recs.map(rec => {
            const isLoading = acting === rec.id
            const pct = Math.round(Number(rec.confidenceScore) * 100)
            return (
              <div key={rec.id} className="card" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Icon + type badge */}
                  <div style={{ fontSize: '1.6rem', flexShrink: 0, lineHeight: 1 }}>
                    {TYPE_ICONS[rec.recommendationType] ?? '💡'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                        background: RISK_BG[rec.riskLevel] ?? '#F3F4F6',
                        color: RISK_COLORS[rec.riskLevel] ?? '#6B7280',
                        border: `1px solid ${RISK_COLORS[rec.riskLevel] ?? '#9CA3AF'}40`,
                      }}>{rec.riskLevel}</span>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                        background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD',
                      }}>{rec.recommendationType}</span>
                      <span style={{ fontSize: '0.68rem', color: '#9CA3AF', marginLeft: 'auto' }}>
                        AI {pct}% · {new Date(rec.createdAt).toLocaleDateString('th-TH')}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{rec.title}</div>
                    {rec.inventoryItem && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                        รายการ: <strong>{rec.inventoryItem.name}</strong> ({rec.inventoryItem.code})
                      </div>
                    )}
                    {/* Details */}
                    {rec.recommendationType === 'REVIEW_DUPLICATE' && Array.isArray((rec.detailsJson as {candidates?: unknown[]}).candidates) && (
                      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
                        {((rec.detailsJson as {candidates: {name: string; score: number; match_type: string}[]}).candidates).slice(0, 3).map((c, i) => (
                          <div key={i} style={{ fontSize: '0.72rem', color: '#7C2D12', display: 'flex', justifyContent: 'space-between' }}>
                            <span>• {c.name}</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{c.match_type} {Math.round(c.score * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons (only for OPEN) */}
                {rec.status === 'OPEN' && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => handleAction(rec.id, 'reject')} disabled={!!isLoading} style={{
                      padding: '7px 18px', borderRadius: 8, border: '1.5px solid #E5E7EB',
                      background: '#fff', cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', fontWeight: 600, fontSize: '0.8rem', color: '#6B7280',
                      transition: 'all 0.15s',
                    }}>
                      ✕ ปฏิเสธ
                    </button>
                    <button onClick={() => handleAction(rec.id, 'approve')} disabled={!!isLoading} style={{
                      padding: '7px 18px', borderRadius: 8, border: 'none',
                      background: isLoading ? '#9CA3AF' : '#059669', color: '#fff',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', fontWeight: 700, fontSize: '0.8rem',
                      transition: 'background 0.15s',
                    }}>
                      {isLoading ? '⏳...' : '✓ ยืนยัน'}
                    </button>
                  </div>
                )}

                {rec.status !== 'OPEN' && (
                  <div style={{ marginTop: 8, fontSize: '0.72rem', color: rec.status === 'APPROVED' ? '#059669' : '#DC2626', fontWeight: 700, textAlign: 'right' }}>
                    {rec.status === 'APPROVED' ? '✓ ยืนยันแล้ว' : rec.status === 'APPLIED' ? '✓ ดำเนินการแล้ว' : '✕ ปฏิเสธแล้ว'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
