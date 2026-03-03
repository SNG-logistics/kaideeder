'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from './useCurrentUser'

// Role home pages — where to redirect when access is denied
const ROLE_HOME: Record<string, string> = {
    cashier: '/pos',
    kitchen: '/kitchen?station=KITCHEN',
    bar: '/kitchen?station=BAR',
    warehouse: '/inventory',
}

/**
 * Redirect to role home if current user is not in allowedRoles.
 * Returns { user, allowed } — render null while loading or not allowed.
 */
export function useRoleGuard(allowedRoles: string[]) {
    const router = useRouter()
    const user = useCurrentUser()

    useEffect(() => {
        if (!user) return
        if (!allowedRoles.includes(user.role)) {
            router.replace(ROLE_HOME[user.role] ?? '/dashboard')
        }
    }, [user, router, allowedRoles])

    const allowed = !user || allowedRoles.includes(user.role)
    return { user, allowed }
}
