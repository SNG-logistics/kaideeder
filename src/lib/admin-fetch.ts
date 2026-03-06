/**
 * src/lib/admin-fetch.ts
 * Helper: attach Authorization: Bearer <admin_token> from localStorage
 * to every admin API request so cookie-path issues don't matter.
 */

export function adminHeaders(): HeadersInit {
    if (typeof window === 'undefined') return {}
    const token = localStorage.getItem('admin_token')
    if (!token) return {}
    return { 'Authorization': `Bearer ${token}` }
}

/**
 * Convenience wrapper — same API as fetch() but auto-injects admin token.
 * Usage: await adminFetch('/api/admin/tenants')
 */
export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
        ...adminHeaders(),
        ...(options.headers ?? {}),
    }
    return fetch(url, { ...options, headers })
}

/** Call this on logout */
export function clearAdminToken() {
    if (typeof window !== 'undefined') localStorage.removeItem('admin_token')
}
