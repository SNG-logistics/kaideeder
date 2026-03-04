import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'
import * as XLSX from 'xlsx'

// Category name → code mapping (mirrors import-stock-pack.ts)
const CAT_NAME_MAP: Record<string, string> = {
    'เบียร์': 'BEER', 'beer': 'BEER',
    'ไวน์': 'WINE', 'wine': 'WINE', 'วิสกี้': 'WINE', 'whisky': 'WINE',
    'ค็อกเทล': 'COCKTAIL', 'cocktail': 'COCKTAIL',
    'เครื่องดื่ม': 'DRINK', 'drink': 'DRINK',
    'น้ำดื่ม': 'WATER', 'น้ำแข็ง': 'WATER',
    'ปิ้งย่าง': 'FOOD_GRILL', 'ย่าง': 'FOOD_GRILL', 'กริล': 'FOOD_GRILL',
    'ทอด': 'FOOD_FRY', 'fry': 'FOOD_FRY',
    'ทะเล': 'FOOD_SEA', 'seafood': 'FOOD_SEA',
    'ผัก': 'FOOD_VEG', 'veg': 'FOOD_VEG',
    'ลาบ': 'FOOD_LAAB', 'ยำ': 'FOOD_LAAB',
    'ข้าว': 'FOOD_RICE', 'rice': 'FOOD_RICE',
    'ก๋วยเตี๋ยว': 'FOOD_NOODLE', 'เส้น': 'FOOD_NOODLE',
    'เนื้อ': 'RAW_MEAT', 'ไก่': 'RAW_MEAT', 'หมู': 'RAW_PORK',
    'กุ้ง': 'RAW_SEA', 'ปลา': 'RAW_SEA', 'หมึก': 'RAW_SEA',
    'วัตถุดิบ': 'RAW_VEG', 'raw': 'RAW_VEG',
    'เครื่องปรุง': 'DRY_GOODS', 'dry': 'DRY_GOODS',
    'บรรจุภัณฑ์': 'PACKAGING',
    'โปร': 'SET', 'เซ็ต': 'SET',
    'คาราโอเกะ': 'KARAOKE',
    'entertain': 'ENTERTAIN', 'pr': 'ENTERTAIN',
    'อื่น': 'OTHER',
}

function guessCategory(name: string, group: string): string {
    const text = (group + ' ' + name).toLowerCase()
    for (const [key, code] of Object.entries(CAT_NAME_MAP)) {
        if (text.includes(key.toLowerCase())) return code
    }
    return 'OTHER'
}

// POST /api/system/import-products — owner only
// Form fields: file (xlsx/xls), mode = 'clear_reimport' | 'upsert'
export const POST = withAuth<any>(async (req: NextRequest) => {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const mode = (formData.get('mode') as string) || 'upsert'

        if (!file) {
            return NextResponse.json({ success: false, error: 'ไม่พบไฟล์ Excel' }, { status: 400 })
        }

        // Read Excel buffer
        const buf = Buffer.from(await file.arrayBuffer())
        const wb = XLSX.read(buf, { type: 'buffer' })

        // Load categories from DB
        const cats = await prisma.category.findMany()
        const catMap = Object.fromEntries(cats.map(c => [c.code, c]))

        // ── CLEAR mode: delete all products + dependencies ──────────────
        let cleared = 0
        if (mode === 'clear_reimport') {
            const [bom, inv, pi, po, ti, st, ai, adj, prod] = await prisma.$transaction([
                prisma.recipeBOM.deleteMany({}),
                prisma.inventory.deleteMany({}),
                prisma.purchaseItem.deleteMany({}),
                prisma.purchaseOrder.deleteMany({}),
                prisma.transferItem.deleteMany({}),
                prisma.stockTransfer.deleteMany({}),
                prisma.adjustmentItem.deleteMany({}),
                prisma.stockAdjustment.deleteMany({}),
                prisma.product.deleteMany({}),
            ])
            cleared = prod.count
        }

        // ── IMPORT from Excel ───────────────────────────────────────────
        const productSheets = wb.SheetNames.filter(
            n => !n.startsWith('Template_') && n !== 'Instructions'
        )

        let created = 0, updated = 0, skipped = 0
        const errors: string[] = []

        for (const sheetName of productSheets) {
            const ws = wb.Sheets[sheetName]
            const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })

            // Find header row
            let headerRow = -1
            let colSku = -1, colName = -1, colUnit = -1
            let colSalePrice = -1, colCostPrice = -1, colCategory = -1
            let colQty = -1, colLocation = -1, colMinQty = -1

            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                const row = rows[i].map(c => String(c).toLowerCase().trim())
                if (row.some(c => c.includes('ชื่อ') || c.includes('name'))) {
                    headerRow = i
                    row.forEach((c, j) => {
                        if (c.includes('รหัส') || c.includes('sku') || c.includes('code')) colSku = j
                        if ((c.includes('ชื่อ') || c.includes('name')) && colName === -1) colName = j
                        if (c.includes('หน่วย') || c.includes('unit')) colUnit = j
                        if (c.includes('ราคาขาย') || c.includes('sale')) colSalePrice = j
                        if (c.includes('ต้นทุน') || c.includes('cost')) colCostPrice = j
                        if (c.includes('หมวด') || c.includes('กลุ่ม') || c.includes('categ')) colCategory = j
                        if (c.includes('จำนวน') || c.includes('qty') || c.includes('stock')) colQty = j
                        if (c.includes('คลัง') || c.includes('location')) colLocation = j
                        if (c.includes('ขั้นต่ำ') || c.includes('min') || c.includes('reorder')) colMinQty = j
                    })
                    break
                }
            }

            if (headerRow === -1 || colName === -1) continue

            for (let i = headerRow + 1; i < rows.length; i++) {
                const row = rows[i]
                const name = String(row[colName] || '').trim()
                if (!name || name === 'รวม' || name === 'Total') continue

                const sku = colSku >= 0 ? String(row[colSku] || '').trim() : ''
                const unit = colUnit >= 0 ? String(row[colUnit] || 'ชิ้น').trim() : 'ชิ้น'
                const salePrice = colSalePrice >= 0 ? parseFloat(String(row[colSalePrice] || '0').replace(/,/g, '')) || 0 : 0
                const costPrice = colCostPrice >= 0 ? parseFloat(String(row[colCostPrice] || '0').replace(/,/g, '')) || 0 : 0
                const category = colCategory >= 0 ? String(row[colCategory] || '').trim() : ''
                const qty = colQty >= 0 ? parseFloat(String(row[colQty] || '0').replace(/,/g, '')) || 0 : 0
                const locationCode = colLocation >= 0 ? String(row[colLocation] || 'WH_MAIN').trim() : 'WH_MAIN'
                const minQty = colMinQty >= 0 ? parseFloat(String(row[colMinQty] || '0').replace(/,/g, '')) || 0 : 0

                const catCode = guessCategory(name, category)
                const catRecord = catMap[catCode] || catMap['OTHER']
                if (!catRecord) { skipped++; continue }

                const finalSku = sku || `AUTO-${sheetName.substring(0, 3).toUpperCase()}-${i}`
                const productType = (category + name).toLowerCase().includes('raw') ||
                    (category + name).toLowerCase().includes('วัตถุดิบ') ? 'RAW_MATERIAL' : 'SALE_ITEM'

                try {
                    const existing = await prisma.product.findFirst({ where: { sku: finalSku } })
                    if (existing) {
                        await prisma.product.update({
                            where: { id: existing.id },
                            data: { name, unit, salePrice, costPrice: costPrice || undefined, categoryId: catRecord.id, minQty, reorderPoint: minQty * 2 }
                        })
                        updated++
                    } else {
                        const product = await prisma.product.create({
                            data: { sku: finalSku, name, unit, salePrice, costPrice, categoryId: catRecord.id, productType: productType as any, minQty, reorderPoint: minQty * 2 || 5 }
                        })
                        // Opening stock
                        if (qty > 0) {
                            const loc = await prisma.location.findFirst({ where: { code: locationCode } })
                                || await prisma.location.findFirst({ where: { code: 'WH_MAIN' } })
                            if (loc) {
                                await prisma.inventory.upsert({
                                    where: { productId_locationId: { productId: product.id, locationId: loc.id } },
                                    update: { quantity: qty, avgCost: costPrice },
                                    create: { productId: product.id, locationId: loc.id, quantity: qty, avgCost: costPrice }
                                })
                            }
                        }
                        created++
                    }
                } catch (e: any) {
                    errors.push(`${name}: ${e.message}`)
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: { cleared, created, updated, skipped, errors: errors.slice(0, 20), sheets: productSheets }
        })
    } catch (e: any) {
        console.error('[import-products]', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}, ['OWNER'])
