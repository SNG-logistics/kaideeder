import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { withAuth, err } from '@/lib/api'
import {
    RESET_TABLES,
    RESET_SNAPSHOT_KIND,
    RESET_SNAPSHOT_VERSION,
    resetSnapshotDir,
    resetSnapshotFileName,
    type ResetSnapshot,
    type ResetTable,
} from '@/lib/reset-test-snapshot'

/**
 * POST /api/system/reset-test — OWNER only
 *
 * Clears every transactional table for the CALLER'S TENANT ONLY and zeroes its
 * inventory; master data (products, categories, users, recipes, locations,
 * suppliers, tables) is kept.
 *
 * Safety net: before touching the database the rows about to be removed are
 * written to `backups/reset-test/<tenantCode>_<timestamp>.json`. If that file
 * cannot be written, nothing is deleted. A reset pressed by mistake is undone
 * with:
 *
 *     npx tsx scripts/restore-reset-snapshot.ts backups/reset-test/<file>.json
 *
 * See docs/RESTORE_AFTER_RESET.md.
 */
export const POST = withAuth<any>(async (req: NextRequest, { user, tenantId }) => {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, code: true, name: true },
    })
    if (!tenant) return err('ไม่พบร้านค้า', 404)

    // ── 1. Snapshot everything we are about to delete/zero ──────────────────
    const now = new Date()
    const where = { tenantId }
    const tables = {} as Record<ResetTable, unknown[]>
    for (const table of RESET_TABLES) {
        tables[table] = await (prisma as any)[table].findMany({ where })
    }
    const inventory = await prisma.inventory.findMany({
        where,
        select: { id: true, productId: true, locationId: true, quantity: true, reservedQty: true, avgCost: true },
    })
    const diningTables = await prisma.diningTable.findMany({
        where,
        select: { id: true, status: true },
    })

    const snapshot: ResetSnapshot = {
        kind: RESET_SNAPSHOT_KIND,
        version: RESET_SNAPSHOT_VERSION,
        createdAt: now.toISOString(),
        tenant,
        actor: user ? { userId: user.userId, username: user.username } : null,
        tables,
        inventory,
        diningTables,
    }

    const dir = resetSnapshotDir()
    const fileName = resetSnapshotFileName(tenant.code, now)
    const filePath = path.join(dir, fileName)
    try {
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(filePath, JSON.stringify(snapshot), 'utf8')
    } catch (e: any) {
        console.error('[reset-test] snapshot write failed, nothing deleted:', e)
        return err(`สำรองข้อมูลก่อนรีเซ็ตไม่สำเร็จ จึงยังไม่ลบข้อมูลใดๆ (${e?.message || e})`, 500)
    }
    const snapshotFile = path.relative(process.cwd(), filePath) || filePath

    // ── 2. Delete (children first) + zero inventory + free tables ───────────
    let counts: Record<ResetTable, number>
    let inventoryReset = 0
    let tablesReset = 0
    try {
        const result = await prisma.$transaction(async (tx) => {
            const c = {} as Record<ResetTable, number>
            for (const table of [...RESET_TABLES].reverse()) {
                const r = await (tx as any)[table].deleteMany({ where })
                c[table] = r.count
            }
            const inv = await tx.inventory.updateMany({
                where,
                data: { quantity: 0, reservedQty: 0, avgCost: 0 },
            })
            const tbl = await tx.diningTable.updateMany({
                where,
                data: { status: 'AVAILABLE' },
            })
            return { c, inv: inv.count, tbl: tbl.count }
        }, { timeout: 60000 })
        counts = result.c
        inventoryReset = result.inv
        tablesReset = result.tbl
    } catch (e: any) {
        console.error('[reset-test]', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }

    const data = {
        // POS
        orders: counts.order,
        orderItems: counts.orderItem,
        payments: counts.payment,
        deliveryInfos: counts.deliveryInfo,
        salesEvents: counts.salesEvent,
        consumeFailLogs: counts.consumeFailLog,
        // Stock
        movements: counts.stockMovement,
        inventoryReset,
        // Purchasing
        purchaseOrders: counts.purchaseOrder,
        purchaseItems: counts.purchaseItem,
        // Transfers & Adjustments
        stockTransfers: counts.stockTransfer,
        stockAdjustments: counts.stockAdjustment,
        // Stock counts
        stockCounts: counts.stockCount,
        // Prep
        prepProductions: counts.prepProduction,
        // Sales imports
        salesImports: counts.salesImport,
        // SKU / AI
        skuSuggestions: counts.skuSuggestion,
        aiClassifications: counts.aiItemClassification,
        aiRecommendations: counts.aiRecommendation,
        validationIssues: counts.validationIssue,
        // Tables
        tablesReset,
    }

    // ── 3. Audit trail (non-critical) ───────────────────────────────────────
    await prisma.auditLog.create({
        data: {
            actorType: 'TENANT_USER',
            userId: user?.userId,
            tenantId,
            action: 'RESET_TEST_DATA',
            payload: { snapshotFile, ...data } as any,
            ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        },
    }).catch((e) => console.error('[reset-test] audit log failed:', e))

    return NextResponse.json({
        success: true,
        message: 'รีเซ็ตข้อมูลทดสอบสำเร็จ — ครบทุกตาราง',
        data,
        snapshot: {
            file: snapshotFile,
            restoreCommand: `npx tsx scripts/restore-reset-snapshot.ts ${snapshotFile}`,
        },
    })
}, ['OWNER'])
