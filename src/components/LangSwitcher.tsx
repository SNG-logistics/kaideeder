'use client'
/**
 * LangSwitcher — Floating language pill (TH / LO / EN)
 * Used on all customer-facing pages
 */
import { useT, type Lang } from '@/lib/i18n/useT'

interface Props {
    /** Pass lang and setLang from parent useT() to share state */
    lang: Lang
    setLang: (l: Lang) => void
    /** Color theme: 'dark' (delivery) | 'light' (QR menu) */
    theme?: 'dark' | 'light'
}

const LANGS: { code: Lang; label: string; flag: string }[] = [
    { code: 'th', label: 'TH', flag: '🇹🇭' },
    { code: 'lo', label: 'LO', flag: '🇱🇦' },
    { code: 'en', label: 'EN', flag: '🇬🇧' },
]

export function LangSwitcher({ lang, setLang, theme = 'dark' }: Props) {
    const isDark = theme === 'dark'
    const bg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
    const activeBg = isDark ? 'rgba(225,29,72,0.8)' : 'rgba(42,157,80,0.85)'
    const activeColor = '#fff'
    const inactiveColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
    const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '3px 4px',
                borderRadius: 20,
                background: bg,
                border: `1px solid ${border}`,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
            }}
        >
            {LANGS.map(l => {
                const isActive = lang === l.code
                return (
                    <button
                        key={l.code}
                        onClick={() => setLang(l.code)}
                        title={l.label}
                        style={{
                            padding: '4px 8px',
                            borderRadius: 16,
                            border: 'none',
                            background: isActive ? activeBg : 'transparent',
                            color: isActive ? activeColor : inactiveColor,
                            fontWeight: isActive ? 800 : 500,
                            fontSize: '0.68rem',
                            cursor: 'pointer',
                            fontFamily: "'Outfit',system-ui,sans-serif",
                            letterSpacing: '0.04em',
                            transition: 'all 0.15s',
                            lineHeight: 1,
                            minWidth: 32,
                            textAlign: 'center',
                        }}
                    >
                        {l.label}
                    </button>
                )
            })}
        </div>
    )
}
