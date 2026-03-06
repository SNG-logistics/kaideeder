'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CHANNELS = ['BCEL Online', 'โอนธนาคาร', 'เงินสด']

export default function TopupPage() {
    const router = useRouter()
    const [amount, setAmount] = useState('')
    const [channel, setChannel] = useState(CHANNELS[0])
    const [proofUrl, setProofUrl] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const lak = parseInt(amount.replace(/,/g, ''))
        if (isNaN(lak) || lak < 10_000) {
            setError('จำนวนขั้นต่ำ 10,000 LAK')
            return
        }
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/billing/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amountLAK: lak, channel, proofUrl: proofUrl || undefined }),
            })
            const data = await res.json()
            if (!data.success) return setError(data.error || 'เกิดข้อผิดพลาด')
            setSuccess(true)
            setTimeout(() => router.push('/billing'), 2000)
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="max-w-md mx-auto mt-20 text-center space-y-3">
                <p className="text-5xl">✅</p>
                <p className="text-lg font-semibold text-gray-800">ส่งคำขอเติมเงินแล้ว</p>
                <p className="text-gray-500 text-sm">รอ Admin อนุมัติ กำลังกลับไปหน้า Billing…</p>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto space-y-6 py-6">
            <h1 className="text-2xl font-bold text-gray-900">เติมเงินกระเป๋า</h1>

            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
                {error && (
                    <p className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">{error}</p>
                )}

                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">จำนวนเงิน (LAK)</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="เช่น 500,000"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">ช่องทางการโอน</label>
                    <select
                        value={channel}
                        onChange={e => setChannel(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500"
                    >
                        {CHANNELS.map(c => <option key={c}>{c}</option>)}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">URL หลักฐานการโอน (ไม่บังคับ)</label>
                    <input
                        type="url"
                        placeholder="https://…"
                        value={proofUrl}
                        onChange={e => setProofUrl(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-400">อัปโหลด slip แล้ว copy URL มาวาง</p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white font-semibold py-3 rounded-lg transition"
                >
                    {loading ? 'กำลังส่ง…' : 'ส่งคำขอเติมเงิน'}
                </button>
            </form>
        </div>
    )
}
