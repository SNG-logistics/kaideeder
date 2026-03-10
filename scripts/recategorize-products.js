/**
 * recategorize-products.js v3 — แก้ category + productType สำหรับ products ที่ผิดหมวด
 * รองรับ category codes ใหม่ (Phase 0)
 * รัน: node scripts/recategorize-products.js
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient({ log: [] })

const norm = (s) =>
    (s ?? '').toLowerCase().trim()
        .replace(/[\(\)\[\]\-_/.,|]+/g, ' ')
        .replace(/\s+/g, ' ')

// ─── Rules (priority order — specific first) ──────────────────────────────────
const CAT_RULES = [

    // ━━━ A) INGREDIENT — วัตถุดิบ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── แช่แข็ง/กึ่งสำเร็จ (ก่อน protein เพราะมีคำว่า "หมู" ติดมาด้วย) ──
    {
        code: 'FROZEN', re: [
            /แช่แข็ง|frozen|กึ่งสำเร็จ|สำเร็จรูป|instant/i,
            /แฮมเบอร์เกอร์.*พร้อม|พิซซ่า.*แช่|ไก่.*แช่|หมู.*แช่/i,
        ]
    },

    // ── เห็ด (ก่อน RAW_VEG เพราะ ผัก จะดัก เห็ด) ──
    {
        code: 'MUSHROOM', re: [
            /เห็ด/i,
            /mushroom|shiitake|oyster.?mush|enoki|king.?oyster/i,
        ]
    },

    // ── ซีฟู้ด ──
    {
        code: 'SEAFOOD', re: [
            /กุ้ง|ปู|หอย|หมึก|กั้ง|แมงกระพรุน|น้ำปู/i,
            /ปลา(?!ร้า.*พร้อม|ร้า.*สำเร็จ)/i,
            /แซลมอน|กระเพาะปลา|ปลาร้า|สาหร่าย/i,
            /shrimp|prawn|crab|squid|seafood|clam|oyster|scallop/i,
        ]
    },

    // ── เนื้อหมู ──
    {
        code: 'PROTEIN_PORK', re: [
            /หมู(?!ป่า)|เบคอน|แฮม|ไส้กรอก|ซี่โครง|สันคอ|สามชั้น|หมูบด|หมูสับ/i,
            /ตับหมู|นมหมู|ต้นคอหมู|แหนม|หมูยอ|หมูหัน|หมูแดดเดียว|หมูหยอง/i,
            /หนังหมู|ไส้อ่อน|ไส้ตัน|แค็ปหมู|แค๊ปหมู|คอหมู|สันหมู/i,
        ]
    },

    // ── เนื้อสัตว์/ไก่/เป็ด/วัว/เครื่องใน/พิเศษ ──
    {
        code: 'PROTEIN_MEAT', re: [
            /เนื้อ|ไก่|เป็ด|วัว|โค|กบ|กระดูก/i,
            /น่องติดสะโพก|น่องไก่|อกไก่|ปีกไก่|ปีกกลางไก่|ตีนไก่|คีนไก่|คางเป็ด|อกเป็ด|ปีกเป็ด/i,
            /ดีวัว|ลิ้นวัว|เหงือกวัว|เหงือก|เอ็น|ขาลาย|เครื่องใน|ตับ\b|กึ๋น|ชุดลาบ|ชุดทำลาบ/i,
            /หนังไก่|ไก่เขาสวนกวาง|ไก่ย่าง.*ตัว|ไก่จ้อ|ไก่แช่เหล้า/i,
            /นกกระจอกเทศ|ostrich|จระเข้|crocodile|หมูป่า|wild.?boar|เนื้อกวาง|venison/i,
        ]
    },

    // ── ไข่ (รวมไข่พิเศษ) ──
    { code: 'EGG', re: [/ไข่ไก่|ไข่เป็ด|ไข่เค็ม|ไข่เยี่ยวม้า|ไข่นกกระทา|พวงไข่|ไข่มดแดง|ไข่กุ้ง|\begg\b/i] },

    // ── นม/ครีม/เนย/ชีส ──
    {
        code: 'DAIRY', re: [
            /นมวัว|นมสด|วิปปัง|วิปครีม|เนยจืด|เนยสด|ครีมสลัส|\bbutter\b|\bcream\b|\bmilk\b|\byogurt\b|โยเกิร์ต/i,
            /ชีส|พราเมทราน|\bcheese\b|cheddar|mozzarella|parmesan|brie|gouda/i,
        ]
    },

    // ── ผัก/สมุนไพร ──
    {
        code: 'VEGHERB', re: [
            /ผัก(?!บุ้ง.*ทอด|กาด.*ดอง)/i,
            /กระเทียม|หัวหอม|หอมแดง|หอมลาบ|หอมหัวใหญ่|ขิง|ข่า|ตะไคร้/i,
            /มะนาว|เลม่อน|มะเขือ|พริก(?!ไทย.*ป่น)|กะหลั่ม|กะหล่ำ|คะน้า|ผักกาด/i,
            /แครอท|แตงกวา|ถั่ว(?!ทอด)|ใบโหระพา|กะเพรา|ผักชี|ต้นหอม/i,
            /ขึ้นฉ่าย|มะเขือเทศ|มะพร้าว|กะทิ|บล็อคโคลี่|บรอคโคลี/i,
            /ฟักทอง|มะละกอ|มะระ|มะขาม|สับปะรด|หัวปลี|กวางตุ้ง/i,
            /ผักบุ้ง|กระเฉด|ชะอม|ผักหวาน|สะใบนาง|เต้าหู้|กระชาย|ดอกกล้วย/i,
            /herb|basil|coriander|lemongrass|galangal/i,
        ]
    },

    // ── ของแห้ง/เส้น/ข้าว/เครื่องปรุง/ซอส ──
    {
        code: 'DRY_GOODS', re: [
            /ซอส(?!.*packaging)|น้ำปลา|น้ำพริก|กะปิ|กระปิ/i,
            /ซีอิ้ว|ซีอิ๊ว|เกลือ|น้าตาล|น้ำตาล|พริกไทย|ผง[กซ]/i,
            /น้ำจิ้ม|น้ำมัน|vinegar|น้าส้ม|น้ำส้มสายชู/i,
            /เต้าเจี้ยว|รสดี|ผงซูรส|ผงกะหรี่|มายองเนส|บาวน์ซอส/i,
            /น้ำเชื่อม|โชยุ|ออริกาโน|โรสเมรี่|พาสรี่|อะโรมาด|อโรมาด/i,
            /ฝาเขียว|ฝาเหลือง|ฝาแดง|ฝาน้ำเงิน/i,
            /แป้งพิซซ่า|แป้งสาลี|แป้งทอด|แป้งฮ่องกง|โดว์|\bflour\b|\bdough\b|pizza.?base|แป้งขนมปัง/i,
            /เส้น|ก๋วยเตี๋ยว|noodle|บะหมี่|วุ้นเส้น|มาม่า|หมี่ไวไว|สปาเก็ตตี้|ปอเปี้[ยะ]|มักกะโรนี/i,
            /ข้าวสาร|ข้าวเหนียว|ข้าวโพด|rice(?!\s+dish)/i,
        ]
    },

    // ━━━ B) SUPPLY — ของใช้/บรรจุภัณฑ์ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── ทิชชู่/ผ้า/ทำความสะอาด ──
    {
        code: 'TISSUE_CLEAN', re: [
            /ทิชชู่|กระดาษเช็ด|ผ้าขี้ริ้ว|ผ้าเย็น|ผ้าเช็ด/i,
            /น้ำยา.*ล้าง|น้ำยา.*ทำความสะอาด|สบู่|detergent|cleaner/i,
        ]
    },

    // ── อุปกรณ์สิ้นเปลือง ──
    {
        code: 'DISPOSABLE', re: [
            /ถุงมือ|เข็ม|สายยาง|ถ่าน|หลอดไฟ|อุปกรณ์.*สิ้นเปลือง/i,
            /ไม้จิ้มฟัน|ไม้พาย|เทป|rubber.?band|ยางรัด/i,
            /ช้อนพลาสติก|ส้อมพลาสติก|หลอดดูด|ไม้ไผ่|ไม้เสียบ/i,
        ]
    },

    // ── กล่อง/ถุง/แพ็ค/บรรจุภัณฑ์ ──
    {
        code: 'BOX_BAG', re: [
            /\bบรรจุภัณฑ์\b/i,
            /กล่อง(?!.*ซอส)|ถุงใส|ถุงร้อน|ถุงซิป|ถุงรูด/i,
            /แก้วพลาสติก|แก้วกระดาษ/i,
            /จานโฟม|จานกระดาษ|ถาดโฟม/i,
            /แพ็คเกจ|packaging|ฟิล์มยืด|wrap|ฟอยล์/i,
        ]
    },

    // ━━━ B) SALE ITEMS — แอลกอฮอล์ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── โซจู (ก่อน WINE) ──
    {
        code: 'SOJU', re: [
            /soju|โซจู|chum.?churum|jinro|chamisul|hite/i,
        ]
    },

    // ── เบียร์สด (ก่อน BEER) ──
    {
        code: 'BEER_DRAFT', re: [
            /เบียร์สด|beerlao.*สด|สด.*tower|ทาวเวอร์|draft.?beer|beer.*draft/i,
            /\btower\b/i,
        ]
    },

    // ── เบียร์ขวด/กระป๋อง ──
    {
        code: 'BEER', re: [
            /เบียร์|beerlao|beer.?lao/i,
            /\bbeer\b/i,
            /heineken|hoegaarden|โฮกาเด้น/i,
            /singha|chang|leo|budweiser|corona|asahi|sapporo|kirin|tiger|san.?miguel|somersby/i,
            /1664|stella|carlsberg|carsberg/i,
            /ค่าขวดเบย|เบย[^้]|เบย$/i,
        ]
    },

    // ── ไวน์/วิสกี้/สุรา ──
    {
        code: 'WINE', re: [
            /ไวน์|\bwine\b/i,
            /วิสกี้|whisky|whiskey/i,
            /champagne|sparkling|prosecco/i,
            /penfolds|rawson|hoonuga|jacob/i,
            /johnni|johnnie|hennessy|regency|singerton|chivas|ballantine/i,
            /red.?label|black.?label|gold.?label|double.?black/i,
            /rum|vodka|\bgin\b|brandy|bourbon/i,
            /ค่าเปีดวาย|ค่าเปิดวาย|ค่าเปีดเหล้า|ค่าเปิดเหล้า/i,
        ]
    },

    // ━━━ B) SALE ITEMS — ไม่มีแอลกอฮอล์ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── น้ำดื่ม/น้ำแข็ง ──
    {
        code: 'WATER', re: [
            /น้ำดื่ม(?!.*ขวด.*แพค.*วัตถุดิบ)/i,
            /น้ำแข็ง|\bice\b/i,
            /น้ำเปล่า|mineral.?water|still.?water/i,
        ]
    },

    // ── น้ำอัดลม/มิกเซอร์ ──
    {
        code: 'SOFT_DRINK', re: [
            /โซดา|ชเวปส์|schweppes|\bsoda\b/i,
            /เป๊ปซี่|เป็ปซี่|pepsi|coke|โค้ก|sprite|fanta|7.?up|mirinda/i,
            /โออิชิ|ลีเจน|สติง|sting\b|red.?bull|กระทิงแดง/i,
            /มิกเซอร์|mixer|tonic/i,
            /น้ำหมากนาว|น้ำหมาก.?(หนอด|เย็น)/i,
        ]
    },

    // ━━━ B) SALE ITEMS — กาแฟ/ชา/ปั่น ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── กาแฟ ──
    {
        code: 'COFFEE', re: [
            /กาแฟ|กาเฟ|coffee|latte|ลาเต้|americano|อเมริกาโน|เอสเพรสโซ/i,
            /cappuccino|คาปู|ม็อกค้า|มอคค่า|espresso|frappe/i,
        ]
    },

    // ── ชา/โกโก้ ──
    {
        code: 'TEA', re: [
            /ชา[บเขาน]|green.?tea|ชานม|milk.?tea|matcha|มัทฉะ/i,
            /โกโก้|ช็อคโก|chocolate|cocoa/i,
            /herbal.?tea|รอยบอส|chamomile/i,
        ]
    },

    // ── โซดาผสม/น้ำผลไม้/ปั่น ──
    {
        code: 'SMOOTHIE', re: [
            /น้ำผลไม้|juice|สมูทตี้|smoothie|ปั่น|ปั้น/i,
            /น้ำส้มปั[้่น]|น้ำ.?ส้ม.*ปั|บลูเบอร์รี่|กีวี้|สตอเบอ|เสาวรส/i,
            /น้ำหมากนาวโซดา|นมสดปั่น/i,
            /602เมเปิ้ล|maple|คาลาเม/i,
        ]
    },

    // ━━━ C) FOOD MENU ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    { code: 'FOOD_SEA', re: [/ทะเล|seafood/i] },
    { code: 'FOOD_SALAD', re: [/ลาบ|ยำ|น้ำตก|ส้มตำ|ตำ|salad|\blaab\b|\byum\b/i] },
    { code: 'FOOD_BOIL', re: [/ต้ม|ซุป|แกง|curry|\bbroth\b|หม้อไฟ|สุกี้/i] },
    { code: 'FOOD_STIR', re: [/ผัด|stir.?fry|pad.?thai|ราดหน้า/i] },
    { code: 'FOOD_GRILL', re: [/ปิ้ง|ย่าง|grill|bbq|บาร์บีคิว|อบ(?!.*น้ำ)/i] },
    { code: 'FOOD_FRY', re: [/ทอด|fry|กรอบ|เฟรนฟราย|crispy/i] },
    { code: 'FOOD_SNACK', re: [/ของทานเล่น|ของกินเล่น|snack|appetizer|ของว่าง/i] },
    { code: 'FOOD_RICE', re: [/ข้าว(?!โพด)|rice/i] },

    // ━━━ อื่น ๆ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        code: 'KARAOKE', re: [
            /คาราโอเกะ/i,
            /ชั่วโมง.*ห้อง|ห้อง.*ชั่วโมง/i,
        ]
    },
    {
        code: 'ENTERTAIN', re: [
            /\bpr\b/i, /entertain/i, /เอนเตอร์เทน/i,
            /น้อง.{1,10}(entertain|ดา$|มีนา)/i,
            /ดิ้ง|โต้ะแตก|สาวมา.*แถม/i,
            /ค่าพนักงาน.*บริการ|นอกสถานที่/i,
        ]
    },
    {
        code: 'SET', re: [
            /โปร\b/i, /เซ็ต/i, /\bset\b/i, /\bcombo\b/i, /คอมโบ/i,
            /แถม.*ทาวเวอร์|แถม.*ไฮเนเก้น|แถม.*ลาว/i,
        ]
    },
]

// ── productType mapping ───────────────────────────────────────────────────────
const RAW_CATS = new Set(['PROTEIN_PORK', 'PROTEIN_MEAT', 'SEAFOOD', 'EGG', 'DAIRY', 'VEGHERB', 'MUSHROOM', 'DRY_GOODS', 'FROZEN'])
const SUPPLY_CATS = new Set(['BOX_BAG', 'TISSUE_CLEAN', 'DISPOSABLE'])

function productTypeFor(code) {
    if (RAW_CATS.has(code)) return 'RAW_MATERIAL'
    if (SUPPLY_CATS.has(code)) return 'PACKAGING'
    return 'SALE_ITEM'
}

function detect(name) {
    const n = norm(name)
    for (const rule of CAT_RULES) {
        for (const re of rule.re) {
            if (re.test(n)) return rule.code
        }
    }
    return 'OTHER'
}

async function main() {
    const cats = await p.category.findMany()
    const catByCode = Object.fromEntries(cats.map(c => [c.code, c]))

    const products = await p.product.findMany({
        include: { category: { select: { code: true } } }
    })

    console.log(`\n🔄 Recategorizing ${products.length} products...\n`)

    let updated = 0, skipped = 0, errors = 0
    const changes = []

    for (const prod of products) {
        const newCode = detect(prod.name)
        const oldCode = prod.category.code
        const newType = productTypeFor(newCode)
        const catChanged = newCode !== oldCode
        const typeChanged = prod.productType !== newType

        if (!catChanged && !typeChanged) { skipped++; continue }

        const newCat = catByCode[newCode] || catByCode['OTHER']
        if (!newCat) {
            console.error(`  ⚠️  ไม่พบ category "${newCode}" ในฐานข้อมูล — รัน upsert-categories.js ก่อน`)
            errors++
            continue
        }

        try {
            await p.product.update({
                where: { id: prod.id },
                data: {
                    ...(catChanged ? { categoryId: newCat.id } : {}),
                    ...(typeChanged ? { productType: newType } : {}),
                }
            })
            const catStr = catChanged ? `cat: ${oldCode} → ${newCode}` : ''
            const typeStr = typeChanged ? `type: ${prod.productType} → ${newType}` : ''
            changes.push(`  [${prod.sku}] ${prod.name} | ${[catStr, typeStr].filter(Boolean).join(' | ')}`)
            updated++
        } catch (e) {
            console.error(`  ❌ [${prod.sku}] ${prod.name}: ${e.message}`)
            errors++
        }
    }

    console.log('📋 Changes:')
    changes.slice(0, 300).forEach(c => console.log(c))
    if (changes.length > 300) console.log(`  ... and ${changes.length - 300} more`)
    console.log(`\n✅ Updated: ${updated} | Skipped: ${skipped} | Errors: ${errors}`)
}

main().catch(console.error).finally(() => p.$disconnect())
