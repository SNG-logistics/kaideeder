import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'
import * as XLSX from 'xlsx'
import {
    normalizeName,
    findBestMatch,
    shouldExcludeFromStock,
    guessUnit,
    type MatchCandidate,
} from '@/lib/sku-matcher'

/**
 * POST /api/master/import?type=sku_master|sku_aliases|categories
 *
 * Import Pipeline (TASK-2 + TASK-3):
 *   Row has sku_code → UPSERT by sku
 *   Row no sku_code  → findBestMatch in DB + aliases
 *     score ≥ 0.85 → auto-map (update + create alias)
 *     score 0.60-0.84 → create SkuSuggestion (REVIEW)
 *     score < 0.60  → create SkuSuggestion with suggestedSku (SUGGEST_NEW)
 *
 * Result: { created, updated, mapped, suggested, errors, total, rows[] }
 */

// ── SKU prefix map ────────────────────────────────────────────────────────────
const SKU_PREFIX: Record<string, string> = {
    PROTEIN_PORK: 'PP', PROTEIN_MEAT: 'PM', SEAFOOD: 'SF', EGG: 'EG',
    DAIRY: 'DY', VEGHERB: 'VH', MUSHROOM: 'MS', DRY_GOODS: 'DG', FROZEN: 'FZ',
    BOX_BAG: 'BB', TISSUE_CLEAN: 'TC', DISPOSABLE: 'DP',
    BEER: 'B', BEER_DRAFT: 'BD', WINE: 'W', SOJU: 'SJ',
    WATER: 'WI', SOFT_DRINK: 'SD', COFFEE: 'CF', TEA: 'TE', SMOOTHIE: 'SM',
    FOOD_GRILL: 'FG', FOOD_FRY: 'FF', FOOD_BOIL: 'FB', FOOD_SALAD: 'FL',
    FOOD_STIR: 'FS', FOOD_SNACK: 'FN', FOOD_SEA: 'FS', FOOD_RICE: 'FR',
    SET: 'ST', KARAOKE: 'KR', ENTERTAIN: 'EN', OTHER: 'OT',
}

// Categories whose products warrant an auto-created empty Recipe shell
const FOOD_CATEGORIES = new Set([
    'FOOD_GRILL', 'FOOD_FRY', 'FOOD_BOIL', 'FOOD_SALAD',
    'FOOD_STIR', 'FOOD_SNACK', 'FOOD_SEA', 'FOOD_RICE', 'SET',
])
// Categories where productType = RAW_MATERIAL
const RAW_CATS = new Set(['PROTEIN_PORK', 'PROTEIN_MEAT', 'SEAFOOD', 'EGG', 'DAIRY', 'VEGHERB', 'MUSHROOM', 'DRY_GOODS', 'FROZEN'])
const SUPPLY_CATS = new Set(['BOX_BAG', 'TISSUE_CLEAN', 'DISPOSABLE'])

function productTypeFor(code: string): 'SALE_ITEM' | 'RAW_MATERIAL' | 'PACKAGING' {
    if (RAW_CATS.has(code)) return 'RAW_MATERIAL'
    if (SUPPLY_CATS.has(code)) return 'PACKAGING'
    return 'SALE_ITEM'
}

/** Read a cell by multiple possible column name variants */
function col(row: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
        const found = Object.keys(row).find(r => r.trim().toLowerCase() === k.toLowerCase())
        if (found !== undefined && row[found] !== '') return String(row[found]).trim()
    }
    return ''
}

function toFloat(raw: string): number {
    return parseFloat(raw.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0
}

/** Generate next available SKU for a prefix */
function nextSku(prefix: string, existingSkus: Set<string>): string {
    const prefixSkus = [...existingSkus].filter(s => {
        const rest = s.slice(prefix.length)
        return s.startsWith(prefix) && /^\d+$/.test(rest)
    })
    let num = prefixSkus.length > 0
        ? Math.max(...prefixSkus.map(s => parseInt(s.slice(prefix.length)) || 0)) + 1
        : 1
    let sku = `${prefix}${String(num).padStart(2, '0')}`
    while (existingSkus.has(sku)) { num++; sku = `${prefix}${String(num).padStart(2, '0')}` }
    return sku
}

// ── Import sku_master ─────────────────────────────────────────────────────────
async function importSkuMaster(
    tenantId: string,
    userId: string,
    rows: Record<string, unknown>[],
    fileName: string,
) {
    // Load current state
    const dbCats = await prisma.category.findMany({ where: { tenantId } })
    const catByCode = new Map(dbCats.map(c => [c.code.toLowerCase(), c]))
    const catByName = new Map(dbCats.map(c => [c.name.toLowerCase(), c]))

    const dbProducts = await prisma.product.findMany({
        where: { tenantId },
        include: { category: true, aliases: true },
    })
    const existingSkus = new Set(dbProducts.map(p => p.sku))

    // Build candidates for matcher
    const candidates: MatchCandidate[] = dbProducts.map(p => ({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        categoryCode: p.category?.code ?? 'OTHER',
        aliases: p.aliases.map(a => a.alias),
    }))

    type RowResult = {
        row: number; status: string; name: string;
        sku?: string; category?: string; score?: number;
        verdict?: string; reason?: string; recipeCreated?: boolean
    }
    const results: RowResult[] = []
    let created = 0, updated = 0, mapped = 0, suggested = 0, errors = 0

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2

        const name = col(row, 'name', 'ชื่อสินค้า', 'ชื่อเมนู', 'menu_name')
        const skuCode = col(row, 'sku', 'sku_code', 'รหัสสินค้า')
        const catRaw = col(row, 'category_code', 'หมวดหมู่', 'category', 'cat')
        const unit = (col(row, 'unit', 'หน่วย') || '') || guessUnit(name, 'กก.')
        const unitAlt = col(row, 'unit_alt', 'หน่วยรอง')
        const convFactor = toFloat(col(row, 'conv_factor', 'อัตราแปลง'))
        const costPrice = toFloat(col(row, 'cost_price', 'ต้นทุน', 'ต้นทุน (₭)'))
        const salePrice = toFloat(col(row, 'sale_price', 'ราคาขาย', 'ราคาขาย (₭)'))
        const initialQty = toFloat(col(row, 'stock_qty', 'สต็อคเริ่มต้น', 'initial_qty'))
        const note = col(row, 'note', 'หมายเหตุ')

        if (!name) {
            results.push({ row: rowNum, status: 'skipped', name: '-', reason: 'ไม่มีชื่อ' })
            continue
        }

        // ── PRE-FILTER: ตัดเครื่องดื่ม / บริการ / non-stock ──────────────────
        const rawCat = col(row, 'category_code', 'หมวดหมู่', 'category', 'cat')
        if (shouldExcludeFromStock(name, rawCat)) {
            results.push({ row: rowNum, status: 'excluded', name, reason: 'เครื่องดื่ม/บริการ — ข้าม' })
            continue
        }

        // Resolve category
        const catVal = catRaw.toLowerCase()
        const category = catByCode.get(catVal) ?? catByName.get(catVal) ?? null
        const catCode = category?.code ?? 'OTHER'

        // ── Step 1: sku_code present → UPSERT ────────────────────────────────
        if (skuCode) {
            try {
                const pType = productTypeFor(catCode)
                const catId = category?.id ?? catByCode.get('other')?.id ?? dbCats[0].id
                const data = {
                    name, unit, ...(unitAlt ? { unitAlt } : {}),
                    ...(convFactor ? { convFactor } : {}),
                    costPrice, salePrice, note: note || undefined,
                    categoryId: catId, productType: pType,
                }
                const upserted = await prisma.product.upsert({
                    where: { tenantId_sku: { tenantId, sku: skuCode } },
                    update: data,
                    create: { ...data, tenantId, sku: skuCode },
                })
                existingSkus.add(skuCode)

                // Stock OPENING if new and initialQty > 0
                if (initialQty > 0 && pType === 'RAW_MATERIAL') {
                    const loc = await prisma.location.findFirst({ where: { tenantId, code: 'WH_MAIN' } })
                    if (loc) {
                        await prisma.inventory.upsert({
                            where: { tenantId_productId_locationId: { tenantId, productId: upserted.id, locationId: loc.id } },
                            update: {},
                            create: { tenantId, productId: upserted.id, locationId: loc.id, quantity: 0, avgCost: costPrice },
                        })
                        await prisma.stockMovement.create({
                            data: {
                                tenantId, productId: upserted.id,
                                toLocationId: loc.id,
                                quantity: initialQty, unitCost: costPrice,
                                totalCost: initialQty * costPrice,
                                type: 'OPENING',
                                note: `[Import] ${fileName}`,
                                createdById: userId || undefined,
                            },
                        })
                        await prisma.inventory.update({
                            where: { tenantId_productId_locationId: { tenantId, productId: upserted.id, locationId: loc.id } },
                            data: { quantity: { increment: initialQty }, avgCost: costPrice },
                        })
                    }
                }

                // Auto-create empty recipe for food menu items
                let recipeCreated = false
                if (FOOD_CATEGORIES.has(catCode)) {
                    const existing = await prisma.recipe.findFirst({ where: { tenantId, menuName: name } })
                    if (!existing) {
                        await prisma.recipe.create({ data: { tenantId, menuName: name, note: '[Auto] รอเพิ่มส่วนผสม' } })
                        recipeCreated = true
                    }
                }

                const isNew = !dbProducts.find(p => p.sku === skuCode)
                if (isNew) { created++; results.push({ row: rowNum, status: 'created', name, sku: skuCode, category: catCode, recipeCreated }) }
                else { updated++; results.push({ row: rowNum, status: 'updated', name, sku: skuCode, category: catCode }) }
            } catch (e: unknown) {
                errors++
                results.push({ row: rowNum, status: 'error', name, reason: e instanceof Error ? e.message : 'error' })
            }
            continue
        }

        // ── Step 2: No sku_code → findBestMatch ────────────────────────────
        const best = findBestMatch(name, unit, catCode, candidates)

        if (best?.verdict === 'AUTO') {
            // Auto-map: create alias + update product
            try {
                await prisma.productAlias.upsert({
                    where: { tenantId_alias: { tenantId, alias: normalizeName(name) } },
                    update: {},
                    create: { tenantId, productId: best.productId, alias: normalizeName(name), source: 'import' },
                })
                mapped++
                results.push({ row: rowNum, status: 'mapped', name, sku: best.sku, score: best.score, verdict: 'AUTO' })
            } catch (e: unknown) {
                errors++
                results.push({ row: rowNum, status: 'error', name, reason: e instanceof Error ? e.message : 'error' })
            }
            continue
        }

        // ── Step 3: REVIEW or SUGGEST_NEW → SkuSuggestion ──────────────────
        const prefix = SKU_PREFIX[catCode] ?? 'OT'
        const proposedSku = nextSku(prefix, existingSkus)

        try {
            await prisma.skuSuggestion.create({
                data: {
                    tenantId,
                    importSource: fileName,
                    rawName: name,
                    rawUnit: unit || null,
                    rawCategory: catCode || null,
                    rawCostPrice: costPrice || null,
                    rawSalePrice: salePrice || null,
                    suggestedSku: proposedSku,
                    matchedProductId: best?.verdict === 'REVIEW' ? best.productId : null,
                    matchScore: best?.score ?? null,
                    status: 'PENDING',
                },
            })
            suggested++
            results.push({
                row: rowNum, status: 'suggested', name,
                sku: proposedSku, score: best?.score,
                verdict: best?.verdict ?? 'SUGGEST_NEW',
            })
        } catch (e: unknown) {
            errors++
            results.push({ row: rowNum, status: 'error', name, reason: e instanceof Error ? e.message : 'error' })
        }
    }

    // Audit log
    await prisma.auditLog.create({
        data: {
            actorType: 'TENANT_USER',
            userId,
            tenantId,
            action: 'SKU_IMPORT',
            payload: { fileName, total: rows.length, created, updated, mapped, suggested, errors } as any,
        },
    }).catch(() => {/* non-critical */ })

    return { created, updated, mapped, suggested, errors, total: rows.length, results }
}

// ── Import sku_aliases ────────────────────────────────────────────────────────
async function importSkuAliases(
    tenantId: string,
    rows: Record<string, unknown>[],
) {
    let created = 0, skipped = 0, errors = 0
    const results: { row: number; status: string; alias: string; sku?: string; reason?: string }[] = []

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2
        const sku = col(row, 'sku', 'รหัสสินค้า')
        const alias = col(row, 'alias', 'ชื่อเรียกอื่น')
        const source = col(row, 'source') || 'import'

        if (!sku || !alias) {
            results.push({ row: rowNum, status: 'skipped', alias: alias || '-', reason: 'ขาด sku หรือ alias' })
            skipped++
            continue
        }

        const product = await prisma.product.findUnique({ where: { tenantId_sku: { tenantId, sku } } })
        if (!product) {
            results.push({ row: rowNum, status: 'error', alias, sku, reason: `ไม่พบ SKU ${sku}` })
            errors++
            continue
        }

        try {
            await prisma.productAlias.upsert({
                where: { tenantId_alias: { tenantId, alias: normalizeName(alias) } },
                update: { productId: product.id, source },
                create: { tenantId, productId: product.id, alias: normalizeName(alias), source },
            })
            results.push({ row: rowNum, status: 'created', alias, sku })
            created++
        } catch (e: unknown) {
            results.push({ row: rowNum, status: 'error', alias, sku, reason: e instanceof Error ? e.message : 'error' })
            errors++
        }
    }
    return { created, skipped, errors, total: rows.length, results }
}

// ── Import categories ─────────────────────────────────────────────────────────
async function importCategories(
    tenantId: string,
    rows: Record<string, unknown>[],
) {
    let created = 0, updated = 0, errors = 0

    for (const row of rows) {
        const code = col(row, 'code')
        const name = col(row, 'name', 'ชื่อ')
        const nameEn = col(row, 'nameEn', 'nameEn', 'name_en')
        const color = col(row, 'color', 'สี')
        const icon = col(row, 'icon', 'ไอคอน')
        if (!code || !name) { errors++; continue }

        const data = { name, ...(nameEn ? { nameEn } : {}), ...(color ? { color } : {}), ...(icon ? { icon } : {}) }
        try {
            const existing = await prisma.category.findUnique({ where: { tenantId_code: { tenantId, code } } })
            if (existing) {
                await prisma.category.update({ where: { id: existing.id }, data })
                updated++
            } else {
                await prisma.category.create({ data: { tenantId, code, ...data } })
                created++
            }
        } catch { errors++ }
    }
    return { created, updated, errors }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export const POST = withAuth<any>(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId, userId } = ctx
        const url = new URL(req.url)
        const type = url.searchParams.get('type') ?? 'sku_master'

        const formData = await req.formData()
        const file = formData.get('file') as File | null
        if (!file) return NextResponse.json({ success: false, error: 'ไม่พบไฟล์' }, { status: 400 })

        const buf = Buffer.from(await file.arrayBuffer())
        const wb = XLSX.read(buf, { type: 'buffer' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (rows.length === 0) return NextResponse.json({ success: false, error: 'ไฟล์ไม่มีข้อมูล' }, { status: 400 })

        let result: Record<string, unknown>

        if (type === 'sku_master') {
            result = await importSkuMaster(tenantId, userId, rows, file.name)
        } else if (type === 'sku_aliases') {
            result = await importSkuAliases(tenantId, rows)
        } else if (type === 'categories') {
            result = await importCategories(tenantId, rows)
        } else {
            return NextResponse.json({ success: false, error: `type "${type}" ไม่รองรับ` }, { status: 400 })
        }

        return NextResponse.json({ success: true, type, data: result })
    } catch (e: unknown) {
        console.error('[master/import]', e)
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
    }
}, ['OWNER', 'MANAGER'])
