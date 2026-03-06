'use client'
/**
 * src/hooks/useStoreBranding.ts
 * Fetches and caches the store's displayName and logoUrl from /api/settings/store
 * Falls back to the tenant's `name` if displayName is null.
 */
import { useState, useEffect } from 'react'

export interface StoreBranding {
    displayName: string
    logoUrl: string | null
    code: string
}

let cache: StoreBranding | null = null

export function useStoreBranding(): StoreBranding {
    const [branding, setBranding] = useState<StoreBranding>(
        cache ?? { displayName: '43 Garden', logoUrl: null, code: '' }
    )

    useEffect(() => {
        if (cache) { setBranding(cache); return }
        fetch('/api/settings/store')
            .then(r => r.json())
            .then(j => {
                if (j.success && j.data) {
                    const d: StoreBranding = {
                        displayName: j.data.displayName || j.data.name || '43 Garden',
                        logoUrl: j.data.logoUrl ?? null,
                        code: j.data.code ?? '',
                    }
                    cache = d
                    setBranding(d)
                }
            })
            .catch(() => { })
    }, [])

    return branding
}

/** Invalidate cache so Sidebar refreshes after update */
export function clearStoreBrandingCache() {
    cache = null
}
