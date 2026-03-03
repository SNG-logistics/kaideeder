'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from './useCurrentUser'

// Where each role lands when redirected away from a forbidden page
const ROLE_HOME: Record<string, string> = {
    cashier: '/pos',
    kitchen: '/kitchen?station=KITCHEN',
    bar: '/kitchen?station=BAR',
    warehouse: '/inventory',
}

/**
 * Redirect to role home if current user is not in allowedRoles.
 * Runs redirect via useEffect (client-only, no blocking render).
 * Uses useRef for allowedRoles to keep stable effect deps.
 */
export function useRoleGuard(allowedRoles: string[]) {
    const router = useRouter()
    const user = useCurrentUser()
    // Stable ref so effect doesn't re-fire when page re-renders
    const rolesRef = useRef(allowedRoles)

    useEffect(() => {
        if (!user) return                              // still loading
        if (rolesRef.current.includes(user.role)) return  // allowed, do nothing
        const dest = ROLE_HOME[user.role] ?? '/dashboard'
        router.replace(dest)
    }, [user, router])   // allowedRoles intentionally excluded — stable via ref
}
