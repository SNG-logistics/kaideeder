import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'
import * as XLSX from 'xlsx'

// ────────────────────────────────────────────────────────────
// POST /api/products/import-raw
// นำเข้าวัตถุดิบ / บรรจุภัณฑ์ จากไฟล์ Excel
// - productType default: RAW_MATERIAL (ไม่สร้าง inventory — stock คง 0)
// - auto-detect หมวดหมู่จากชื่อ keyword
// ────────────────────────────────────────────────────────────

const KEYWORD_MAP: { keywords: string[]; code: string }[] = [
    // เนื้อสัตว์ / โปรตีน
    {
        keywords: [
            'เนื้อวัว', 'เนื้อโค', 'สันใน', 'สันนอก', 'เนื้อสับ', 'beef', 'tenderloin', 'ribeye', 'sirloin',
        ], code: 'RAW_MEAT'
    },
    {
        keywords: [
            'หมู', 'สามชั้น', 'คอหมู', 'สันคอ', 'สันหมู', 'ซี่โครง', 'ไส้กรอก', 'pork', 'bacon', 'ham',
            'ไก่', 'อกไก่', 'สะโพกไก่', 'ปีกไก่', 'chicken', 'wing',
            'เนื้อ', 'meat', 'โปรตีน', 'protein',
        ], code: 'RAW_PORK'
    },
    {
        keywords: [
            'กุ้ง', 'ปลา', 'หอย', 'ปู', 'หมึก', 'ทะเล', 'seafood',
            'shrimp', 'fish', 'crab', 'squid', 'oyster',
        ], code: 'RAW_SEA'
    },

    // บรรจุภัณฑ์ (ตรวจก่อน เครื่องดื่ม เพื่อกัน "กระป๋อง" ของบรรจุ)
    {
        keywords: [
            'ถุง', 'กล่อง', 'ฟอยล์', 'ฝาปิด', 'ช้อน', 'ส้อม', 'หลอด',
            'bag', 'box', 'foil', 'lid', 'spoon', 'fork', 'straw', 'container',
            'แพ็ค', 'pack', 'wrap', 'บรรจุ', 'packaging',
            'ถ้วย', 'โฟม', 'cup', 'foam', 'tray',
        ], code: 'PACKAGING'
    },

    // เครื่องดื่ม — ตรวจก่อน RAW_VEG/DRY_GOODS เพื่อกัน fallthrough
    {
        keywords: [
            // เบียร์
            'beer', 'beerlao', 'beelao', 'heineken', 'carlsberg', 'carsberg',
            'budweiser', 'corona', 'somersby', 'hoegarden', 'hoegaarden',
            '1664', 'blanc', 'เบียร์', 'เบีย', 'บีร์',
            // ไวน์
            'wine', 'ไวน์', 'วาย', 'penfolds', 'jacob', 'jacop', 'rawson',
            'hoonuga', 'siegel', 'carmenere', 'chardonnay', 'rosé', 'rose',
            // สุรา / สปิริต
            'whisky', 'whiskey', 'johnnie walker', 'johny', 'johnny', 'hennessy',
            'regency', 'singerton', 'singmalt', 'vodka', 'rum', 'gin', 'brandy',
            'vsop', 'เหล้า', 'วิสกี้', 'บรั่นดี',
            // น้ำอัดลม
            'pepsi', 'soda', 'sprite', 'fanta', 'coke', 'cola', 'โซดา',
            // ชา กาแฟ
            'กาแฟ', 'กาเฟ', 'coffee', 'maple coffee', 'ชา', 'tea',
            // น้ำ / เครื่องดื่มทั่วไป
            'เครื่องดื่ม', 'น้ำดื่ม', 'water', 'drink', 'juice',
            'น้ำผลไม้', 'สมูทตี้', 'smoothie', 'ปั่น',
            // tower
            'ทาวเวอร์', 'tower',
        ], code: 'DRY_GOODS'
    },

    // ผัก / เครื่องปรุง
    {
        keywords: [
            'ผัก', 'หัวหอม', 'กระเทียม', 'พริก', 'มะเขือ', 'ฟักทอง', 'แครอท', 'มะนาว', 'ผักชี',
            'ใบกะเพรา', 'ใบโหระพา', 'ตะไคร้', 'ข่า', 'ขมิ้น', 'ขิง', 'เห็ด',
            'veg', 'vegetable', 'herb', 'spice',
            'แป้ง', 'น้ำตาล', 'เกลือ', 'น้ำมัน', 'ซีอิ๊ว', 'น้ำปลา', 'กะปิ',
            'flour', 'sugar', 'salt', 'oil', 'sauce',
        ], code: 'RAW_VEG'
    },
    {
        keywords: [
            'ข้าว', 'ของแห้ง', 'กระป๋อง', 'มาม่า', 'บะหมี่', 'วุ้นเส้น',
            'dry', 'rice', 'noodle', 'canned', 'dried',
        ], code: 'DRY_GOODS'
    },

    // อื่นๆ (fallback)
    { keywords: ['อื่น', 'other', 'misc', 'เบ็ดเตล็ด'], code: 'OTHER' },
]

function guessCategory(name: string): string | null {
    const n = name.toLowerCase()
    for (const entry of KEYWORD_MAP) {
        if (entry.keywords.some(kw => n.includes(kw.toLowerCase()))) {
            return entry.code
        }
    }
    return null
}

function col(row: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
        const found = Object.keys(row).find(r => r.trim().toLowerCase() === k.toLowerCase())
        if (found !== undefined && row[found] !== '') return String(row[found]).trim()
    }
    return ''
}

const SKU_PREFIX: Record<string, string> = {
    RAW_MEAT: 'RM', RAW_PORK: 'RP', RAW_SEA: 'RS', RAW_VEG: 'RV',
    DRY_GOODS: 'DG', PACKAGING: 'PK', OTHER: 'OT',
    BEER: 'B', BEER_DRAFT: 'BD', WINE: 'W', COCKTAIL: 'CK',
    DRINK: 'D', WATER: 'WI', FOOD_GRILL: 'FG', FOOD_FRY: 'FF',
    FOOD_RICE: 'FR', FOOD_NOODLE: 'FN', FOOD_SEA: 'FS', FOOD_VEG: 'FV',
    FOOD_LAAB: 'FL', KARAOKE: 'KR', SET: 'ST', ENTERTAIN: 'EN',
}

export const POST = withAuth<any>(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId } = ctx
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        if (!file) {
            return NextResponse.json({ success: false, error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 400 })
        }

        const buf = Buffer.from(await file.arrayBuffer())
        const wb = XLSX.read(buf, { type: 'buffer' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (rows.length === 0) {
            return NextResponse.json({ success: false, error: 'ไฟล์ไม่มีข้อมูล' }, { status: 400 })
        }

        const dbCategories = await prisma.category.findMany()
        const catByCode = new Map(dbCategories.map(c => [c.code.toLowerCase(), c]))
        const catByName = new Map(dbCategories.map(c => [c.name.toLowerCase(), c]))

        function findCategoryByExact(val: string) {
            const v = val.trim().toLowerCase()
            return catByCode.get(v) || catByName.get(v) || null
        }

        const existing = await prisma.product.findMany({ select: { sku: true, name: true } })
        const existingSkus = new Set(existing.map(p => p.sku))
        const existingNames = new Set(existing.map(p => p.name.toLowerCase()))

        const results: {
            row: number
            status: 'created' | 'skipped' | 'error'
            name: string
            category?: string
            guessed?: boolean
            reason?: string
        }[] = []

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const rowNum = i + 2

            const name = col(row, 'ชื่อวัตถุดิบ', 'ชื่อสินค้า', 'ชื่อ', 'name', 'item_name')
            const catRaw = col(row, 'หมวดหมู่', 'หมวด', 'category', 'cat')
            const costPriceRaw = col(row, 'ต้นทุน', 'ราคา', 'cost', 'cost_price', 'ราคา/หน่วย')
            const unit = col(row, 'หน่วย', 'unit') || 'กก.'
            const unitAlt = col(row, 'หน่วยรอง', 'unit_alt', 'unitalt')
            const convFactorRaw = col(row, 'อัตราแปลง', 'conv_factor', 'convfactor')
            const typeRaw = col(row, 'ประเภท', 'type', 'producttype', 'product_type')
            const note = col(row, 'หมายเหตุ', 'note')

            if (!name) {
                results.push({ row: rowNum, status: 'skipped', name: '-', reason: 'ไม่มีชื่อ' })
                continue
            }
            if (existingNames.has(name.toLowerCase())) {
                results.push({ row: rowNum, status: 'skipped', name, reason: 'ชื่อซ้ำในระบบ' })
                continue
            }

            // 3-step category resolution
            let category = catRaw ? findCategoryByExact(catRaw) : null
            let guessed = false

            if (!category) {
                const guessedCode = guessCategory(name)
                if (guessedCode) {
                    category = catByCode.get(guessedCode.toLowerCase()) || null
                    if (category) guessed = true
                }
            }
            if (!category) {
                // fallback → RAW_VEG (เบ็ดเตล็ด/ของแห้ง)
                category = catByCode.get('raw_veg') || catByCode.get('other') || dbCategories[0] || null
                if (category) guessed = true
            }
            if (!category) {
                results.push({ row: rowNum, status: 'error', name, reason: 'ไม่สามารถระบุหมวดหมู่ได้' })
                continue
            }

            const costPrice = parseFloat(costPriceRaw.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0
            const convFactor = parseFloat(convFactorRaw.replace(/,/g, '').replace(/[^\d.]/g, '')) || undefined

            // Determine productType
            let productType: 'RAW_MATERIAL' | 'PACKAGING' = 'RAW_MATERIAL'
            if (
                typeRaw.toLowerCase().includes('packaging') ||
                typeRaw.toLowerCase().includes('บรรจุ') ||
                category.code === 'PACKAGING'
            ) {
                productType = 'PACKAGING'
            }

            // Generate unique SKU
            const prefix = SKU_PREFIX[category.code] || 'OT'
            let nextNum = 1
            const prefixSkus = [...existingSkus].filter(s => {
                const rest = s.slice(prefix.length)
                return s.startsWith(prefix) && /^\d+$/.test(rest)
            })
            if (prefixSkus.length > 0) {
                nextNum = Math.max(...prefixSkus.map(s => parseInt(s.slice(prefix.length)) || 0)) + 1
            }
            let sku = `${prefix}${String(nextNum).padStart(2, '0')}`
            while (existingSkus.has(sku)) { nextNum++; sku = `${prefix}${String(nextNum).padStart(2, '0')}` }

            try {
                await prisma.product.create({
                    data: {
                        tenantId,
                        sku, name,
                        categoryId: category.id,
                        productType, unit,
                        unitAlt: unitAlt || undefined,
                        convFactor,
                        costPrice,
                        salePrice: 0,
                        note: note || undefined,
                    },
                })
                existingSkus.add(sku)
                existingNames.add(name.toLowerCase())
                results.push({ row: rowNum, status: 'created', name, category: category.name, guessed })
            } catch (e: unknown) {
                results.push({ row: rowNum, status: 'error', name, reason: e instanceof Error ? e.message : 'Unknown error' })
            }
        }

        const created = results.filter(r => r.status === 'created').length
        const skipped = results.filter(r => r.status === 'skipped').length
        const errors = results.filter(r => r.status === 'error').length
        const autoMatched = results.filter(r => r.guessed).length

        return NextResponse.json({
            success: true,
            data: { created, skipped, errors, autoMatched, total: rows.length, results },
        })

    } catch (e: unknown) {
        console.error('Import raw error:', e)
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}, ['OWNER', 'MANAGER'])
