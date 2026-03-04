import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'
import * as XLSX from 'xlsx'

// ─── Category Detection ───────────────────────────────────────────────────────

/** normalize string for comparison */
const norm = (s: string) =>
    (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[()\-_/.,]/g, ' ')

/** Excel category name → category code (exact/partial match) */
const CAT_NAME_MAP: Record<string, string> = {
    'เบียร์': 'BEER', 'beer': 'BEER', 'เบียร์สด': 'BEER_DRAFT', 'draft': 'BEER_DRAFT',
    'ไวน์': 'WINE', 'wine': 'WINE', 'วิสกี้': 'WINE', 'whisky': 'WINE', 'spirits': 'WINE',
    'ค็อกเทล': 'COCKTAIL', 'cocktail': 'COCKTAIL',
    'เครื่องดื่ม': 'DRINK', 'drink': 'DRINK', 'น้ำ': 'DRINK',
    'น้ำดื่ม': 'WATER', 'น้ำแข็ง': 'WATER', 'ice': 'WATER',
    'ปิ้งย่าง': 'FOOD_GRILL', 'ย่าง': 'FOOD_GRILL', 'grill': 'FOOD_GRILL',
    'ทอด': 'FOOD_FRY', 'fry': 'FOOD_FRY',
    'ทะเล': 'FOOD_SEA', 'seafood': 'FOOD_SEA',
    'ผัก': 'FOOD_VEG', 'veg': 'FOOD_VEG',
    'ลาบ': 'FOOD_LAAB', 'ยำ': 'FOOD_LAAB',
    'ข้าว': 'FOOD_RICE', 'rice': 'FOOD_RICE',
    'ก๋วยเตี๋ยว': 'FOOD_NOODLE', 'เส้น': 'FOOD_NOODLE', 'noodle': 'FOOD_NOODLE',
    'เนื้อ': 'RAW_MEAT', 'ไก่': 'RAW_MEAT', 'วัตถุดิบเนื้อ': 'RAW_MEAT',
    'หมู': 'RAW_PORK', 'pork': 'RAW_PORK',
    'กุ้ง': 'RAW_SEA', 'ปลา': 'RAW_SEA', 'หมึก': 'RAW_SEA',
    'วัตถุดิบ': 'RAW_VEG', 'raw': 'RAW_VEG',
    'เครื่องปรุง': 'DRY_GOODS', 'dry': 'DRY_GOODS', 'ของแห้ง': 'DRY_GOODS',
    'บรรจุภัณฑ์': 'PACKAGING', 'packaging': 'PACKAGING',
    'ไข่': 'EGG', 'egg': 'EGG', 'eggs': 'EGG',
    'นม': 'DAIRY', 'dairy': 'DAIRY', 'milk': 'DAIRY', 'cream': 'DAIRY', 'ครีม': 'DAIRY', 'เนย': 'DAIRY', 'butter': 'DAIRY',
    'ชีส': 'CHEESE', 'cheese': 'CHEESE',
    'แป้ง': 'FLOUR_DOUGH', 'flour': 'FLOUR_DOUGH', 'dough': 'FLOUR_DOUGH', 'โดว์': 'FLOUR_DOUGH',
    'โปร': 'SET', 'เซ็ต': 'SET', 'set': 'SET',
    'คาราโอเกะ': 'KARAOKE', 'karaoke': 'KARAOKE',
    'entertain': 'ENTERTAIN', 'entertainment': 'ENTERTAIN',
    'อื่น': 'OTHER', 'other': 'OTHER',
}

/** Priority rules — ported from Python detect_code() script (specific first, catch-all last) */
const CAT_RULES: Array<{ code: string; re: RegExp[] }> = [
    { code: 'BEER', re: [/เบียร์/i, /\bbeer\b/i, /heineken|hoegaarden|singha|chang|leo|budweiser|corona|asahi|sapporo|kirin|tiger|san.?miguel|somersby/i] },
    { code: 'WINE', re: [/ไวน์/i, /\bwine\b/i, /วิสกี้|whisky|whiskey/i, /champagne|sparkling/i, /soju|โซจู/i] },
    { code: 'COCKTAIL', re: [/ค็อกเทล/i, /\bcocktail\b/i, /mojito|margarita|martini|negroni|spritz/i] },
    { code: 'WATER', re: [/น้ำดื่ม/i, /น้ำแข็ง/i, /\bice\b/i, /โซดา/i, /\bsoda\b/i] },
    {
        code: 'DRINK', re: [/เครื่องดื่ม/i, /\bdrink\b/i,
            /กาแฟ|coffee|latte|ลาเต้|americano|เอสเพรสโซ|cappuccino|คาปู/i,
            /ชา\b|tea|ชานม|milk.?tea|matcha|มัทฉะ|โกโก้|cocoa|น้ำผลไม้|juice|สมูทตี้|smoothie|ปั่น/i]
    },

    { code: 'KARAOKE', re: [/คาราโอเกะ/i] },
    { code: 'ENTERTAIN', re: [/\bpr\b/i, /entertain/i, /เอนเตอร์เทน/i] },
    { code: 'SET', re: [/โปร\b/i, /เซ็ต/i, /\bset\b/i, /\bcombo\b/i, /คอมโบ/i] },

    { code: 'PACKAGING', re: [/บรรจุภัณฑ์|กล่อง|ถุง|แก้ว|ฝา|หลอด|จาน|ช้อน|ส้อม|ทิชชู่|กระดาษ|แพ็ค|แพค|ฟิล์ม|wrap|ฟอยล์|foil/i] },

    // ไข่/นม/ชีส/แป้ง — ต้องอยู่ก่อน DRY_GOODS เพื่อไม่ให้ เนย/ครีม/แป้ง ตกไป DRY_GOODS
    { code: 'EGG', re: [/ไข่ไก่|ไข่เป็ด|ไข่เค็ม|ไข่เยี่ยวม้า|ไข่นกกระทา|\begg\b/i] },
    { code: 'DAIRY', re: [/นม[สวดอ่อเผือกข]|ครีม|โยเกิร์ต|เนยสด|\bbutter\b|\bcream\b|\bmilk\b|\byogurt\b/i] },
    { code: 'CHEESE', re: [/ชีส|\bcheese\b|cheddar|mozzarella|parmesan|brie|gouda/i] },
    { code: 'FLOUR_DOUGH', re: [/แป้งสาลี|แป้งหมู|โดว์|\bflour\b|\bdough\b|pizza.?base|แป้งพิซซ่า|แป้งขนมปัง/i] },

    { code: 'DRY_GOODS', re: [/เครื่องปรุง|ซอส|น้ำปลา|ซีอิ๊ว|ซีอิ้ว|เกลือ|น้ำตาล|พริกไทย|ผง|น้ำจิ้ม|น้ำพริก|กะปิ|น้ำมัน|vinegar|น้ำส้ม|ซอสหอย|หอยนางรม/i] },

    { code: 'RAW_SEA', re: [/กุ้ง|ปลา|หมึก|ปู|หอย|แซลมอน|ปลาหมึก|ปลากะพง|ปลาทู|ปลานิล|ปลาดอรี่|กั้ง|หอยนางรม|หอยแมลงภู่|หอยเชลล์|ปลาสลิด/i] },
    { code: 'RAW_PORK', re: [/หมู|เบคอน|แฮม|ไส้กรอกหมู|ซี่โครงหมู|สันคอ|สามชั้น|หมูบด|หมูสับ/i] },
    { code: 'RAW_MEAT', re: [/เนื้อ|ไก่|เป็ด|วัว|โค|กบ|กระดูก|ลูกชิ้นเนื้อ|น่องไก่|อกไก่|ปีกไก่|เครื่องใน|ตับ|กึ๋น|ไส้/i] },
    { code: 'RAW_VEG', re: [/ผัก|เห็ด|กระเทียม|หัวหอม|หอมแดง|ขิง|ข่า|ตะไคร้|มะนาว|มะเขือ|พริก|กะหล่ำ|คะน้า|ผักกาด|แครอท|แตงกวา|ถั่ว|ใบโหระพา|กะเพรา|ผักชี|ต้นหอม|ขึ้นฉ่าย|หอมใหญ่|มะเขือเทศ|มะพร้าว|กะทิ/i] },

    { code: 'FOOD_GRILL', re: [/ปิ้งย่าง|ย่าง|grill|bbq|บาร์บีคิว/i] },
    { code: 'FOOD_FRY', re: [/ทอด|fry|กรอบ/i] },
    { code: 'FOOD_SEA', re: [/ทะเล|seafood/i] },
    { code: 'FOOD_VEG', re: [/\bveg\b|เจ\b|ผักรวม/i] },
    { code: 'FOOD_LAAB', re: [/ลาบ|ยำ/i] },
    { code: 'FOOD_RICE', re: [/ข้าว|rice/i] },
    { code: 'FOOD_NOODLE', re: [/ก๋วยเตี๋ยว|เส้น|noodle|บะหมี่|วุ้นเส้น|มาม่า/i] },

    { code: 'OTHER', re: [/.*/] },  // catch-all
]

function detectCategoryCode(excelCatName: string | undefined, productName: string): string {
    // 1. Try exact match from Excel category cell
    const c = norm(excelCatName || '')
    if (c) {
        const code = CAT_NAME_MAP[c] ?? CAT_NAME_MAP[c.replace(/\s+/g, '')]
        if (code) return code
        // partial match: check if any CAT_NAME_MAP key appears in category text
        for (const [key, code2] of Object.entries(CAT_NAME_MAP)) {
            if (c.includes(key.toLowerCase())) return code2
        }
    }
    // 2. Regex rules on product name
    const n = norm(productName)
    for (const rule of CAT_RULES) {
        if (rule.re.some(re => re.test(n))) return rule.code
    }
    return 'OTHER'
}

// ─── SKU Prefix Map ──────────────────────────────────────────────────────────
const SKU_PREFIX: Record<string, string> = {
    BEER: 'BE', BEER_DRAFT: 'BD',
    WINE: 'WN', COCKTAIL: 'CK',
    DRINK: 'DR', WATER: 'WT',
    FOOD_GRILL: 'FG', FOOD_FRY: 'FF', FOOD_SEA: 'FS',
    FOOD_VEG: 'FV', FOOD_LAAB: 'LA', FOOD_RICE: 'FR', FOOD_NOODLE: 'FN',
    RAW_MEAT: 'RM', RAW_PORK: 'RP', RAW_SEA: 'RS', RAW_VEG: 'RV',
    EGG: 'EG', DAIRY: 'DA', CHEESE: 'CH', FLOUR_DOUGH: 'FD',
    DRY_GOODS: 'DG', PACKAGING: 'PK',
    KARAOKE: 'KR', ENTERTAIN: 'EN', SET: 'ST', OTHER: 'OT',
}

/** Build per-prefix counter from existing SKUs in DB */
async function buildSkuCounters(): Promise<Record<string, number>> {
    const products = await prisma.product.findMany({ select: { sku: true } })
    const counters: Record<string, number> = {}
    for (const { sku } of products) {
        const match = sku.match(/^([A-Z]{2})(\d+)$/)
        if (match) {
            const prefix = match[1]
            const num = parseInt(match[2])
            counters[prefix] = Math.max(counters[prefix] ?? 0, num)
        }
    }
    return counters
}

function nextSku(prefix: string, counters: Record<string, number>): string {
    counters[prefix] = (counters[prefix] ?? 0) + 1
    return `${prefix}${String(counters[prefix]).padStart(3, '0')}`
}

// ─── API Handler ─────────────────────────────────────────────────────────────
// POST /api/system/import-products — OWNER only
// Form: file (xlsx/xls), mode = 'upsert' | 'clear_reimport'
export const POST = withAuth<any>(async (req: NextRequest) => {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const mode = (formData.get('mode') as string) || 'upsert'

        if (!file) return NextResponse.json({ success: false, error: 'ไม่พบไฟล์ Excel' }, { status: 400 })

        const buf = Buffer.from(await file.arrayBuffer())
        const wb = XLSX.read(buf, { type: 'buffer' })

        // Load categories from DB
        const cats = await prisma.category.findMany()
        const catMap = Object.fromEntries(cats.map(c => [c.code, c]))

        // ── CLEAR mode ────────────────────────────────────────────────
        let cleared = 0
        if (mode === 'clear_reimport') {
            await prisma.$transaction([
                prisma.recipeBOM.deleteMany({}),
                prisma.inventory.deleteMany({}),
                prisma.purchaseItem.deleteMany({}),
                prisma.purchaseOrder.deleteMany({}),
                prisma.transferItem.deleteMany({}),
                prisma.stockTransfer.deleteMany({}),
                prisma.adjustmentItem.deleteMany({}),
                prisma.stockAdjustment.deleteMany({}),
            ])
            const del = await prisma.product.deleteMany({})
            cleared = del.count
        }

        // ── Build SKU counters from current DB ────────────────────────
        const skuCounters = await buildSkuCounters()
        const unknownNames: string[] = []

        // ── Import from Excel ────────────────────────────────────────
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
                        if ((c.includes('จำนวน') || c.includes('qty') || c.includes('stock')) && !c.includes('ขั้นต่ำ')) colQty = j
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
                if (!name || name === 'รวม' || name === 'Total' || name === '-') continue

                const excelSku = colSku >= 0 ? String(row[colSku] || '').trim() : ''
                const unit = colUnit >= 0 ? String(row[colUnit] || 'ชิ้น').trim() : 'ชิ้น'
                const salePrice = colSalePrice >= 0 ? parseFloat(String(row[colSalePrice] || '0').replace(/,/g, '')) || 0 : 0
                const costPrice = colCostPrice >= 0 ? parseFloat(String(row[colCostPrice] || '0').replace(/,/g, '')) || 0 : 0
                const excelCat = colCategory >= 0 ? String(row[colCategory] || '').trim() : ''
                const qty = colQty >= 0 ? parseFloat(String(row[colQty] || '0').replace(/,/g, '')) || 0 : 0
                const locationCode = colLocation >= 0 ? String(row[colLocation] || 'WH_MAIN').trim() : 'WH_MAIN'
                const minQty = colMinQty >= 0 ? parseFloat(String(row[colMinQty] || '0').replace(/,/g, '')) || 0 : 0

                // ── Category detection ────────────────────────────
                const catCode = detectCategoryCode(excelCat, name)
                if (catCode === 'OTHER') unknownNames.push(name)
                const catRecord = catMap[catCode] || catMap['OTHER']
                if (!catRecord) { skipped++; continue }

                // ── SKU: use Excel SKU if provided, else auto-generate ──
                const prefix = SKU_PREFIX[catCode] ?? 'OT'
                const finalSku = excelSku || nextSku(prefix, skuCounters)

                // ── productType ────────────────────────────────────
                const isRaw = catCode.startsWith('RAW_') || catCode === 'DRY_GOODS' || catCode === 'PACKAGING'
                const productType = isRaw ? 'RAW_MATERIAL' : 'SALE_ITEM'

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
                                ?? await prisma.location.findFirst({ where: { code: 'WH_MAIN' } })
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
                    errors.push(`[${finalSku}] ${name}: ${e.message}`)
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                cleared, created, updated, skipped,
                errors: errors.slice(0, 20),
                sheets: productSheets,
                unknownCategories: unknownNames.slice(0, 20),
            }
        })
    } catch (e: any) {
        console.error('[import-products]', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}, ['OWNER'])
