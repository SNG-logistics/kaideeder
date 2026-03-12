'use client'
import { useState, useEffect, use } from 'react'
import { useSearchParams } from 'next/navigation'
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
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}  ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function payLabel(m: string) {
    const map: Record<string,string> = { CASH:'💵 ເງິນສົດ · เงินสด', TRANSFER:'📲 ໂອນ · โอน', CARD:'💳 ບັດ · บัตร', QRCODE:'📷 QR' }
    return map[m] ?? m
}

// ═══════════════════════════════════════════════════════════════
export default function ReceiptPage({ params }: { params: Promise<{ orderId: string }> }) {
    const { orderId } = use(params)
    const [order, setOrder] = useState<OrderData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [printed, setPrinted] = useState(false)
    const searchParams = useSearchParams()
    const isPreview = searchParams.get('preview') === '1'
    const { fmt } = useCurrency()
    const { settings } = useTenant()
    const branding = useStoreBranding()

    const storeName   = branding.displayName || settings?.name || 'ຮ້ານ · ร้าน'
    const storeNameLo = settings?.storeNameLao ?? ''
    const storePhone  = settings?.phone ?? ''
    const receiptHeader = settings?.receiptHeader ?? ''
    const receiptFooter = (settings as any)?.receiptFooter ?? ''
    const logoUrl       = branding.logoUrl ?? null

    useEffect(() => {
        fetch(`/api/pos/orders/${orderId}`)
            .then(r => r.json())
            .then(j => { if (j.success) setOrder(j.data); else setError(j.error || 'ไม่พบออเดอร์') })
            .catch(() => setError('ไม่สามารถโหลดข้อมูลได้'))
            .finally(() => setLoading(false))
    }, [orderId])

    useEffect(() => {
        if (order && !printed && !isPreview) {
            const t = setTimeout(() => { window.print(); setPrinted(true) }, 500)
            return () => clearTimeout(t)
        }
    }, [order, printed, isPreview])

    if (loading) return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif', flexDirection:'column', gap:12, color:'#666' }}>
            <div style={{ width:36, height:36, border:'3px solid #eee', borderTopColor:'#E8364E', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
            <span style={{ fontSize:14 }}>ກຳລັງໂຫລດ · กำลังโหลด...</span>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    if (error || !order) return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif', gap:12 }}>
            <span style={{ fontSize:32 }}>❌</span>
            <p style={{ color:'#DC2626' }}>{error || 'ไม่พบออเดอร์'}</p>
            <button onClick={() => window.close()} style={{ padding:'8px 20px', cursor:'pointer', borderRadius:8, border:'1px solid #ddd' }}>ປິດ · ปิด</button>
        </div>
    )

    const activeItems   = order.items.filter(i => !i.isCancelled)
    const payment       = order.payments?.[0] ?? null
    const discountAmt   = order.discountType === 'PERCENT' ? order.subtotal * order.discount / 100 : order.discount
    const isPaid        = !!payment
    const initials      = storeName.slice(0, 2).toUpperCase()

    return (
        <>
            {/* ── Global Styles ─────────────────────────────────────── */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;600;700&family=Noto+Sans+Thai:wght@400;600;700&display=swap');
                * { margin:0; padding:0; box-sizing:border-box; }
                body {
                    font-family: 'Noto Sans Lao','Noto Sans Thai', 'Sarabun', sans-serif;
                    background: #F0F2F5;
                }
                @media print {
                    @page { size: 80mm auto; margin: 0; }
                    body { background: #fff !important; padding: 0 !important; }
                    .no-print { display:none !important; }
                    .receipt-card { box-shadow:none !important; border-radius:0 !important; margin:0 !important; border:none !important; }
                }
                @media screen {
                    body { display:flex; flex-direction:column; align-items:center; padding:24px 16px 48px; gap:14px; min-height:100vh; }
                }
                @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
            `}</style>

            {/* ── Preview Banner ─────────────────────────────────────── */}
            {isPreview && (
                <div className="no-print" style={{ position:'fixed', top:0, left:0, right:0, background:'linear-gradient(135deg,#1d4ed8,#2563eb)', color:'#fff', textAlign:'center', padding:'10px 16px', fontSize:12.5, fontWeight:700, zIndex:200, letterSpacing:0.3 }}>
                    👁️ ຕົວຢ່າງໃບຮັບເງິນ · ใบเสร็จสำหรับลูกค้าดู — ຍັງບໍ່ໄດ້ຊຳລະ | Please confirm with staff
                </div>
            )}

            {/* ── Action Buttons ──────────────────────────────────────── */}
            <div className="no-print" style={{ display:'flex', gap:10, marginTop: isPreview ? 48 : 0, animation:'fadeIn 0.4s ease' }}>
                <button onClick={() => { setPrinted(false); window.print() }} style={{ padding:'10px 22px', background:'#E8364E', color:'#fff', border:'none', borderRadius:12, cursor:'pointer', fontSize:14, fontWeight:700, boxShadow:'0 4px 14px rgba(232,54,78,0.35)', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                    🖨️ ພິມ · พิมพ์
                </button>
                <button onClick={() => window.close()} style={{ padding:'10px 22px', background:'#fff', color:'#374151', border:'1.5px solid #E5E7EB', borderRadius:12, cursor:'pointer', fontSize:14, fontWeight:600, fontFamily:'inherit' }}>
                    ✕ ປິດ · ปิด
                </button>
            </div>

            {/* ═══════════════════ RECEIPT CARD ═══════════════════════ */}
            <div className="receipt-card" style={{ width:302, background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.14)', animation:'fadeIn 0.5s ease' }}>

                {/* ── Accent bar top ─────────────────────────────────── */}
                <div style={{ height:5, background:'linear-gradient(90deg,#E8364E,#FF6B35,#F59E0B)' }} />

                {/* ── Store Header ────────────────────────────────────── */}
                <div style={{ background:'#1A1D26', color:'#fff', padding:'18px 16px 16px', textAlign:'center' }}>
                    {/* Logo circle */}
                    <div style={{ width:60, height:60, borderRadius:'50%', background: logoUrl ? 'transparent' : 'linear-gradient(135deg,#E8364E,#FF6B35)', margin:'0 auto 10px', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(232,54,78,0.4)' }}>
                        {logoUrl
                            ? <img src={logoUrl} alt="logo" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <span style={{ fontSize:20, fontWeight:800, color:'#fff' }}>{initials}</span>
                        }
                    </div>

                    <div style={{ fontSize:17, fontWeight:800, letterSpacing:0.5 }}>{storeName}</div>
                    {storeNameLo && <div style={{ fontSize:13, fontWeight:600, color:'#9CA3AF', marginTop:2 }}>{storeNameLo}</div>}

                    {receiptHeader ? (
                        <div style={{ fontSize:11, color:'#9CA3AF', marginTop:6, whiteSpace:'pre-wrap', lineHeight:1.5 }}>{receiptHeader}</div>
                    ) : storePhone ? (
                        <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>📞 {storePhone}</div>
                    ) : null}

                    {/* Status badge */}
                    <div style={{ marginTop:10, display:'inline-flex', alignItems:'center', gap:6, background: isPaid ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', borderRadius:20, padding:'4px 14px' }}>
                        <div style={{ width:7, height:7, borderRadius:'50%', background: isPaid ? '#10B981' : '#F59E0B' }} />
                        <span style={{ fontSize:11, fontWeight:700, color: isPaid ? '#10B981' : '#F59E0B' }}>
                            {isPaid ? 'ຊຳລະແລ້ວ · ชำระแล้ว' : 'ຍັງບໍ່ໄດ້ຊຳລະ · ยังไม่ชำระ'}
                        </span>
                    </div>
                </div>

                {/* ── Order Meta ──────────────────────────────────────── */}
                <div style={{ padding:'14px 16px 0' }}>
                    {([
                        ['📅', 'ວັນທີ · วันที่', fmtDate(order.closedAt || order.openedAt)],
                        order.table ? ['🪑', 'ໂຕະ · โต๊ะ', order.table.name] : null,
                        ['🧾', 'ເລກບິນ · เลขบิล', order.orderNumber],
                        order.createdBy ? ['👤', 'ພະນັກງານ · พนักงาน', order.createdBy.name] : null,
                    ] as (string[] | null)[]).filter((x): x is string[] => x !== null).map(([icon, label, value], i) => (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:'1px solid #F3F4F6' }}>
                            <span style={{ fontSize:11, color:'#9CA3AF', display:'flex', alignItems:'center', gap:4 }}>{icon} {label}</span>
                            <span style={{ fontSize:12, fontWeight:600, color:'#1A1D26' }}>{value}</span>
                        </div>
                    ))}
                </div>

                {/* ── Items ───────────────────────────────────────────── */}
                <div style={{ padding:'12px 16px 0' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                        <span style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.8 }}>ລາຍການ · รายการ</span>
                        <span style={{ fontSize:10, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.8 }}>ຍອດ · ยอด</span>
                    </div>

                    {activeItems.map((item, idx) => (
                        <div key={idx} style={{ marginBottom:10, paddingBottom:10, borderBottom: idx < activeItems.length-1 ? '1px dashed #E5E7EB' : 'none' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                                <div style={{ flex:1 }}>
                                    <div style={{ fontSize:13, fontWeight:600, color:'#1A1D26', lineHeight:1.3 }}>{item.product.name}</div>
                                    {item.note && <div style={{ fontSize:10, color:'#9CA3AF', marginTop:2 }}>📝 {item.note}</div>}
                                </div>
                                <div style={{ textAlign:'right', flexShrink:0 }}>
                                    <div style={{ fontSize:13, fontWeight:700, color:'#1A1D26' }}>{fmt(item.quantity * item.unitPrice)}</div>
                                    <div style={{ fontSize:10, color:'#9CA3AF' }}>{fmt(item.unitPrice)} × {item.quantity}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Totals ──────────────────────────────────────────── */}
                <div style={{ margin:'0 16px', borderTop:'2px dashed #E5E7EB', paddingTop:12, paddingBottom:4 }}>
                    {([
                        ['ລວມ · รวม', fmt(order.subtotal), false],
                        discountAmt > 0 ? [`ສ່ວນລຸດ${order.discountType==='PERCENT'?` (${order.discount}%)`:''} · ส่วนลด`, `- ${fmt(discountAmt)}`, false] : null,
                        order.serviceCharge > 0 ? ['ຄ່າບໍລິການ · ค่าบริการ', fmt(order.serviceCharge), false] : null,
                        order.vat > 0 ? ['VAT', fmt(order.vat), false] : null,
                    ] as (Array<string|boolean> | null)[]).filter((x): x is Array<string|boolean> => x !== null).map(([label, value], i) => (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                            <span style={{ fontSize:12, color:'#6B7280' }}>{label as string}</span>
                            <span style={{ fontSize:12, color:'#6B7280' }}>{value as string}</span>
                        </div>
                    ))}
                </div>

                {/* Grand total */}
                <div style={{ margin:'0 16px 14px', background:'linear-gradient(135deg,#1A1D26,#2D3748)', borderRadius:12, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>ຍອດສຸດທ້າຍ · ยอดสุทธิ</span>
                    <span style={{ fontSize:20, fontWeight:800, color:'#F59E0B' }}>{fmt(order.totalAmount)}</span>
                </div>

                {/* ── Payment ─────────────────────────────────────────── */}
                {payment ? (
                    <div style={{ margin:'0 16px 14px', background:'#F0FDF4', borderRadius:12, padding:'10px 14px', border:'1px solid #BBF7D0' }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#059669', marginBottom:6 }}>✅ ຊຳລະດ້ວຍ · ชำระด้วย: {payLabel(payment.method)}</div>
                        {payment.receivedAmount > 0 && (
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#374151', marginTop:2 }}>
                                <span>ຮັບມາ · รับมา</span><span>{fmt(payment.receivedAmount)}</span>
                            </div>
                        )}
                        {payment.changeAmount > 0 && (
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:'#059669', marginTop:2 }}>
                                <span>ເງິນທອນ · เงินทอน</span><span>{fmt(payment.changeAmount)}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ margin:'0 16px 14px', background:'#FFFBEB', borderRadius:12, padding:'10px 14px', border:'1px solid #FDE68A', textAlign:'center' }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'#D97706' }}>⏳ ຍັງບໍ່ໄດ້ຊຳລະ · ยังไม่ได้ชำระเงิน</span>
                    </div>
                )}

                {/* ── QR Code ─────────────────────────────────────────── */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'4px 16px 14px', gap:6 }}>
                    <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:600, letterSpacing:0.5 }}>ສະແກນເພື່ອດູລາຍລະອຽດ · สแกนดูรายละเอียด</div>
                    {/* QR placeholder — only shows in Python version; here we show order number */}
                    <div style={{ width:80, height:80, background:'#F3F4F6', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', border:'1px dashed #D1D5DB' }}>
                        <span style={{ fontSize:9, color:'#9CA3AF', textAlign:'center', padding:4 }}>{order.orderNumber}</span>
                    </div>
                </div>

                {/* ── Footer ──────────────────────────────────────────── */}
                <div style={{ background:'#F8F9FC', padding:'14px 16px 20px', textAlign:'center', borderTop:'1px dashed #E5E7EB' }}>
                    {receiptFooter ? (
                        <div style={{ fontSize:12, color:'#6B7280', whiteSpace:'pre-wrap', lineHeight:1.7 }}>{receiptFooter}</div>
                    ) : (
                        <>
                            <div style={{ fontSize:14, fontWeight:700, color:'#1A1D26', marginBottom:3 }}>ຂອບໃຈທີ່ໃຊ້ບໍລິການ 🙏</div>
                            <div style={{ fontSize:12, color:'#6B7280' }}>ขอบคุณที่มาอุดหนุน · Thank you! ♥</div>
                        </>
                    )}
                    <div style={{ marginTop:12, fontSize:9, color:'#D1D5DB', letterSpacing:0.5 }}>KAIDEEDER POS · {order.orderNumber}</div>
                </div>

                {/* ── Accent bar bottom ───────────────────────────────── */}
                <div style={{ height:4, background:'linear-gradient(90deg,#F59E0B,#FF6B35,#E8364E)' }} />
            </div>
        </>
    )
}
