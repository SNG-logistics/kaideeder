'use client'
import { useEffect, useState } from 'react'

type LedgerEntry = {
    id: string
    type: 'TOPUP' | 'RENT_FEE' | 'ADJUST' | 'REFUND'
    amountLAK: number
    refType: string | null
    note: string | null
    createdAt: string
}

const TYPE_STYLE: Record<string, { label: string; amountClass: string; badge: string }> = {
    TOPUP: { label: 'เติมเงิน', amountClass: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
    RENT_FEE: { label: 'ค่าเช่า', amountClass: 'text-red-500', badge: 'bg-red-100 text-red-700' },
    ADJUST: { label: 'ปรับยอด', amountClass: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
    REFUND: { label: 'คืนเงิน', amountClass: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
}

export default function LedgerPage() {
    const [balance, setBalance] = useState<number | null>(null)
    const [entries, setEntries] = useState<LedgerEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/billing/wallet')
            .then(r => r.json())
            .then(d => {
                setBalance(d.data?.balanceLAK ?? 0)
                setEntries(d.data?.ledger ?? [])
            })
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="max-w-2xl mx-auto space-y-6 py-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">ประวัติการเงิน</h1>
                {balance !== null && (
                    <p className="text-lg font-semibold text-gray-700">
                        ยอดคงเหลือ: <span className="text-blue-600">{balance.toLocaleString()} LAK</span>
                    </p>
                )}
            </div>

            {loading ? (
                <p className="text-gray-400 text-sm">กำลังโหลด…</p>
            ) : entries.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
                    ยังไม่มีรายการ
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 text-gray-500 text-left">
                                <th className="px-5 py-3 font-medium">วันที่</th>
                                <th className="px-5 py-3 font-medium">ประเภท</th>
                                <th className="px-5 py-3 font-medium text-right">จำนวน (LAK)</th>
                                <th className="px-5 py-3 font-medium text-gray-400">หมายเหตุ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {entries.map(e => {
                                const s = TYPE_STYLE[e.type] ?? TYPE_STYLE.ADJUST
                                return (
                                    <tr key={e.id} className="hover:bg-gray-50">
                                        <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                                            {new Date(e.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>
                                                {s.label}
                                            </span>
                                        </td>
                                        <td className={`px-5 py-3 text-right font-mono font-semibold ${s.amountClass}`}>
                                            {e.amountLAK >= 0 ? '+' : ''}{e.amountLAK.toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3 text-gray-400 max-w-xs truncate">{e.note ?? '—'}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
