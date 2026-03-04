// ============================================================
// policy.ts — Role-Based Access Control Policy Constants
// ============================================================

export const ROLES = {
    OWNER: 'OWNER',
    MANAGER: 'MANAGER',
    CASHIER: 'CASHIER',
    STAFF: 'STAFF',
    KITCHEN: 'KITCHEN',
    WAREHOUSE: 'WAREHOUSE',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// ── Zone / Table management ──────────────────────────────────
export const CAN_MANAGE_ZONE_TABLE: Role[] = ['OWNER', 'MANAGER']
export const CAN_VIEW_ZONE_TABLE: Role[] = ['OWNER', 'MANAGER', 'CASHIER', 'STAFF']

// ── Products / Inventory ─────────────────────────────────────
export const CAN_MANAGE_PRODUCTS: Role[] = ['OWNER', 'MANAGER']
export const CAN_VIEW_PRODUCTS: Role[] = ['OWNER', 'MANAGER', 'WAREHOUSE', 'KITCHEN']
export const CAN_MANAGE_INVENTORY: Role[] = ['OWNER', 'MANAGER', 'WAREHOUSE']

// ── Orders / POS ─────────────────────────────────────────────
export const CAN_TAKE_ORDER: Role[] = ['OWNER', 'MANAGER', 'STAFF', 'CASHIER']
export const CAN_DISCOUNT_ORDER: Role[] = ['OWNER', 'MANAGER']
export const CAN_VOID_ORDER: Role[] = ['OWNER', 'MANAGER']

// ── Reports ──────────────────────────────────────────────────
export const CAN_VIEW_REPORTS: Role[] = ['OWNER', 'MANAGER']
export const CAN_VIEW_DAILY_SUMMARY: Role[] = ['OWNER', 'MANAGER', 'CASHIER']

// ── Settings / System ────────────────────────────────────────
export const CAN_MANAGE_USERS: Role[] = ['OWNER']
export const CAN_MANAGE_SETTINGS: Role[] = ['OWNER']
export const CAN_RESET_DATA: Role[] = ['OWNER']
export const CAN_IMPORT_PRODUCTS: Role[] = ['OWNER']
