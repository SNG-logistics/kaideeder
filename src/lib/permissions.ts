/**
 * src/lib/permissions.ts
 * Single source of truth for RBAC permission constants and role-permission mapping.
 *
 * Usage (server):
 *   import { can, Permission } from '@/lib/permissions'
 *   if (!can(user.role, 'PRODUCT_EDIT')) return forbidden()
 *
 * Usage (client):
 *   import { usePermission } from '@/hooks/usePermission'
 *   const canEdit = usePermission('PRODUCT_EDIT')
 */

// ─── Permission constants ─────────────────────────────────────────────────────
export const PERMISSIONS = {
    // POS / Sales
    POS_USE: 'POS_USE',
    KITCHEN_VIEW: 'KITCHEN_VIEW',

    // Dashboard
    DASHBOARD_VIEW: 'DASHBOARD_VIEW',

    // Menu management
    MENU_VIEW: 'MENU_VIEW',
    MENU_EDIT: 'MENU_EDIT',

    // Products / Raw materials
    PRODUCT_VIEW: 'PRODUCT_VIEW',
    PRODUCT_EDIT: 'PRODUCT_EDIT',

    // Inventory / Stock
    INVENTORY_VIEW: 'INVENTORY_VIEW',
    ADJUSTMENT_USE: 'ADJUSTMENT_USE',

    // Purchasing / GR
    PURCHASE_VIEW: 'PURCHASE_VIEW',
    PURCHASE_CREATE: 'PURCHASE_CREATE',

    // Transfers
    TRANSFER_USE: 'TRANSFER_USE',

    // Quick actions
    QUICK_RECEIVE: 'QUICK_RECEIVE',
    WASTE_LOG: 'WASTE_LOG',

    // Recipes / BOM
    RECIPE_VIEW: 'RECIPE_VIEW',
    RECIPE_EDIT: 'RECIPE_EDIT',

    // Sales import
    SALES_IMPORT: 'SALES_IMPORT',

    // Reports
    REPORT_VIEW: 'REPORT_VIEW',

    // AI Chat
    AI_CHAT: 'AI_CHAT',

    // Settings & Users
    SETTINGS_MANAGE: 'SETTINGS_MANAGE',

    // Billing (owner only)
    BILLING_VIEW: 'BILLING_VIEW',

    // Waiter
    WAITER_VIEW: 'WAITER_VIEW',
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// ─── Role → Permission mapping ────────────────────────────────────────────────
const ALL: Permission[] = Object.values(PERMISSIONS)

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    OWNER: ALL,

    MANAGER: [
        'POS_USE', 'KITCHEN_VIEW', 'DASHBOARD_VIEW',
        'MENU_VIEW', 'MENU_EDIT',
        'PRODUCT_VIEW', 'PRODUCT_EDIT',
        'INVENTORY_VIEW', 'ADJUSTMENT_USE',
        'PURCHASE_VIEW', 'PURCHASE_CREATE',
        'TRANSFER_USE', 'QUICK_RECEIVE', 'WASTE_LOG',
        'RECIPE_VIEW', 'RECIPE_EDIT',
        'SALES_IMPORT',
        'REPORT_VIEW',
        'AI_CHAT',
    ],

    PURCHASER: [
        'DASHBOARD_VIEW',
        'PRODUCT_VIEW', 'PRODUCT_EDIT',
        'INVENTORY_VIEW',
        'PURCHASE_VIEW', 'PURCHASE_CREATE',
        'TRANSFER_USE', 'QUICK_RECEIVE',
        'RECIPE_VIEW',
        'REPORT_VIEW',
    ],

    WAREHOUSE: [
        'DASHBOARD_VIEW',
        'PRODUCT_VIEW', 'PRODUCT_EDIT',
        'INVENTORY_VIEW', 'ADJUSTMENT_USE',
        'PURCHASE_VIEW', 'PURCHASE_CREATE',
        'TRANSFER_USE', 'QUICK_RECEIVE', 'WASTE_LOG',
        'RECIPE_VIEW',
        'REPORT_VIEW',
    ],

    KITCHEN: [
        'KITCHEN_VIEW',
        'WASTE_LOG',
    ],

    BAR: [
        'KITCHEN_VIEW',
        'WASTE_LOG',
    ],

    CASHIER: [
        'POS_USE',
        'KITCHEN_VIEW',
        'DASHBOARD_VIEW',
        'REPORT_VIEW',
    ],

    WAITER: [
        'WAITER_VIEW',
        'KITCHEN_VIEW',
    ],

    VIEWER: [
        'DASHBOARD_VIEW',
        'PRODUCT_VIEW',
        'INVENTORY_VIEW',
        'PURCHASE_VIEW',
        'REPORT_VIEW',
    ],
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Check if a role has a specific permission.
 * Role comparison is case-insensitive.
 */
export function can(role: string, permission: Permission): boolean {
    const perms = ROLE_PERMISSIONS[role?.toUpperCase()] ?? []
    return perms.includes(permission)
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: string): Permission[] {
    return ROLE_PERMISSIONS[role?.toUpperCase()] ?? []
}
