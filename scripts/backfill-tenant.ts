/**
 * scripts/backfill-tenant.ts
 *
 * One-time migration: seed the first Tenant, then stamp tenantId on every
 * existing row across all 21 store tables.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/backfill-tenant.ts --dry-run
 *   npx ts-node --project tsconfig.json scripts/backfill-tenant.ts
 *
 * After this script succeeds, run:
 *   npx prisma migrate dev --name add_tenant_layer
 */

// @ts-nocheck — Prisma client types will be stale until `prisma generate` runs
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'   // built-in Node.js — no install needed

const prisma = new PrismaClient()

// ── Customise these before running ─────────────────────────────────────────
const TENANT_CODE = process.env.TENANT_CODE || 'store-001'
const TENANT_NAME = process.env.TENANT_NAME || 'My Restaurant'
// ───────────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
    console.log(`\n🚀  Tenant back-fill script — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

    // 1. Find or create the default Tenant
    let tenant = await (prisma as any).tenant.findUnique({ where: { code: TENANT_CODE } })

    if (!tenant) {
        if (DRY_RUN) {
            const fakeId = `dry-${randomUUID()}`
            console.log(`[DRY] Would CREATE tenant: code=${TENANT_CODE}, name=${TENANT_NAME}, id=${fakeId}`)
            tenant = { id: fakeId, code: TENANT_CODE, name: TENANT_NAME }
        } else {
            tenant = await (prisma as any).tenant.create({
                data: { code: TENANT_CODE, name: TENANT_NAME, status: 'ACTIVE' },
            })
            console.log(`✅  Created tenant: ${tenant.name} (${tenant.id})`)
        }
    } else {
        console.log(`ℹ️  Found existing tenant: ${tenant.name} (${tenant.id})`)
    }

    const tenantId = tenant.id

    // 2. Seed a default Wallet for the tenant
    const existingWallet = await (prisma as any).wallet.findUnique({ where: { tenantId } }).catch(() => null)
    if (!existingWallet) {
        if (DRY_RUN) {
            console.log(`[DRY] Would CREATE wallet for tenant ${tenantId}`)
        } else {
            await (prisma as any).wallet.create({ data: { tenantId, balanceLAK: 0 } })
            console.log(`✅  Created wallet for tenant`)
        }
    }

    // 3. Tables to back-fill and the model name in Prisma
    const tables: Array<{ model: string; label: string }> = [
        { model: 'user', label: 'Users' },
        { model: 'category', label: 'Categories' },
        { model: 'product', label: 'Products' },
        { model: 'location', label: 'Locations' },
        { model: 'inventory', label: 'Inventory' },
        { model: 'stockMovement', label: 'StockMovements' },
        { model: 'purchaseOrder', label: 'PurchaseOrders' },
        { model: 'purchaseItem', label: 'PurchaseItems' },
        { model: 'supplier', label: 'Suppliers' },
        { model: 'stockTransfer', label: 'StockTransfers' },
        { model: 'transferItem', label: 'TransferItems' },
        { model: 'stockAdjustment', label: 'StockAdjustments' },
        { model: 'adjustmentItem', label: 'AdjustmentItems' },
        { model: 'recipe', label: 'Recipes' },
        { model: 'recipeBOM', label: 'RecipeBOMs' },
        { model: 'salesImport', label: 'SalesImports' },
        { model: 'salesImportItem', label: 'SalesImportItems' },
        { model: 'diningTable', label: 'DiningTables' },
        { model: 'order', label: 'Orders' },
        { model: 'orderItem', label: 'OrderItems' },
        { model: 'payment', label: 'Payments' },
        { model: 'salesEvent', label: 'SalesEvents' },
    ]

    for (const { model, label } of tables) {
        const repo = (prisma as any)[model]
        if (!repo) {
            console.warn(`⚠️   Model "${model}" not found in Prisma client — skipping`)
            continue
        }

        // Count rows without tenantId
        const count = await repo.count({ where: { tenantId: null } })

        if (count === 0) {
            console.log(`  ✓  ${label}: all rows already have tenantId`)
            continue
        }

        if (DRY_RUN) {
            console.log(`[DRY] Would update ${count} rows in ${label} → tenantId=${tenantId}`)
        } else {
            const result = await repo.updateMany({
                where: { tenantId: null },
                data: { tenantId },
            })
            console.log(`  ✅  ${label}: stamped ${result.count} rows`)
        }
    }

    if (DRY_RUN) {
        console.log('\n✅  Dry run complete — no changes made.')
        console.log('    Run without --dry-run to apply.\n')
    } else {
        console.log('\n🎉  Back-fill complete!')
        console.log('    Next step: npx prisma migrate dev --name add_tenant_layer\n')
    }
}

main()
    .catch(e => { console.error('\n❌  Error:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
