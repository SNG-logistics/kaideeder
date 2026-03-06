'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type SubInfo = {
    tenantStatus: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED'
    subEndsAt: string | null
    graceEndsAt: string | null
    daysLeft: number | null
    activePlan: { code: string; name: string; priceLAK: number; durationDays: number } | null
    walletLAK?: number
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'Active', className: 'text-emerald-400' },
    PAST_DUE: { label: 'Past Due', className: 'text-amber-400' },
    SUSPENDED: { label: 'Suspended', className: 'text-red-400' },
}

export default function BillingPage() {
    const [info, setInfo] = useState<SubInfo | null>(null)
    const [wallet, setWallet] = useState<{ balanceLAK: number } | null>(null)

    useEffect(() => {
        fetch('/api/billing/subscription').then(r => r.json()).then(d => setInfo(d.data))
        fetch('/api/billing/wallet').then(r => r.json()).then(d => setWallet(d.data))
    }, [])

    const status = info ? STATUS_STYLE[info.tenantStatus] : null

    return (
        <div className="max-w-2xl mx-auto space-y-6 py-6">
            <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>

            {/* Plan card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-700">Current Plan</h2>
                    {status && (
                        <span className={`text-sm font-semibold ${status.className}`}>{status.label}</span>
                    )}
                </div>
                {info ? (
                    <div>
                        <p className="text-3xl font-bold text-gray-900">{info.activePlan?.name ?? 'No plan'}</p>
                        {info.subEndsAt && (
                            <p className="text-gray-500 text-sm mt-1">
                                Expires: {new Date(info.subEndsAt).toLocaleDateString()}
                                {info.daysLeft !== null && (
                                    <span className={`ml-2 font-semibold ${info.daysLeft <= 5 ? 'text-red-500' : 'text-gray-700'}`}>
                                        ({info.daysLeft} days left)
                                    </span>
                                )}
                            </p>
                        )}
                        {info.tenantStatus === 'PAST_DUE' && info.graceEndsAt && (
                            <p className="mt-2 text-amber-600 text-sm font-medium">
                                ⚠️ Grace period ends: {new Date(info.graceEndsAt).toLocaleDateString()}
                            </p>
                        )}
                        {info.tenantStatus === 'SUSPENDED' && (
                            <p className="mt-2 text-red-600 text-sm font-medium">
                                🔒 Account suspended. Please top up to reactivate.
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-400 text-sm">Loading…</p>
                )}
            </div>

            {/* Wallet card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="font-semibold text-gray-700">Wallet Balance</h2>
                <p className="text-4xl font-bold text-gray-900">
                    {wallet ? wallet.balanceLAK.toLocaleString() : '—'}
                    <span className="text-lg text-gray-400 font-normal ml-2">LAK</span>
                </p>
                <div className="flex gap-3">
                    <Link
                        href="/billing/topup"
                        className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
                    >
                        เติมเงิน
                    </Link>
                    <Link
                        href="/billing/ledger"
                        className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium px-5 py-2 rounded-lg transition"
                    >
                        ประวัติการเงิน
                    </Link>
                </div>
            </div>
        </div>
    )
}
