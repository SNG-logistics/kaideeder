/**
 * import-stock-pack.ts
 * อ่านไฟล์ 43garden_stock_pack.xlsx แล้วนำเข้า Products + Opening Stock เข้า DB
 * รัน: npx tsx scripts/import-stock-pack.ts
 */
import { PrismaClient, ProductType } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
    const filePath = path.resolve(__dirname, '../../43garden_stock_pack.xlsx')
    console.log('📂 อ่านไฟล์:', filePath)

    const wb = XLSX.readFile(filePath)
    console.log('📋 Sheets:', wb.SheetNames)

    // หา sheet ที่มีข้อมูลสินค้า (ไม่ใช่ Template)
    const productSheets = wb.SheetNames.filter(n =>
        !n.startsWith('Template_') && n !== 'Instructions'
    )

    console.log('🔍 Sheet ที่มีข้อมูล:', productSheets)

    // โหลด tenant แรกที่ active — script รัน standalone ไม่มี session
    const tenant = await prisma.tenant.findFirst({ where: { status: 'ACTIVE' } })
    if (!tenant) { console.error('❌ ไม่พบ Tenant'); process.exit(1) }
    const tenantId = tenant.id
    console.log(`🏢 Tenant: ${tenant.code} (${tenantId})`)

    // โหลด categories จาก DB
    const cats = await prisma.category.findMany({ where: { tenantId } })
    const catMap = Object.fromEntries(cats.map(c => [c.code, c]))

    // Map ชื่อหมวดหมู่จาก Excel → category code
    const catNameMap: Record<string, string> = {
        'เบียร์': 'BEER', 'beer': 'BEER',
        'ไวน์': 'WINE', 'wine': 'WINE', 'วิสกี้': 'WINE', 'whisky': 'WINE',
        'ค็อกเทล': 'COCKTAIL', 'cocktail': 'COCKTAIL',
        'เครื่องดื่ม': 'DRINK', 'drink': 'DRINK',
        'น้ำดื่ม': 'WATER', 'น้ำแข็ง': 'WATER',
        'ปิ้งย่าง': 'FOOD_GRILL', 'ย่าง': 'FOOD_GRILL',
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
        for (const [key, code] of Object.entries(catNameMap)) {
            if (text.includes(key.toLowerCase())) return code
        }
        return 'OTHER'
    }

    function guessProductType(name: string, group: string): ProductType {
        const text = (group + ' ' + name).toLowerCase()
        if (text.includes('วัตถุดิบ') || text.includes('raw') ||
            text.includes('กก.') || text.includes('กิโล')) {
            return ProductType.RAW_MATERIAL
        }
        return ProductType.SALE_ITEM
    }

    let totalImported = 0

    for (const sheetName of productSheets) {
        const ws = wb.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })

        console.log(`\n=== Sheet: ${sheetName} (${rows.length} rows) ===`)

        // หา header row — หา row ที่มี "ชื่อ" หรือ "sku" หรือ "รหัส"
        let headerRow = -1
        let colSku = -1, colName = -1, colUnit = -1
        let colSalePrice = -1, colCostPrice = -1, colCategory = -1
        let colQty = -1, colLocation = -1, colMinQty = -1

        for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const row = rows[i].map(c => String(c).toLowerCase().trim())
            const hasName = row.some(c => c.includes('ชื่อ') || c.includes('name'))
            if (hasName) {
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

        if (headerRow === -1 || colName === -1) {
            console.log('  ⚠️ ไม่พบ header row ที่มีชื่อสินค้า — ข้ามไป')
            continue
        }

        console.log(`  📌 Header row: ${headerRow}, Name col: ${colName}, SKU col: ${colSku}`)

        // Process data rows
        for (let i = headerRow + 1; i < rows.length; i++) {
            const row = rows[i]
            const name = String(row[colName] || '').trim()
            if (!name || name === '' || name === 'รวม' || name === 'Total') continue

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
            const productType = guessProductType(name, category)

            // สร้าง SKU ถ้าไม่มี
            const finalSku = sku || `AUTO-${sheetName.substring(0, 3).toUpperCase()}-${i}`

            try {
                // ใช้ findFirst แทน upsert เพราะ sku ไม่ได้เป็น unique key เดี่ยวอีกต่อไป
                // (multi-tenant schema ใช้ compound key: tenantId_sku)
                const existing = await prisma.product.findFirst({ where: { sku: finalSku } })
                const product = existing
                    ? await prisma.product.update({
                        where: { id: existing.id },
                        data: {
                            name,
                            unit,
                            salePrice,
                            costPrice: costPrice || undefined,
                            categoryId: catRecord.id,
                            productType,
                            minQty,
                            reorderPoint: minQty * 2,
                        },
                    })
                    : await prisma.product.create({
                        data: {
                            tenantId,
                            sku: finalSku,
                            name,
                            unit,
                            salePrice,
                            costPrice,
                            categoryId: catRecord.id,
                            productType,
                            minQty,
                            reorderPoint: minQty * 2 || 5,
                        },
                    })

                // ถ้ามีจำนวน Opening Stock — บันทึก inventory
                if (qty > 0) {
                    const loc = await prisma.location.findFirst({
                        where: { code: locationCode || 'WH_MAIN' }
                    }) || await prisma.location.findFirst({ where: { code: 'WH_MAIN' } })

                    if (loc) {
                        await prisma.inventory.upsert({
                            where: { tenantId_productId_locationId: { tenantId, productId: product.id, locationId: loc.id } },
                            update: { quantity: qty, avgCost: costPrice || 0 },
                            create: { tenantId, productId: product.id, locationId: loc.id, quantity: qty, avgCost: costPrice || 0 }
                        })
                        console.log(`  ✅ [${finalSku}] ${name} | qty: ${qty} @ ${locationCode}`)
                    }
                } else {
                    console.log(`  ✅ [${finalSku}] ${name} (จำนวน: 0 — รอนับ)`)
                }
                totalImported++
            } catch (e) {
                console.error(`  ❌ Error: ${name}`, e)
            }
        }
    }

    console.log(`\n🎉 นำเข้าเสร็จแล้ว! รวม ${totalImported} รายการ`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
