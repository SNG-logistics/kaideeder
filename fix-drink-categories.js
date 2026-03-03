// @ts-nocheck
// fix-drink-categories.js — reassign categories + rename SKU prefixes
// รัน: node fix-drink-categories.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ─── SKU Prefix per category ───────────────────────────────────────────────
const SKU_PREFIX = {
    BEER: 'B', BEER_DRAFT: 'BD', WINE: 'W', COCKTAIL: 'CK',
    DRINK: 'D', WATER: 'WI',
    FOOD_GRILL: 'FG', FOOD_FRY: 'FF', FOOD_SEA: 'FS', FOOD_VEG: 'FV',
    FOOD_LAAB: 'FL', FOOD_RICE: 'FR', FOOD_NOODLE: 'FN',
    SET: 'ST', KARAOKE: 'KR', ENTERTAIN: 'EN',
    RAW_MEAT: 'RM', RAW_PORK: 'RP', RAW_SEA: 'RS',
    RAW_VEG: 'RV', DRY_GOODS: 'DG', PACKAGING: 'PK', OTHER: 'OT',
}

// ─── Rules: keyword → target category code ─────────────────────────────────
const RULES = [
    {
        code: 'BEER',
        keywords: [
            'beer', 'beerlao', 'beelao', 'beeelao',
            'heineken', 'carlsberg', 'carsberg', 'budweiser', 'corona',
            'somersby', 'ซอมเมอร์บี้', 'ซอมเมอรบี้',
            'hoegarden', 'hoegaarden', '1664', 'tiger', 'chang',
            'เบียร์', 'ทาวเวอร์',
        ],
    },
    {
        code: 'WINE',
        keywords: [
            'wine', 'ไวน์', 'วาย',
            'penfolds', 'rawson', 'hoonuga', 'siegel', 'carmenere',
            'chardonnay', 'jacop', 'jacob', 'retreat',
            'whisky', 'whiskey', 'วิสกี้',
            'johnnie', 'johny', 'johnny',
            'hennessy', 'vsop',
            'regency', 'singerton', 'singleton',
            'vodka', 'rum', 'gin', 'brandy', 'บรั่นดี',
            'เหล้า', 'ค่าเปีดเหล้า', 'ค่าเปีดวาย',
        ],
    },
    {
        code: 'DRINK',
        keywords: [
            'กาแฟ', 'กาเฟ', 'coffee', 'maple coffee', 'คาปูชิโน่', 'latte', 'espresso',
            'คาลาเมว', 'คาลาเมวิบ',
            'ชา', 'ชานม', 'ชาเขียว', 'ชามะนาว', 'ชาบะรม', 'tea',
            'ช็อคโกเลต', 'ช็อกโกเลต', 'chocolate',
            'สมูทตี้', 'smoothie', 'กีวี้ปั่น', 'กีวีปั่น',
            'pepsi', 'cola', 'sprite', 'fanta', 'coke', 'โซดา', 'soda',
            'ชเวปส์', 'schweppes',
            'เสาวรส', 'juice', 'น้ำผลไม้', 'เครื่องดื่ม',
        ],
    },
    {
        code: 'OTHER',
        keywords: ['entertain', 'ดิ้ง pr', 'ค่าพนักงาน', 'ค่าชั่วโมง', 'ค่าขวด', 'ค่าเปีด', 'ค่าเอ็น', 'ค่า'],
    },
]

const FORCE_MAP = {
    'RS15': 'DRINK', 'RS16': 'DRINK', 'RS17': 'DRINK', // คาปูชิโน่
    'RV314': 'OTHER', 'RV320': 'OTHER',                  // entertain/PR
}

function guessCode(name) {
    const n = name.toLowerCase()
    for (const rule of RULES) {
        if (rule.keywords.some(kw => n.includes(kw.toLowerCase()))) return rule.code
    }
    return null
}

async function main() {
    const allCats = await prisma.category.findMany()
    const catByCode = new Map(allCats.map(c => [c.code, c]))

    // โหลดสินค้าพร้อม category
    const products = await prisma.product.findMany({ include: { category: true } })

    // Build current SKU set for uniqueness check
    const allSkus = new Set(products.map(p => p.sku))

    // Counter per prefix (เพื่อ gen next number)
    const prefixNextNum = {}
    for (const p of products) {
        const cat = p.category
        const expectedPrefix = SKU_PREFIX[cat.code] || 'OT'
        const rest = p.sku.slice(expectedPrefix.length)
        if (p.sku.startsWith(expectedPrefix) && /^\d+$/.test(rest)) {
            const n = parseInt(rest)
            if (!prefixNextNum[expectedPrefix] || n >= prefixNextNum[expectedPrefix]) {
                prefixNextNum[expectedPrefix] = n + 1
            }
        }
    }

    function genNextSku(prefix) {
        const n = prefixNextNum[prefix] || 1
        prefixNextNum[prefix] = n + 1
        let sku = `${prefix}${String(n).padStart(2, '0')}`
        while (allSkus.has(sku)) {
            prefixNextNum[prefix]++
            sku = `${prefix}${String(prefixNextNum[prefix] - 1).padStart(2, '0')}`
        }
        allSkus.add(sku)
        return sku
    }

    const catChanges = []  // { product, targetCat }
    const skuChanges = []  // { product, newSku, targetCat }

    for (const p of products) {
        let targetCode = FORCE_MAP[p.sku] || guessCode(p.name)
        let targetCat = targetCode ? catByCode.get(targetCode) : null

        // If category needs to change
        if (targetCat && targetCat.id !== p.category.id) {
            catChanges.push({ product: p, targetCat })
        } else {
            targetCat = p.category // no category change
        }

        // Check if SKU prefix matches (use targetCat which may have changed)
        const usedCat = targetCat
        const expectedPrefix = SKU_PREFIX[usedCat.code] || 'OT'
        const currentPrefix = p.sku.replace(/\d+$/, '') // strip trailing digits

        if (currentPrefix !== expectedPrefix) {
            const newSku = genNextSku(expectedPrefix)
            skuChanges.push({ product: p, newSku, expectedPrefix, oldSku: p.sku, targetCat: usedCat })
        }
    }

    console.log(`\n📊 สรุป:`)
    console.log(`   เปลี่ยนหมวดหมู่  : ${catChanges.length} รายการ`)
    console.log(`   เปลี่ยน SKU prefix: ${skuChanges.length} รายการ`)

    if (catChanges.length === 0 && skuChanges.length === 0) {
        console.log('\n✅ ทุกอย่างถูกต้องแล้ว')
        return
    }

    // Preview
    const previewGroup = {}
    for (const { product, newSku, targetCat } of skuChanges) {
        const key = `${targetCat.icon} ${targetCat.name}`
        if (!previewGroup[key]) previewGroup[key] = []
        previewGroup[key].push(`  ${product.sku} → ${newSku}  (${product.name})`)
    }
    console.log('\n📋 ตัวอย่าง SKU ที่จะเปลี่ยน:')
    for (const [cat, rows] of Object.entries(previewGroup)) {
        console.log(`\n${cat}:`)
        rows.slice(0, 6).forEach(r => console.log(r))
        if (rows.length > 6) console.log(`  ... และอีก ${rows.length - 6} รายการ`)
    }

    // ── Step 1: Update categories ─────────────────────────────────────────
    if (catChanges.length > 0) {
        const grouped = {}
        for (const { product, targetCat } of catChanges) {
            if (!grouped[targetCat.id]) grouped[targetCat.id] = []
            grouped[targetCat.id].push(product.id)
        }
        for (const [catId, ids] of Object.entries(grouped)) {
            await prisma.product.updateMany({ where: { id: { in: ids } }, data: { categoryId: catId } })
        }
        console.log(`\n✅ อัปเดตหมวดหมู่ ${catChanges.length} รายการแล้ว`)
    }

    // ── Step 2: Update SKUs one-by-one (unique constraint) ───────────────
    if (skuChanges.length > 0) {
        // First pass: rename to temp SKU using full UUID (guaranteed unique)
        for (const { product, newSku } of skuChanges) {
            await prisma.product.update({
                where: { id: product.id },
                data: { sku: `TEMP_${product.id}` },  // full UUID = always unique
            })
        }
        // Second pass: set final SKU
        for (const { product, newSku } of skuChanges) {
            await prisma.product.update({
                where: { id: product.id },
                data: { sku: newSku },
            })
        }
        console.log(`✅ อัปเดต SKU ${skuChanges.length} รายการแล้ว`)
    }

    console.log('\n🎉 เสร็จสิ้น!')
}

main()
    .catch(e => { console.error('❌', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
