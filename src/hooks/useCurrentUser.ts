'use client'
import { useState, useEffect } from 'react'

export interface CurrentUser {
    userId: string
    username: string
    role: string
    name: string
    tenantId?: string
    permissions: string[]
}

// Module-level cache — persists across client navigations
let cachedUser: CurrentUser | null = null

export function useCurrentUser(): CurrentUser | null {
    // ⚠️ ALWAYS init with null (not cachedUser) so server and client
    // start with identical state and avoid hydration mismatch.
    // cachedUser is applied inside useEffect (client-only).
    const [user, setUser] = useState<CurrentUser | null>(null)

    useEffect(() => {
        if (cachedUser) {
            setUser(cachedUser)
            return
        }

        // NOTE: Do NOT check document.cookie for 'token=' here.
        // The token cookie is httpOnly — JavaScript cannot read it.
        // We rely on /api/auth/me returning 401 to detect unauthenticated state.

        fetch('/api/auth/me')
            .then(async r => {
                if (r.status === 401 || r.status === 403) {
                    window.location.href = '/login'
                    return null
                }
                return r.json()
            })
            .then(j => {
                if (j && j.success) {
                    // Normalize role to lowercase — JWT may store 'OWNER', 'MANAGER', etc.
                    const data: CurrentUser = {
                        ...j.data,
                        role: (j.data.role || '').toLowerCase(),
                        permissions: j.data.permissions ?? [],
                    }
                    cachedUser = data
                    setUser(data)
                }
            })
            .catch(() => { })
    }, [])

    return user
}

/** Call to invalidate cache on logout */
export function clearCurrentUserCache() {
    cachedUser = null
}
