'use client'
/**
 * useT() — lightweight i18n hook for customer-facing pages
 *
 * Usage:
 *   const { t, lang, setLang } = useT()
 *   t('loading')                   → "กำลังโหลด…"
 *   t('table_no', { n: tableNum }) → "โต๊ะ 3"
 *
 * Language priority:
 *   1. localStorage('kaideeder_lang')
 *   2. Browser navigator.language (th/lo/en detection)
 *   3. 'th' fallback
 */
import { useState, useEffect, useCallback } from 'react'
import { translations, interpolate, type Lang } from './translations'

const STORAGE_KEY = 'kaideeder_lang'

function detectBrowserLang(): Lang {
    if (typeof navigator === 'undefined') return 'th'
    const bl = navigator.language?.toLowerCase() ?? ''
    if (bl.startsWith('lo')) return 'lo'
    if (bl.startsWith('en')) return 'en'
    return 'th'
}

function getSavedLang(): Lang {
    try {
        const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
        if (saved && ['th', 'lo', 'en'].includes(saved)) return saved
    } catch {}
    return detectBrowserLang()
}

export function useT(defaultLang?: Lang) {
    // Start with server-safe default to avoid hydration mismatch
    const [lang, setLangState] = useState<Lang>(defaultLang ?? 'th')
    const [mounted, setMounted] = useState(false)

    // After mount, read from localStorage (client only)
    useEffect(() => {
        setLangState(getSavedLang())
        setMounted(true)
    }, [])

    const setLang = useCallback((l: Lang) => {
        setLangState(l)
        try { localStorage.setItem(STORAGE_KEY, l) } catch {}
    }, [])

    const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
        const dict = translations[lang]
        const raw = dict?.[key] ?? translations['th'][key] ?? key
        return vars ? interpolate(raw, vars) : raw
    }, [lang])

    return { t, lang, setLang, mounted }
}

export type { Lang }
