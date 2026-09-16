/**
 * reset-test-snapshot.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared definitions for the "รีเซ็ตข้อมูลทดสอบ" feature
 * (POST /api/system/reset-test) and its undo script
 * (scripts/restore-reset-snapshot.ts).
 *
 * Before the reset deletes anything it writes every row it is about to remove
 * (plus the current inventory balances and table statuses) to a JSON file
 * under `backups/reset-test/`. The restore script reads that file and puts the
 * rows back with their original ids, so a reset pressed by mistake can be
 * undone.
 */

import path from 'path'

/**
 * Prisma delegate names of every transactional table the reset clears,
 * ordered PARENTS FIRST (restore order). Delete in the reverse order.
 *
 * Every model here carries `tenantId`, so both directions are scoped to the
 * tenant that pressed the button — never the whole platform.
 */
export const RESET_TABLES = [
    // POS order tree
    'order',
    'orderItem',
    'payment',
    'deliveryInfo',
    'salesEvent',
    'consumeFailLog',
    // Stock ledger
    'stockMovement',
    // Purchasing
    'purchaseOrder',
    'purchaseItem',
    // Transfers
    'stockTransfer',
    'transferItem',
    // Adjustments
    'stockAdjustment',
    'adjustmentItem',
    // Stock counts
    'stockCount',
    'stockCountItem',
    // Prep production logs (recipes are kept)
    'prepProduction',
    // Sales imports
    'salesImport',
    'salesImportItem',
    // SKU / AI / catalog metadata
    'skuSuggestion',
    'aiItemClassification',
    'validationIssue',
    'aiRecommendation',
    'entityUsageSummary',
] as const

export type ResetTable = (typeof RESET_TABLES)[number]

export const RESET_SNAPSHOT_KIND = 'kaideeder-reset-test-snapshot'
export const RESET_SNAPSHOT_VERSION = 1

export interface ResetSnapshotInventoryRow {
    id: string
    productId: string
    locationId: string
    quantity: number
    reservedQty: number
    avgCost: number
}

export interface ResetSnapshot {
    kind: typeof RESET_SNAPSHOT_KIND
    version: typeof RESET_SNAPSHOT_VERSION
    createdAt: string
    tenant: { id: string; code: string; name: string }
    actor: { userId: string; username: string } | null
    /** Rows of every table in RESET_TABLES, keyed by delegate name. */
    tables: Record<ResetTable, unknown[]>
    /** Inventory balances at the moment of the reset (rows are kept, only zeroed). */
    inventory: ResetSnapshotInventoryRow[]
    /** Dining table statuses at the moment of the reset. */
    diningTables: { id: string; status: string }[]
}

/**
 * Directory the snapshots are written to. Defaults to `<cwd>/backups/reset-test`
 * (on the Plesk server that is `httpdocs/backups/reset-test/`); override with
 * `RESET_SNAPSHOT_DIR` when the app directory is not writable.
 */
export function resetSnapshotDir(): string {
    return process.env.RESET_SNAPSHOT_DIR || path.join(process.cwd(), 'backups', 'reset-test')
}

/** `<tenantCode>_<YYYYMMDD-HHmmss>.json`, safe for any filesystem. */
export function resetSnapshotFileName(tenantCode: string, at: Date): string {
    const safeCode = tenantCode.replace(/[^A-Za-z0-9_-]/g, '_') || 'tenant'
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp =
        `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
        `-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`
    return `${safeCode}_${stamp}.json`
}

/** Prisma model name for a delegate name (`orderItem` → `OrderItem`). */
export function modelNameOf(table: ResetTable): string {
    return table.charAt(0).toUpperCase() + table.slice(1)
}
