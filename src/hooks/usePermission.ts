'use client'
/**
 * src/hooks/usePermission.ts
 * Client-side permission check — reads from /api/auth/me (cached by useCurrentUser).
 *
 * Usage:
 *   const canEdit = usePermission('PRODUCT_EDIT')
 *   const { can } = usePermissions()
 *   if (!can('PURCHASE_CREATE')) return null
 */
import { useCurrentUser } from './useCurrentUser'
import type { Permission } from '@/lib/permissions'

/**
 * Check a single permission for the current user.
 * Returns false while user is loading (null).
 */
export function usePermission(permission: Permission): boolean {
    const user = useCurrentUser()
    if (!user) return false
    return user.permissions.includes(permission)
}

/**
 * Get a helper object for multiple permission checks.
 * const { can, permissions } = usePermissions()
 */
export function usePermissions() {
    const user = useCurrentUser()
    const permissions = new Set<string>(user?.permissions ?? [])

    return {
        can: (permission: Permission): boolean => permissions.has(permission),
        permissions,
        loaded: user !== null,
        role: user?.role ?? '',
    }
}
