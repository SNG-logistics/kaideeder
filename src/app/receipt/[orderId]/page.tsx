'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { useCurrency, useTenant } from '@/context/TenantContext'
import { useStoreBranding } from '@/hooks/useStoreBranding'

// ─── Types ───────────────────────────────────────────────────
interface OrderItem {
    id: string; productId: string
    product: { name: string; sku: string }
    quantity: number; unitPrice: number; isCancelled: boolean; note?: string
}
interface Payment {
    id: string; method: string; amount: number; receivedAmount: number; changeAmount: number
}
interface OrderData {
    id: string; orderNumber: string; status: string
    subtotal: number; discount: number; discountType: string
    serviceCharge: number; vat: number; totalAmount: number
    openedAt: string; closedAt?: string
    table?: { id: string; name: string; number: number; zone: string }
    items: OrderItem[]; payments?: Payment[]
    createdBy?: { id: string; name: string }
}

function fmtDate(s: string) {
    const d = new Date(s)
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function payLabel(m: string) {
    const map: Record<string,string> = { CASH:'💵 ເງິນສົດ', TRANSFER:'📲 ໂອນ', CARD:'💳 ບັດ', QRCODE:'📷 QR' }
    return map[m] ?? m
}

// ═══════════════════════════════════════════════════════════════
// Inner component — must be inside <Suspense> because it uses useSearchParams()
function ReceiptContent({ orderId }: { orderId: string }) {
    const [order, setOrder] = useState<OrderData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [printed, setPrinted] = useState(false)
    const searchParams = useSearchParams()
    const isPreview = searchParams.get('preview') === '1'
    const { fmt } = useCurrency()
    const { settings } = useTenant()
    const branding = useStoreBranding()

    const storeName   = branding.displayName || settings?.name || 'ຮ້ານ'
    const storeNameLo = settings?.storeNameLao ?? ''
    const storePhone  = settings?.phone ?? ''
    const receiptHeader = settings?.receiptHeader ?? ''
    const receiptFooter = (settings as any)?.receiptFooter ?? ''
    const logoUrl       = branding.logoUrl ?? null
    const qrBankingBase64 = (settings as any)?.qrBankingBase64 ?? null

    useEffect(() => {
        fetch(`/api/pos/orders/${orderId}`)
            .then(r => r.json())
            .then(j => { if (j.success) setOrder(j.data); else setError(j.error || 'ไม่พบออเดอร์') })
            .catch(() => setError('ไม่สามารถโหลดข้อมูลได้'))
            .finally(() => setLoading(false))
    }, [orderId])

    useEffect(() => {
        if (order && !printed && !isPreview) {
            const t = setTimeout(() => {
                window.addEventListener('afterprint', () => window.close(), { once: true })
                window.print()
                setPrinted(true)
            }, 500)
            return () => clearTimeout(t)
        }
    }, [order, printed, isPreview])

    if (loading) return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif', flexDirection:'column', gap:12, color:'#666' }}>
            <div style={{ width:32, height:32, border:'3px solid #eee', borderTopColor:'#E8364E', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            <span style={{ fontSize:13 }}>ກຳລັງໂຫລດ...</span>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    if (error || !order) return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif', gap:12 }}>
            <span style={{ fontSize:32 }}>❌</span>
            <p style={{ color:'#DC2626' }}>{error || 'ไม่พบออเดอร์'}</p>
            <button onClick={() => window.close()} style={{ padding:'8px 20px', cursor:'pointer', borderRadius:8, border:'1px solid #ddd' }}>ປິດ</button>
        </div>
    )

    const activeItems = order.items.filter(i => !i.isCancelled)
    const payment     = order.payments?.[0] ?? null
    // Always compute subtotal from live items (DB field may be stale / 0)
    const computedSubtotal = activeItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    const subtotal = computedSubtotal || order.subtotal
    const discountAmt = order.discountType === 'PERCENT' ? subtotal * order.discount / 100 : order.discount
    const afterDiscount = subtotal - discountAmt
    const computedTotal = afterDiscount + (order.serviceCharge || 0) + (order.vat || 0)
    const finalTotal = computedTotal || order.totalAmount
    const isPaid      = !!payment
    const initials    = storeName.slice(0, 2).toUpperCase()

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;600;700&family=Noto+Sans+Thai:wght@400;600;700&display=swap');
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family: 'Noto Sans Lao','Noto Sans Thai', 'Sarabun', sans-serif; background: #F0F2F5; }
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    html, body { height: fit-content !important; overflow: hidden !important; }
                    body { background: #fff !important; padding: 0 !important; }
                    .no-print { display:none !important; }
                    .receipt-card { box-shadow:none !important; border-radius:0 !important; margin:0 !important; border:none !important; }
                }
                @media screen {
                    body { display:flex; flex-direction:column; align-items:center; padding:20px 16px 40px; gap:12px; min-height:100vh; }
                }
                @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
                .row { display:flex; justify-content:space-between; align-items:center; }
            `}</style>

            {isPreview && (
                <div className="no-print" style={{ position:'fixed', top:0, left:0, right:0, background:'linear-gradient(135deg,#1d4ed8,#2563eb)', color:'#fff', textAlign:'center', padding:'8px 16px', fontSize:12, fontWeight:700, zIndex:200 }}>
                    👁️ ຕົວຢ່າງ · ยังไม่ได้ชำระ | Please confirm with staff
                </div>
            )}

            <div className="no-print" style={{ display:'flex', gap:8, marginTop: isPreview ? 44 : 0, animation:'fadeIn 0.4s ease' }}>
                <button onClick={() => { setPrinted(false); window.print() }} style={{ padding:'9px 20px', background:'#E8364E', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, boxShadow:'0 4px 12px rgba(232,54,78,0.35)', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                    🖨️ ພິມ · พิมพ์
                </button>
                <button onClick={() => window.close()} style={{ padding:'9px 20px', background:'#fff', color:'#374151', border:'1.5px solid #E5E7EB', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit' }}>
                    ✕ ປິດ
                </button>
            </div>

            <div className="receipt-card" style={{ width:302, background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 6px 32px rgba(0,0,0,0.13)', animation:'fadeIn 0.5s ease' }}>
                <div style={{ height:4, background:'linear-gradient(90deg,#E8364E,#FF6B35,#F59E0B)' }} />

                <div style={{ background:'#1A1D26', color:'#fff', padding:'10px 14px 9px', textAlign:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:9, marginBottom:6 }}>
                        <div style={{ width:38, height:38, borderRadius:'50%', background: logoUrl ? 'transparent' : 'linear-gradient(135deg,#E8364E,#FF6B35)', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(232,54,78,0.4)' }}>
                            {logoUrl
                                ? <img src={logoUrl} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : <span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{initials}</span>
                            }
                        </div>
                        <div style={{ textAlign:'left' }}>
                            <div style={{ fontSize:15, fontWeight:900, letterSpacing:0.4, lineHeight:1.2 }}>{storeName}</div>
                            {storeNameLo && <div style={{ fontSize:11, fontWeight:600, color:'#CBD5E1', marginTop:1 }}>{storeNameLo}</div>}
                        </div>
                    </div>
                    {receiptHeader ? (
                        <div style={{ fontSize:10.5, color:'#94A3B8', whiteSpace:'pre-wrap', lineHeight:1.5, fontWeight:500 }}>{receiptHeader}</div>
                    ) : storePhone ? (
                        <div style={{ fontSize:10.5, color:'#94A3B8', fontWeight:600 }}>📞 {storePhone}</div>
                    ) : null}
                    <div style={{ marginTop:7, display:'inline-flex', alignItems:'center', gap:5, background: isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', borderRadius:16, padding:'3px 10px' }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background: isPaid ? '#10B981' : '#F59E0B' }} />
                        <span style={{ fontSize:10, fontWeight:700, color: isPaid ? '#10B981' : '#F59E0B' }}>
                            {isPaid ? 'ຊຳລະແລ້ວ · ชำระแล้ว' : 'ຍັງບໍ່ໄດ້ຊຳລະ · ยังไม่ชำระ'}
                        </span>
                    </div>
                </div>

                <div style={{ padding:'8px 12px 4px' }}>
                    {([
                        ['📅', fmtDate(order.closedAt || order.openedAt)],
                        order.table ? ['🪑', order.table.name] : null,
                        ['🧾', order.orderNumber],
                        order.createdBy ? ['👤', order.createdBy.name] : null,
                    ] as (string[] | null)[]).filter((x): x is string[] => x !== null).map(([icon, value], i) => (
                        <div key={i} className="row" style={{ padding:'3px 0', borderBottom:'1px solid #F3F4F6' }}>
                            <span style={{ fontSize:10, color:'#9CA3AF', fontWeight:500 }}>{icon}</span>
                            <span style={{ fontSize:11.5, fontWeight:700, color:'#111827', letterSpacing:0.1 }}>{value}</span>
                        </div>
                    ))}
                </div>

                <div style={{ margin:'6px 12px', borderTop:'1.5px dashed #E5E7EB' }} />

                <div style={{ padding:'0 12px' }}>
                    <div className="row" style={{ marginBottom:5 }}>
                        <span style={{ fontSize:9, fontWeight:800, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:1 }}>ລາຍການ · รายการ</span>
                        <span style={{ fontSize:9, fontWeight:800, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:1 }}>ຍອດ · ยอด</span>
                    </div>
                    {activeItems.map((item, idx) => (
                        <div key={idx} style={{ marginBottom:5, paddingBottom:5, borderBottom: idx < activeItems.length-1 ? '1px dashed #F3F4F6' : 'none' }}>
                            <div className="row" style={{ alignItems:'flex-start', gap:6 }}>
                                <div style={{ flex:1 }}>
                                    <div style={{ fontSize:12.5, fontWeight:700, color:'#111827', lineHeight:1.3 }}>{item.product.name}</div>
                                    <div style={{ fontSize:10, color:'#9CA3AF', marginTop:1 }}>{fmt(item.unitPrice)} × {item.quantity}</div>
                                    {item.note && <div style={{ fontSize:9.5, color:'#9CA3AF', marginTop:2, fontStyle:'italic' }}>📝 {item.note}</div>}
                                </div>
                                <div style={{ fontSize:13, fontWeight:800, color:'#111827', flexShrink:0 }}>{fmt(item.quantity * item.unitPrice)}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ margin:'4px 12px 0', borderTop:'1.5px dashed #E5E7EB', paddingTop:8 }}>
                    {([
                        ['ລວມ · รวม', fmt(subtotal)],
                        discountAmt > 0 ? [`ສ່ວນລຸດ${order.discountType==='PERCENT'?` (${order.discount}%)`:''}`, `- ${fmt(discountAmt)}`] : null,
                        order.serviceCharge > 0 ? ['ຄ່າບໍລິການ', fmt(order.serviceCharge)] : null,
                        order.vat > 0 ? ['VAT', fmt(order.vat)] : null,
                    ] as (string[] | null)[]).filter((x): x is string[] => x !== null).map(([label, value], i) => (
                        <div key={i} className="row" style={{ marginBottom:4 }}>
                            <span style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>{label}</span>
                            <span style={{ fontSize:11.5, color:'#374151', fontWeight:700 }}>{value}</span>
                        </div>
                    ))}
                </div>

                <div style={{ margin:'6px 12px 10px', background:'linear-gradient(135deg,#0F1117,#1A1D26)', borderRadius:10, padding:'9px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                        <div style={{ fontSize:9, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.8 }}>ຍອດສຸດທ້າຍ · ยอดสุทธิ</div>
                        <div style={{ fontSize:10, color:'#64748B', marginTop:1 }}>{activeItems.length} รายการ</div>
                    </div>
                    <span style={{ fontSize:22, fontWeight:900, color:'#FBBF24', letterSpacing:0.3, textShadow:'0 0 16px rgba(251,191,36,0.4)' }}>{fmt(finalTotal)}</span>
                </div>

                {payment ? (
                    <div style={{ margin:'0 12px 10px', background:'#F0FDF4', borderRadius:8, padding:'7px 10px', border:'1px solid #BBF7D0' }}>
                        <div style={{ fontSize:11, fontWeight:800, color:'#059669', marginBottom:4 }}>✅ {payLabel(payment.method)}</div>
                        {payment.receivedAmount > 0 && (
                            <div className="row" style={{ fontSize:11, color:'#374151', fontWeight:600 }}>
                                <span style={{ color:'#6B7280' }}>ຮັບມາ · รับมา</span>
                                <span style={{ fontWeight:800, color:'#111827' }}>{fmt(payment.receivedAmount)}</span>
                            </div>
                        )}
                        {payment.changeAmount > 0 && (
                            <div className="row" style={{ fontSize:12, fontWeight:800, color:'#059669', marginTop:4, paddingTop:4, borderTop:'1px dashed #BBF7D0' }}>
                                <span>ເງິນທອນ · เงินทอน</span><span>{fmt(payment.changeAmount)}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ margin:'0 12px 10px', background:'#FFFBEB', borderRadius:8, padding:'7px 10px', border:'1px solid #FDE68A', textAlign:'center' }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#D97706' }}>⏳ ຍັງບໍ່ໄດ້ຊຳລະ · ยังไม่ชำระ</span>
                    </div>
                )}

                {qrBankingBase64 && (
                    <div style={{ margin:'0 12px 10px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:'#374151', fontWeight:700, marginBottom:5 }}>📲 สแกนเพื่อจ่าย · ສະແກນຈ່າຍ</div>
                        <img
                            src={`data:image/jpeg;base64,${qrBankingBase64}`}
                            alt="QR Banking"
                            style={{ width:130, height:130, objectFit:'contain', borderRadius:8, border:'1.5px solid #E5E7EB' }}
                        />
                    </div>
                )}

                <div style={{ background:'#F8F9FC', padding:'10px 14px 12px', textAlign:'center', borderTop:'1px dashed #E5E7EB' }}>
                    {receiptFooter ? (
                        <div style={{ fontSize:11, color:'#4B5563', whiteSpace:'pre-wrap', lineHeight:1.6, fontWeight:500 }}>{receiptFooter}</div>
                    ) : (
                        <>
                            <div style={{ fontSize:13, fontWeight:800, color:'#1A1D26', marginBottom:2 }}>ຂອບໃຈທີ່ໃຊ້ບໍລິການ 🙏</div>
                            <div style={{ fontSize:10.5, color:'#6B7280', fontWeight:500 }}>ขอบคุณที่มาอุดหนุน · Thank you! ♥</div>
                        </>
                    )}
                    <div style={{ marginTop:8, fontSize:8.5, color:'#D1D5DB', letterSpacing:0.6, fontWeight:600 }}>KAIDEEDER POS · {order.orderNumber}</div>
                </div>

                <div style={{ height:3, background:'linear-gradient(90deg,#F59E0B,#FF6B35,#E8364E)' }} />
            </div>
        </>
    )
}

// ═══════════════════════════════════════════════════════════════
// Default export wraps ReceiptContent in <Suspense>
// Required by Next.js 15: useSearchParams() must be inside Suspense
export default function ReceiptPage() {
    const params = useParams()
    const orderId = params.orderId as string

    if (!orderId) return null;

    return (
        <Suspense fallback={
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif', flexDirection:'column', gap:12, color:'#666' }}>
                <div style={{ width:32, height:32, border:'3px solid #eee', borderTopColor:'#E8364E', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                <span style={{ fontSize:13 }}>ກຳລັງໂຫລດ...</span>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        }>
            <ReceiptContent orderId={orderId} />
        </Suspense>
    )
}
