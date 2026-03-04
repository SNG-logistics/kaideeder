/**
 * recategorize-products.js v2 — แก้ category + productType สำหรับ products ที่ผิดหมวด
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
    // ── เบียร์ (ยี่ห้อเฉพาะก่อน) ──
    {
        code: 'BEER', re: [
            /เบียร์|beerlao|beer.?lao|beeelao/i,
            /\bbeer\b/i,
            /heineken|hoegaarden|hoegarden|โฮกาเด้น/i,
            /singha|chang|leo|budweiser|corona|asahi|sapporo|kirin|tiger|san.?miguel|somersby|ซอมเมอร์บี้/i,
            /1664|stella|carlsberg|carsberg|casrberg|carlsber/i,
            /ค่าขวดเบย|เบย[^้]|เบย$/i,
        ]
    },
    // ── ไวน์/วิสกี้/สุรา ──
    {
        code: 'WINE', re: [
            /ไวน์|\bwine\b/i,
            /วิสกี้|whisky|whiskey|whiskie/i,
            /champagne|sparkling/i,
            /soju|โซจู/i,
            /penfolds|rawson|hoonuga|jacob/i,
            /johnni|johnnie|johni|johny/i,
            /hennessy|henny/i,
            /regency|singerton|chivas|ballantine/i,
            /red.?label|black.?label|gold.?label|double.?black/i,
            /ค่าเปีดวาย|ค่าเปิดวาย|ค่าเปีดเหล้า|ค่าเปิดเหล้า/i,
        ]
    },
    // ── ค็อกเทล ──
    {
        code: 'COCKTAIL', re: [
            /ค็อกเทล|\bcocktail\b/i,
            /mojito|margarita|martini|negroni|spritz/i,
        ]
    },
    // ── น้ำดื่ม/น้ำแข็ง ──
    {
        code: 'WATER', re: [
            /น้ำดื่ม/i,
            /น้ำแข็ง/i,
            /\bice\b/i,
            /โซดา|ชเวปส์|schweppes/i,
            /\bsoda\b/i,
            /น้ำหมากนาว|น้ำหมาก.?(หนอด|เย็น)/i,
        ]
    },
    // ── เครื่องดื่ม (ก่อน RAW) ──
    {
        code: 'DRINK', re: [
            /เครื่องดื่ม|\bdrink\b/i,
            /กาแฟ|กาเฟ|coffee|latte|ลาเต้|americano|อเมริกาโน|เอสเพรสโซ|เอสเพชโซ|เอสเพลสโช|cappuccino|คาปู|ม็อกค้า|มอคค่า/i,
            /ชา[บเขา]|บาร์รมควัน|\bgreen.?tea\b|ชานม|milk.?tea|matcha|มัทฉะ|มัดฉะ|โกโก้|ช็อคโก|chocolate|cocoa/i,
            /น้ำผลไม้|juice|สมูทตี้|smoothie|ปั่น|ปั้น/i,
            /โออิชิ|ลีเจน|สติง|เป๊ปซี่|เป็ปซี่|เปปซี่|pepsi|coke|โค้ก/i,
            /คาลาเม|602เมเปิ้ล|maple/i,
            /น้ำส้มปั[้่น]|น้ำ.?ส้ม.*ปั|บลูเบอร์รี่|กีวี้|สตอเบอ|เสาวรส/i,
            /น้ำหมากนาวโซดา/i,
            /นมสดปั่น/i,
        ]
    },

    // ── คาราโอเกะ/ค่าห้อง ──
    {
        code: 'KARAOKE', re: [
            /คาราโอเกะ/i,
            /ชั่วโมง.*ห้อง|ห้อง.*ชั่วโมง/i,
            /เหมา.*ชั่วโมง|ชั่วโมง.*เหมา/i,
            /ราคา.*ชั่วโมง/i,
        ]
    },
    // ── Entertain ──
    {
        code: 'ENTERTAIN', re: [
            /\bpr\b/i,
            /entertain/i,
            /เอนเตอร์เทน/i,
            /น้อง.{1,10}(entertain|ดา$|มีนา|น้อยหน่า|เดียร์)/i,
            /ดิ้ง/i,
            /ค่าพนักงาน.*บริการ|ค่าบริการ.*พนักงาน/i,
            /ค่าเอ็น.*นอกสถานที่|นอกสถานที่/i,
            /โต้ะแตก/i,
            /สาวมา.*แถม/i,
        ]
    },
    // ── เซ็ต/โปร ──
    {
        code: 'SET', re: [
            /โปร\b/i, /เซ็ต/i, /\bset\b/i, /\bcombo\b/i, /คอมโบ/i,
            /แถม.*ทาวเวอร์|แถม.*ไฮเนเก้น|แถม.*ลาว/i,
        ]
    },

    // ── บรรจุภัณฑ์ (ไม่รวม ฝา ที่อยู่ในชื่อซอส) ──
    {
        code: 'PACKAGING', re: [
            /\bบรรจุภัณฑ์\b/i,
            /กล่อง(?!.*ซอส)|ถุงใส|ถุงร้อน|ถุงซิป/i,
            /แก้วพลาสติก|แก้วกระดาษ/i,
            /หลอดดูด/i,
            /จานโฟม|จานกระดาษ/i,
            /ช้อนพลาสติก|ส้อมพลาสติก/i,
            /ทิชชู่|กระดาษเช็ด/i,
            /แพ็คเกจ|packaging/i,
            /ฟิล์มยืด|wrap|ฟอยล์|ฟอยล์/i,
            /ผ้าขี้ริ้ว|ผ้าเย็น/i,
        ]
    },

    // ── ไข่/นม/ชีส/แป้ง — ก่อน DRY_GOODS ──
    { code: 'EGG', re: [/ไข่ไก่|ไข่เป็ด|ไข่เค็ม|ไข่เยี่ยวม้า|ไข่นกกระทา|พวงไข่|\begg\b/i] },
    { code: 'DAIRY', re: [/นมวัว|นมสด|วิปปัง|วิปครีม|เนยจืด|เนยสด|ครีมสลัส|\bbutter\b|\bcream\b|\bmilk\b|\byogurt\b|โยเกิร์ต/i] },
    { code: 'CHEESE', re: [/ชีส|พราเมทราน|\bcheese\b|cheddar|mozzarella|parmesan|brie|gouda/i] },
    { code: 'FLOUR_DOUGH', re: [/แป้งพิซซ่า|แป้งสาลี|แป้งทอด|แป้งฮ่องกง|แป้งหมู|แผ่น.*พิซซ่า|พิซซ่า.*แผ่น|โดว์|\bflour\b|\bdough\b|pizza.?base|แป้งขนมปัง/i] },

    // ── เครื่องปรุง/ของแห้ง (น้ำมัน/ซอส ต้องมาก่อน RAW_SEA) ──
    {
        code: 'DRY_GOODS', re: [
            /ซอส(?!.*ฝา.*หลั|.*packaging)|น้ำปลา|น้ำพริก|กะปิ|กระปิ/i,
            /ซีอิ้ว|ซีอิ๊ว|เกลือ|น้าตาล|น้ำตาล|พริกไทย|ผง[กซ]/i,
            /น้ำจิ้ม|น้ำมัน|vinegar|น้าส้ม|น้ำส้มสายชู/i,
            /เต้าเจี้ยว|รสดี|ผงซูรส|ผงกะหรี่|มายองเนส|บาวน์ซอส/i,
            /น้ำเชื่อม|โชยุ|ออริกาโน|โรสเมรี่|พาสรี่|อะโรมาด|อโรมาด/i,
            /น้ำดื่ม.*(ขวด|ตุก|แพค)|น้ำดื่มน้อย/i,
            /ฝาเขียว|ฝาเหลือง|ฝาแดง|ฝาน้ำเงิน/i,
        ]
    },

    // ── อาหารทะเลดิบ ──
    {
        code: 'RAW_SEA', re: [
            /กุ้ง|ปลา|หมึก|ปู|หอย|แซลมอน|กั้ง|แมงกระพรุน|น้ำปู/i,
            /กระเพาะปลา|ปลาร้า|สาหร่าย/i,
        ]
    },
    // ── หมู ──
    {
        code: 'RAW_PORK', re: [
            /หมู|เบคอน|แฮม|ไส้กรอก|ซี่โครง|สันคอ|สามชั้น|หมูบด|หมูสับ/i,
            /ตับหมู|นมหมู|ต้นคอหมู|คะนอร์.*หมู|ผงหมัก/i,
        ]
    },
    // ── เนื้อสัตว์/ไก่/เป็ด/วัว ──
    {
        code: 'RAW_MEAT', re: [
            /เนื้อ|ไก่|เป็ด|วัว|โค|กบ|กระดูก/i,
            /น่องติดสะโพก|น่องไก่|อกไก่|ปีกไก่|ตีนไก่|คีนไก่|คางเป็ด|อกเป็ด|ปีกเป็ด/i,
            /ดีวัว|ลิ้นวัว|เหงือกวัว|ขาลาย|เครื่องใน|ตับ\b|กึ๋น|ชุดลาบ|ชุดทำลาบ/i,
            /วัวแดดเดียว|ลูกชิ้นเนื้อ/i,
            /บล็อกโครี่/i,  // broccoli ที่ถูก import ผิด → raw_meat เดิม ให้ยก raw_veg
        ]
    },
    // ── ผัก/วัตถุดิบสด ──
    {
        code: 'RAW_VEG', re: [
            /ผัก|เห็ด/i,
            /กระเทียม|หัวหอม|หอมแดง|หอมลาบ|หอมหัวใหญ่|ขิง|ข่า|ตะไคร้/i,
            /มะนาว|เลม่อน|มะเขือ|พริก|กะหลั่ม|กะหล่ำ|คะน้า|ผักกาด/i,
            /แครอท|แตงกวา|ถั่ว(?!ทอด)|ใบโหระพา|กะเพรา|ผักชี|ต้นหอม/i,
            /ขึ้นฉ่าย|มะเขือเทศ|มะพร้าว|กะทิ|บล็อคโคลี่|บรอคโคลี/i,
            /ฟักทอง|มะละกอ|มะระ|มะขาม|สับปะรด|หัวปลี|กวางตุ้ง/i,
            /ผักบุ้ง|กระเฉด|ชะอม|ผักหวาน|สะใบนาง|เต้าหู้|กระชาย/i,
            /ดอกกล้วยไม้|ดอกกล้วย|สาหร่าย/i,
        ]
    },

    // ── อาหาร ──
    { code: 'FOOD_NOODLE', re: [/เส้น|ก๋วยเตี๋ยว|noodle|บะหมี่|วุ้นเส้น|มาม่า|หมี่ไวไว|สปาเก็ตตี้|ปอเปี้[ยะ]|มักกะโรนี|เส้นบุก/i] },
    { code: 'FOOD_GRILL', re: [/ปิ้งย่าง|ย่าง|grill|bbq|บาร์บีคิว/i] },
    { code: 'FOOD_FRY', re: [/ทอด|fry|กรอบ|เฟรนฟราย/i] },
    { code: 'FOOD_SEA', re: [/ทะเล|seafood/i] },
    { code: 'FOOD_VEG', re: [/\bveg\b|เจ\b|ผักรวม/i] },
    { code: 'FOOD_LAAB', re: [/ลาบ|ยำ/i] },
    { code: 'FOOD_RICE', re: [/ข้าว(?!โพด)|rice/i, /ข้าวคั่ว|ข้าวปุ้น|ข้าวสาร|ข้าวโพด/i] },
]

// productType mapping
const RAW_CATS = new Set(['RAW_MEAT', 'RAW_PORK', 'RAW_SEA', 'RAW_VEG', 'DRY_GOODS', 'PACKAGING', 'EGG', 'DAIRY', 'CHEESE', 'FLOUR_DOUGH'])

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
        const newType = RAW_CATS.has(newCode) ? 'RAW_MATERIAL' : 'SALE_ITEM'
        const catChanged = newCode !== oldCode
        const typeChanged = prod.productType !== newType

        if (!catChanged && !typeChanged) { skipped++; continue }

        const newCat = catByCode[newCode] || catByCode['OTHER']
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
    changes.slice(0, 200).forEach(c => console.log(c))
    if (changes.length > 200) console.log(`  ... and ${changes.length - 200} more`)
    console.log(`\n✅ Updated: ${updated} | Skipped: ${skipped} | Errors: ${errors}`)
}

main().catch(console.error).finally(() => p.$disconnect())
