import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'
import * as XLSX from 'xlsx'

// ────────────────────────────────────────────────────────────
// POST /api/products/import
// รับไฟล์ Excel (.xlsx/.xls) แล้ว bulk-create เมนูร้าน
// หมวดหมู่อัตโนมัติ: วิเคราะห์ชื่อเมนูด้วย keyword matching
// รองรับชื่อเมนูทั้งไทย/อังกฤษ และชื่อแบรนด์เครื่องดื่มจริง
// ────────────────────────────────────────────────────────────

// ── Keyword → Category code map ──────────────────────────────────
// เรียงจาก specific → general เพื่อให้ match ที่แม่นที่สุดก่อน
const KEYWORD_MAP: { keywords: string[]; code: string }[] = [
    // ── เบียร์สด / ดราฟ ─────────────────────────────────────────
    {
        keywords: [
            'draft', 'ดราฟ', 'เบียร์สด', 'bia sod', 'on tap', 'สด(',
            'สด(', 'สด 1', 'สด 2', 'beer สด',
        ], code: 'BEER_DRAFT'
    },

    // ── เบียร์ขวด/กระป๋อง ───────────────────────────────────────
    {
        keywords: [
            'beer', 'เบียร์', 'bia', 'singha', 'leo', 'chang', 'อาชา',
            'haeineken', 'heineken', 'asahi', 'corona', 'budweiser', 'tiger',
            'carlsberg', 'san miguel', 'lao beer', 'เบียร์ลาว',
            'เบียร์แก้ว', 'แก้วเบียร์',
        ], code: 'BEER'
    },

    // ── ไวน์ (วาย = wine ในสไตล์ร้านนี้) ───────────────────────
    {
        keywords: [
            'wine', 'ไวน์', 'วาย ', 'วาย(', 'วายแดง', 'วายขาว', 'วายโรเซ',
            'red wine', 'white wine', 'rosé', 'rose wine',
            'penfolds', 'rawson', 'jacop', "jacob's", 'siegel', 'carmenere',
            'sauvignon', 'chardonnay', 'shiraz', 'merlot', 'cabernet',
            'anastasia', 'hoonuga', 'hill ', 'bin2', 'bin 2',
        ], code: 'WINE'
    },

    // ── ค็อกเทล ──────────────────────────────────────────────────
    {
        keywords: [
            'cocktail', 'ค็อกเทล', 'mocktail', 'มอคเทล',
            'spritz', 'sangria', 'mojito', 'margarita', 'cosmopolitan',
        ], code: 'COCKTAIL'
    },

    // ── น้ำเปล่า / โซดา ─────────────────────────────────────────
    { keywords: ['น้ำเปล่า', 'น้ำแร่', 'mineral water', 'still water', 'sparkling water', 'โซดา', 'soda water'], code: 'WATER' },

    // ── เครื่องดื่มทั่วไป (ปั๊น = แก้วปั๊น = coffee blend) ───────
    {
        keywords: [
            'ปั๊น', 'blend', 'blended',
            'juice', 'น้ำผลไม้', 'ชา', 'กาแฟ', 'coffee', 'tea',
            'ลาเต้', 'latte', 'อเมริกาโน', 'americano', 'espresso', 'cappu', 'mocha',
            'ลิ้นจี่', 'มะนาว', 'ส้ม', 'มะม่วง', 'ฝรั่ง', 'แตงโม', 'สับปะรด',
            'โยเกิร์ต', 'นม', 'milk', 'smoothie', 'shake', 'ชาเขียว', 'ชาไทย', 'บับเบิ้ล',
            'น้ำดื่ม', 'เครื่องดื่ม', 'drink', 'beverage', 'frappe',
            'ราดเบิ้ล', 'double', 'single',  // coffee sizes
        ], code: 'DRINK'
    },

    // ── คาราโอเกะ ─────────────────────────────────────────────────
    { keywords: ['คาราโอเกะ', 'karaoke', 'ค่าห้อง', 'ห้องคาราโอเกะ'], code: 'KARAOKE' },

    // ── แอลกอฮอล์สูง / Entertain ─────────────────────────────────
    // (เหล้า = spirits ในเมนูร้านนี้, โปร = promotion spirits?)
    {
        keywords: [
            'เหล้า', 'วิสกี้', 'whisky', 'whiskey', 'whiskers',
            'johny', 'johnny', 'walker', 'johnnie',
            'rum', 'vodka', 'gin', 'brandy', 'arak', 'อารัก',
            'hennessy', 'hennesses', 'singleton', 'glenfiddich', 'jameson',
            'jack daniel', 'jim beam', 'ballantine', 'chivas', 'royal stag',
            'สาโท', 'เจ้าโหว่', 'มวยลาว', 'ลายัม', 'ลาว-ลาว',
            'แชมเปญ', 'champagne', 'prosecco',
            'alcohol', 'spirit', 'liquor',
        ], code: 'ENTERTAIN'
    },

    // ── เซ็ต ─────────────────────────────────────────────────────
    { keywords: ['set', 'เซ็ต', 'combo', 'compo', 'แพ็ก', 'package', 'party pack', 'บุฟเฟต์', 'buffet'], code: 'SET' },

    // ── อาหารทะเล ────────────────────────────────────────────────
    {
        keywords: [
            'กุ้ง', 'ปู', 'ปูม้า', 'หอย', 'หอยแครง', 'หอยแมลงภู่', 'หอยลาย',
            'ปลาหมึก', 'หมึก', 'กั้ง', 'ปลา', 'ปลากระพง', 'ปลาทับทิม', 'ปลานิล', 'ปลาช่อน',
            'shrimp', 'prawn', 'crab', 'squid', 'seafood', 'ทะเล',
        ], code: 'FOOD_SEA'
    },

    // ── ลาบ / น้ำตก / ยำ / ส้มตำ ────────────────────────────────
    {
        keywords: [
            'ลาบ', 'น้ำตก', 'ยำ', 'ส้มตำ', 'ตำ', 'laab', 'larb', 'yum',
            'คั่ว', 'ต้มยำ', 'ต้มข่า', 'แจ่ว', 'ซุป', 'สลัด', 'salad',
        ], code: 'FOOD_LAAB'
    },

    // ── ผัก / เต้าหู้ ────────────────────────────────────────────
    {
        keywords: [
            'ผัก', 'เต้าหู้', 'tofu', 'ผักบุ้ง', 'ผักคะน้า', 'กวางตุ้ง',
            'ถั่วงอก', 'เห็ด', 'บรอคโคลี่', 'ฟักทอง', 'มะเขือ',
        ], code: 'FOOD_VEG'
    },

    // ── ก๋วยเตี๋ยว / เส้น ────────────────────────────────────────
    {
        keywords: [
            'ก๋วยเตี๋ยว', 'เส้น', 'ราดหน้า', 'ผัดไทย', 'หมี่', 'บะหมี่',
            'noodle', 'เส้นใหญ่', 'เส้นเล็ก', 'เส้นหมี่', 'pad thai',
            'ก๋วยจั๊บ', 'wonton', 'เกี๊ยว',
        ], code: 'FOOD_NOODLE'
    },

    // ── ข้าว ─────────────────────────────────────────────────────
    {
        keywords: [
            'ข้าวผัด', 'ข้าวกระเพรา', 'ข้าวมันไก่', 'ข้าวหน้า', 'ข้าวราด', 'ข้าวสวย',
            'fried rice', 'khao', 'ข้าวต้ม', 'โจ๊ก',
        ], code: 'FOOD_RICE'
    },

    // ── ทอด / ย่าง / ผัด / เนื้อสัตว์ ────────────────────────────
    {
        keywords: [
            'ทอด', 'ย่าง', 'ปิ้ง', 'อบ', 'ผัด',
            'ไก่', 'หมู', 'เนื้อ', 'วัว', 'ซี่โครง', 'สเต็ก', 'steak',
            'grill', 'bbq', 'บาร์บีคิว',
            'ไก่ย่าง', 'ไก่ทอด', 'หมูย่าง', 'หมูทอด', 'เนื้อย่าง',
            'คอหมู', 'สันคอ', 'สะโพก', 'ปีกไก่', 'วิง', 'wing',
            'ไส้กรอก', 'sausage', 'ลูกชิ้น', 'meatball',
        ], code: 'FOOD_FRY'
    },

    // ── อาหารทั่วไป (fallback) ───────────────────────────────────
    { keywords: ['แกง', 'curry', 'ต้ม', 'อาหาร', 'food', 'จาน', 'dish', 'stir'], code: 'FOOD_GRILL' },
]

/** วิเคราะห์ชื่อเมนู → คืน category code */
function guessCategory(name: string): string | null {
    const n = name.toLowerCase()
    for (const entry of KEYWORD_MAP) {
        if (entry.keywords.some(kw => n.includes(kw.toLowerCase()))) {
            return entry.code
        }
    }
    return null
}

/** นอร์มัลไลซ์คอลัมน์จาก Excel row */
function col(row: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
        const found = Object.keys(row).find(r => r.trim().toLowerCase() === k.toLowerCase())
        if (found !== undefined && row[found] !== '') return String(row[found]).trim()
    }
    return ''
}

const SKU_PREFIX: Record<string, string> = {
    BEER: 'B', BEER_DRAFT: 'BD', WINE: 'W', COCKTAIL: 'CK',
    DRINK: 'D', WATER: 'WI', FOOD_GRILL: 'FG', FOOD_FRY: 'FF',
    FOOD_RICE: 'FR', FOOD_NOODLE: 'FN', FOOD_SEA: 'FS', FOOD_VEG: 'FV',
    FOOD_LAAB: 'FL', KARAOKE: 'KR', SET: 'ST', ENTERTAIN: 'EN',
    RAW_MEAT: 'RM', RAW_PORK: 'RP', RAW_SEA: 'RS', RAW_VEG: 'RV',
    DRY_GOODS: 'DG', PACKAGING: 'PK', OTHER: 'OT',
}

// หมวดที่ต้องสร้าง Recipe บอมอัตโนมัติ (อาหาร ไม่รวมเครื่องดื่ม/เหล้า)
const FOOD_CATEGORIES = new Set([
    'FOOD_GRILL', 'FOOD_FRY', 'FOOD_RICE', 'FOOD_NOODLE',
    'FOOD_SEA', 'FOOD_VEG', 'FOOD_LAAB', 'SET',
])

export const POST = withAuth<any>(async (req: NextRequest) => {
    try {
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
            recipeCreated?: boolean
            reason?: string
        }[] = []

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const rowNum = i + 2

            const name = col(row, 'ชื่อเมนู', 'ชื่อสินค้า', 'name', 'menu_name', 'menuname')
            const catRaw = col(row, 'หมวดหมู่', 'หมวด', 'category', 'cat')
            const salePriceRaw = col(row, 'ราคาขาย', 'ราคา', 'sale_price', 'saleprice', 'ราคาขาย (₭)')
            const costPriceRaw = col(row, 'ต้นทุน', 'cost', 'cost_price', 'costprice', 'ต้นทุน (₭)')
            const unit = col(row, 'หน่วย', 'unit') || 'จาน'
            const typeRaw = col(row, 'ประเภท', 'type', 'producttype', 'product_type')
            const note = col(row, 'หมายเหตุ', 'note')

            if (!name) {
                results.push({ row: rowNum, status: 'skipped', name: '-', reason: 'ไม่มีชื่อเมนู' })
                continue
            }
            if (existingNames.has(name.toLowerCase())) {
                results.push({ row: rowNum, status: 'skipped', name, reason: 'ชื่อซ้ำในระบบ' })
                continue
            }

            // ── 3-step category resolution ──────────────────────
            let category = catRaw ? findCategoryByExact(catRaw) : null
            let guessed = false

            if (!category) {
                // keyword analysis จากชื่อเมนู
                const guessedCode = guessCategory(name)
                if (guessedCode) {
                    category = catByCode.get(guessedCode.toLowerCase()) || null
                    if (category) guessed = true
                }
            }

            if (!category) {
                // fallback → FOOD_GRILL
                category = catByCode.get('food_grill') || dbCategories[0] || null
                if (category) guessed = true
            }

            if (!category) {
                results.push({ row: rowNum, status: 'error', name, reason: 'ไม่สามารถระบุหมวดหมู่ได้' })
                continue
            }

            const salePrice = parseFloat(salePriceRaw.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0
            const costPrice = parseFloat(costPriceRaw.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0

            let productType: 'SALE_ITEM' | 'ENTERTAIN' = 'SALE_ITEM'
            if (typeRaw.toLowerCase().includes('entertain') || ['ENTERTAIN', 'KARAOKE'].includes(category.code)) {
                productType = 'ENTERTAIN'
            }

            // Generate unique SKU
            const prefix = SKU_PREFIX[category.code] || 'XX'
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
                    data: { sku, name, categoryId: category.id, productType, unit, costPrice, salePrice, note: note || undefined },
                })
                existingSkus.add(sku)
                existingNames.add(name.toLowerCase())

                // สร้าง Recipe บอมว่าง สำหรับประเภทอาหาร
                let recipeCreated = false
                if (FOOD_CATEGORIES.has(category.code)) {
                    const recipeExists = await prisma.recipe.findFirst({
                        where: { menuName: name, isActive: true },
                    })
                    if (!recipeExists) {
                        await prisma.recipe.create({
                            data: {
                                menuName: name,
                                note: `[Auto] สร้างอัตโนมัติจาก Import — กรุณาเพิ่มส่วนผสมในหน้า Recipe`,
                            },
                        })
                        recipeCreated = true
                    }
                }

                results.push({ row: rowNum, status: 'created', name, category: category.name, guessed, recipeCreated })
            } catch (e: unknown) {
                results.push({ row: rowNum, status: 'error', name, reason: e instanceof Error ? e.message : 'Unknown error' })
            }
        }

        const created = results.filter(r => r.status === 'created').length
        const skipped = results.filter(r => r.status === 'skipped').length
        const errors = results.filter(r => r.status === 'error').length
        const autoMatched = results.filter(r => r.guessed).length
        const recipesCreated = results.filter(r => r.recipeCreated).length

        return NextResponse.json({
            success: true,
            data: { created, skipped, errors, autoMatched, recipesCreated, total: rows.length, results },
        })

    } catch (e: unknown) {
        console.error('Import error:', e)
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}, ['OWNER', 'MANAGER'])
