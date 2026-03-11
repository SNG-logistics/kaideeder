'use client'
/**
 * src/context/TenantContext.tsx
 * Provides tenant settings (currency, language, store info) to all components
 */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { formatCurrency, currencySymbol, type CurrencyCode } from '@/lib/currency'
import { getDict, type Lang } from '@/lib/i18n'

export interface TenantSettings {
    id: string
    code: string
    name: string
    displayName: string | null
    storeNameLao: string | null
    logoUrl: string | null
    currency: CurrencyCode
    language: Lang
    phone: string | null
    address: string | null
    taxId: string | null
    receiptHeader: string | null
    timezone: string
}

interface TenantContextValue {
    settings: TenantSettings | null
    loading: boolean
    /** formatCurrency ตาม currency ของ tenant */
    fmt: (amount: number) => string
    /** symbol ₭ หรือ ฿ */
    symbol: string
    /** translation function */
    t: (key: string) => string
    /** ชื่อร้าน (ภาษาหลัก) */
    storeName: string
    /** refetch settings after save */
    reload: () => void
}

const TenantContext = createContext<TenantContextValue>({
    settings: null,
    loading: true,
    fmt: (n) => `${n.toLocaleString()} ₭`,
    symbol: '₭',
    t: (k) => k,
    storeName: '',
    reload: () => {},
})

export function TenantProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<TenantSettings | null>(null)
    const [loading, setLoading] = useState(true)
    const [rev, setRev] = useState(0)

    useEffect(() => {
        fetch('/api/tenant/settings')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.settings) setSettings(data.settings)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [rev])

    const currency = (settings?.currency ?? 'LAK') as CurrencyCode
    const language = (settings?.language ?? 'th') as Lang

    const value: TenantContextValue = {
        settings,
        loading,
        fmt: (n) => formatCurrency(n, currency),
        symbol: currencySymbol(currency),
        t: getDict(language),
        storeName: settings?.displayName || settings?.name || '',
        reload: () => setRev(r => r + 1),
    }

    return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant() {
    return useContext(TenantContext)
}

/** Convenience hook for currency only */
export function useCurrency() {
    const { fmt, symbol, settings } = useTenant()
    return { fmt, symbol, currency: settings?.currency ?? 'LAK' }
}

/** Convenience hook for translation only */
export function useT() {
    const { t } = useTenant()
    return t
}
