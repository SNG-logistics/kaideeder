/**
 * scripts/restore-reset-snapshot.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Undo a "รีเซ็ตข้อมูลทดสอบ" (POST /api/system/reset-test) from the JSON
 * snapshot the reset wrote just before deleting.
 *
 * Usage (run in the app directory, e.g. /var/www/vhosts/kaideeder.com/httpdocs):
 *
 *   npx tsx scripts/restore-reset-snapshot.ts backups/reset-test/<file>.json --dry-run
 *   npx tsx scripts/restore-reset-snapshot.ts backups/reset-test/<file>.json
 *
 * Options:
 *   --dry-run          print what would be restored, change nothing
 *   --skip-inventory   put the rows back but leave inventory balances as they are
 *   --force            restore inventory balances even though stock movements
 *                      newer than the snapshot exist (they will be overwritten)
 *
 * DATABASE_URL is taken from the environment, else from .env.production, else
 * from .env (same precedence as the deploy scripts).
 *
 * Rows are re-inserted with their original ids using `createMany` with
 * `skipDuplicates`, so running the script twice is harmless and anything
 * created after the reset is kept.
 */

import fs from 'fs'
import path from 'path'
import { PrismaClient, Prisma } from '@prisma/client'
import {
    RESET_TABLES,
    RESET_SNAPSHOT_KIND,
    modelNameOf,
    type ResetSnapshot,
    type ResetTable,
} from '../src/lib/reset-test-snapshot'

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flags = new Set(args.filter(a => a.startsWith('--')))
const file = args.find(a => !a.startsWith('--'))
const dryRun = flags.has('--dry-run')
const skipInventory = flags.has('--skip-inventory')
const force = flags.has('--force')

if (!file) {
    console.error('Usage: npx tsx scripts/restore-reset-snapshot.ts <snapshot.json> [--dry-run] [--skip-inventory] [--force]')
    process.exit(1)
}

// ─── DATABASE_URL ────────────────────────────────────────────────────────────
function loadDatabaseUrl(): string {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL
    for (const envFile of ['.env.production', '.env']) {
        try {
            const content = fs.readFileSync(envFile, 'utf8')
            const m = content.match(/^DATABASE_URL=["']?([^"'\n\r]+)["']?/m)
            if (m) return m[1].trim()
        } catch { /* try next */ }
    }
    console.error('❌ ไม่พบ DATABASE_URL (ตั้ง env หรือใส่ใน .env.production)')
    process.exit(1)
}
const dbUrl = loadDatabaseUrl()
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } }, log: ['warn', 'error'] })

// ─── Helpers ─────────────────────────────────────────────────────────────────
const CHUNK = 500

/** Json columns per model — a JS `null` there must become Prisma.DbNull. */
const jsonFieldsByModel = new Map<string, string[]>()
for (const m of Prisma.dmmf.datamodel.models) {
    jsonFieldsByModel.set(m.name, m.fields.filter(f => f.type === 'Json').map(f => f.name))
}

function prepareRow(table: ResetTable, row: any) {
    const jsonFields = jsonFieldsByModel.get(modelNameOf(table)) || []
    if (jsonFields.length === 0) return row
    const out = { ...row }
    for (const f of jsonFields) if (out[f] === null) out[f] = Prisma.DbNull
    return out
}

function chunks<T>(arr: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    const abs = path.resolve(file!)
    const snapshot = JSON.parse(fs.readFileSync(abs, 'utf8')) as ResetSnapshot

    if (snapshot.kind !== RESET_SNAPSHOT_KIND) {
        console.error(`❌ ไฟล์นี้ไม่ใช่ snapshot ของ reset-test (kind=${snapshot.kind})`)
        process.exit(1)
    }

    console.log('╔══════════════════════════════════════════════╗')
    console.log('║   ♻️  Restore reset-test snapshot              ║')
    console.log('╚══════════════════════════════════════════════╝')
    console.log(`  File     : ${abs}`)
    console.log(`  Tenant   : ${snapshot.tenant.code} — ${snapshot.tenant.name} (${snapshot.tenant.id})`)
    console.log(`  Taken at : ${snapshot.createdAt}`)
    console.log(`  By       : ${snapshot.actor?.username ?? '-'}`)
    console.log(`  Mode     : ${dryRun ? 'DRY RUN (no changes)' : 'APPLY'}\n`)

    const tenant = await prisma.tenant.findUnique({ where: { id: snapshot.tenant.id }, select: { id: true, code: true } })
    if (!tenant) {
        console.error(`❌ ไม่พบ tenant id ${snapshot.tenant.id} ในฐานข้อมูลนี้`)
        process.exit(1)
    }
    if (tenant.code !== snapshot.tenant.code) {
        console.warn(`⚠️  tenant code ใน DB (${tenant.code}) ไม่ตรงกับ snapshot (${snapshot.tenant.code}) — ตรวจสอบก่อนว่าใช่ DB เดียวกัน`)
    }
    const tenantId = tenant.id

    // Row counts
    console.log('  Rows in snapshot:')
    let totalRows = 0
    for (const table of RESET_TABLES) {
        const n = snapshot.tables[table]?.length ?? 0
        totalRows += n
        if (n > 0) console.log(`    ${table.padEnd(22)} ${n}`)
    }
    console.log(`    ${'inventory (balances)'.padEnd(22)} ${snapshot.inventory.length}`)
    console.log(`    ${'diningTables (status)'.padEnd(22)} ${snapshot.diningTables.length}`)
    console.log(`  Total rows: ${totalRows}\n`)

    // Has the store kept working since the reset?
    const newerMovements = await prisma.stockMovement.count({
        where: { tenantId, createdAt: { gt: new Date(snapshot.createdAt) } },
    })
    let restoreInventory = !skipInventory
    if (newerMovements > 0) {
        console.warn(`⚠️  มี stock movement ใหม่ ${newerMovements} รายการหลังเวลารีเซ็ต — สต็อกปัจจุบันไม่ใช่ค่าตอนรีเซ็ตแล้ว`)
        if (restoreInventory && !force) {
            console.warn('    → จะ "ไม่" เขียนทับยอดคงเหลือ (ใส่ --force ถ้าต้องการให้ทับด้วยค่าใน snapshot)\n')
            restoreInventory = false
        } else if (restoreInventory) {
            console.warn('    → --force: จะเขียนทับยอดคงเหลือด้วยค่าใน snapshot\n')
        }
    }

    if (dryRun) {
        console.log('✅ DRY RUN เสร็จ — ไม่มีการเปลี่ยนแปลง')
        return
    }

    const summary = await prisma.$transaction(async (tx) => {
        const inserted: Record<string, number> = {}

        // 1. Rows, parents first, original ids kept
        for (const table of RESET_TABLES) {
            const rows = (snapshot.tables[table] ?? []) as any[]
            if (rows.length === 0) continue
            let n = 0
            for (const part of chunks(rows, CHUNK)) {
                const r = await (tx as any)[table].createMany({
                    data: part.map(row => prepareRow(table, { ...row, tenantId })),
                    skipDuplicates: true,
                })
                n += r.count
            }
            inserted[table] = n
            console.log(`  ✅ ${table.padEnd(22)} +${n}${n < rows.length ? `  (${rows.length - n} มีอยู่แล้ว ข้าม)` : ''}`)
        }

        // 2. Inventory balances
        let invRestored = 0
        if (restoreInventory) {
            for (const inv of snapshot.inventory) {
                await tx.inventory.upsert({
                    where: { tenantId_productId_locationId: { tenantId, productId: inv.productId, locationId: inv.locationId } },
                    update: { quantity: inv.quantity, reservedQty: inv.reservedQty, avgCost: inv.avgCost },
                    create: { id: inv.id, tenantId, productId: inv.productId, locationId: inv.locationId, quantity: inv.quantity, reservedQty: inv.reservedQty, avgCost: inv.avgCost },
                })
                invRestored++
            }
            console.log(`  ✅ ${'inventory'.padEnd(22)} ${invRestored} balances restored`)
        } else {
            console.log(`  ⏭️  ${'inventory'.padEnd(22)} skipped`)
        }

        // 3. Dining table statuses
        let tblRestored = 0
        for (const t of snapshot.diningTables) {
            const r = await tx.diningTable.updateMany({ where: { id: t.id, tenantId }, data: { status: t.status as any } })
            tblRestored += r.count
        }
        console.log(`  ✅ ${'diningTables'.padEnd(22)} ${tblRestored} statuses restored`)

        await tx.auditLog.create({
            data: {
                actorType: 'TENANT_USER',
                userId: snapshot.actor?.userId ?? null,
                tenantId,
                action: 'RESTORE_TEST_DATA',
                payload: { snapshotFile: path.basename(abs), snapshotCreatedAt: snapshot.createdAt, inserted, invRestored, tblRestored } as any,
            },
        }).catch(() => { /* non-critical */ })

        return { inserted, invRestored, tblRestored }
    }, { timeout: 10 * 60 * 1000, maxWait: 30 * 1000 })

    const total = Object.values(summary.inserted).reduce((a, b) => a + b, 0)
    console.log(`\n✅ กู้คืนเสร็จ: ${total} rows, inventory ${summary.invRestored}, tables ${summary.tblRestored}`)
    if (!restoreInventory && !skipInventory) {
        console.log('   ⚠️  ยอดคงเหลือไม่ได้ถูกกู้คืน — รันซ้ำพร้อม --force หรือปรับสต็อกด้วยมือ')
    }
}

main()
    .catch(e => { console.error('❌ Error:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
