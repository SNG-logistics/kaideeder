/**
 * audit-products.js — เปรียบเทียบ Products ใน DB กับ import-stock.js
 * รัน: node scripts/audit-products.js
 *
 * ไม่มีการเปลี่ยนแปลงข้อมูล — อ่านอย่างเดียว
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient({ log: [] })

// ─── Import list from import-stock.js ──────────────────────────────────────
const IMPORT_ITEMS = [
    { name: 'แผ่นแป้ง พิซซ่า', unit: 'แผ่น', cat: 'DRY_GOODS' },
    { name: 'เบคอน', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'เนื้อปูก้อน แช่แข็ง', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'ไข่เค็ม', unit: 'ฟอง', cat: 'DRY_GOODS' },
    { name: 'ไข่กุ้ง', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'เนื้อหอยเชลล์', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'เฟรนฟรายด์', unit: 'กิโลกรัม', cat: 'DRY_GOODS' },
    { name: 'เนื้อนกกระจอกเทศ', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'เนื้อจระเข้', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'เนื้อหมูป่า', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'เนื้อกวาง', unit: 'แผ่น', cat: 'RAW_MEAT' },
    { name: 'เนื้ออกเป็ด', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'ขาหมูเยอรมัน', unit: 'ขา', cat: 'RAW_PORK' },
    { name: 'หอยแมลงภู่', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'ปูอัด', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'กุ้งขาว', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'กุ้ง สำหรับปิ้ง', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'กุ้ง ทำต้มยำ', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'แซลมอน (สด)', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'ถั่วแระญี่ปุ่น', unit: 'กิโลกรัม', cat: 'RAW_VEG' },
    { name: 'ไส้กรอกอีสาน', unit: 'แผ่น', cat: 'RAW_PORK' },
    { name: 'ขาใต้ไก่ (น่อง)', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'ขาลาย (วัว)', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'กบ', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'อกไก่', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'ชุดลาบ', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'วัว แคดเคียว', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'หมู แคดเคียว', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'ปลาน้ำของ (ต้ม)', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'ปลาน้ำของ (ควก)', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'เนื้อเสือร้องไห้ (ผัด)', unit: 'แผ่น', cat: 'RAW_MEAT' },
    { name: 'เนื้อเสือร้องไห้ (ปิ้ง)', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'คีนไก่', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'กระดูกข้าง (ต้ม)', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'ปีกไก่', unit: 'ฟอง', cat: 'RAW_MEAT' },
    { name: 'เอ็นเหลือง', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'เหรือก (วัว)', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'คางเป็ด', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'เอ็นไก่', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'ไส้อ่อน', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'หมึก', unit: 'แผ่น', cat: 'RAW_SEA' },
    { name: 'นมหมู (ปิ้ง)', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'ต้นคอหมู', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'เนื้อหมูสด', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'ไก่ต้ม', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'เนย', unit: 'กิโลกรัม', cat: 'DRY_GOODS' },
    { name: 'เด็บมือนาง (ตีนไก่)', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'ปลานิล', unit: 'ตัว', cat: 'RAW_SEA' },
    { name: 'ไส้กรอก รมควัน', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'ไส้ตัน', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'ไก่เขาสวนกวาง', unit: 'ตัว', cat: 'RAW_MEAT' },
    { name: 'กระดูกข้าง (ปิ้ง)', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'แหนมกระดูกอ่อน', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'หมูบด', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'หมึก (สด)', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'ปูม้า', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'ผักแช่แข็ง', unit: 'กิโลกรัม', cat: 'RAW_VEG' },
    { name: 'ปลากระพง', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'มันกุ้ง', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'ปลาซาบะ รมควัน', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'ปลาซาบะ (ปิ้ง)', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'หมึก แช่แข็ง', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'ลูกชิ้น บาบีคิว', unit: 'กิโลกรัม', cat: 'RAW_MEAT' },
    { name: 'หมู 3ชั้น', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'ตับหมู', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'หนังหมู', unit: 'กิโลกรัม', cat: 'RAW_PORK' },
    { name: 'ปลานิล (แม่)', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'หอยเชลล์', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'กุ้งขาว อบเกลือ', unit: 'กิโลกรัม', cat: 'RAW_SEA' },
    { name: 'ปอเปี๊ยะ', unit: 'กิโลกรัม', cat: 'DRY_GOODS' },
]

async function main() {
    // 1. Load DB products
    const dbProducts = await p.product.findMany({
        include: { category: { select: { code: true, name: true } } }
    })
    const dbMap = new Map(dbProducts.map(x => [x.name.toLowerCase().trim(), x]))

    // 2. Load categories in DB
    const cats = await p.category.findMany({ select: { code: true, name: true } })
    const catCodes = new Set(cats.map(c => c.code))

    const scriptNames = new Set(IMPORT_ITEMS.map(x => x.name.toLowerCase().trim()))

    console.log('\n╔══════════════════════════════════════════════════════╗')
    console.log('║          Product Audit — DB vs import-stock.js       ║')
    console.log('╚══════════════════════════════════════════════════════╝')
    console.log(`\n📊 DB products: ${dbProducts.length}`)
    console.log(`📋 Script items: ${IMPORT_ITEMS.length}`)

    // ── Section 1: Script items → check if in DB ──
    let matched = 0, notInDb = 0, catMissing = 0
    console.log('\n── ✅ จะ SKIP (มีใน DB อยู่แล้ว) ──────────────────────')
    for (const item of IMPORT_ITEMS) {
        const key = item.name.toLowerCase().trim()
        if (dbMap.has(key)) {
            const db = dbMap.get(key)
            const unitMatch = db.unit === item.unit ? '✓unit' : `⚠️unit:DB=${db.unit}→script=${item.unit}`
            const catMatch = db.category.code === item.cat ? '✓cat' : `⚠️cat:DB=${db.category.code}→script=${item.cat}`
            console.log(`  = ${item.name} [${unitMatch}] [${catMatch}]`)
            matched++
        }
    }
    console.log(`\n  รวม match: ${matched}/${IMPORT_ITEMS.length}`)

    // ── Section 2: Script items NOT in DB ──
    console.log('\n── 🆕 จะถูก CREATE (ไม่มีใน DB) ──────────────────────')
    for (const item of IMPORT_ITEMS) {
        const key = item.name.toLowerCase().trim()
        if (!dbMap.has(key)) {
            const catOk = catCodes.has(item.cat) ? '✓' : `❌ cat '${item.cat}' ไม่มีใน DB!`
            console.log(`  + ${item.name} [${item.unit}] [${item.cat} ${catOk}]`)
            if (!catCodes.has(item.cat)) catMissing++
            notInDb++
        }
    }
    console.log(`\n  จะเพิ่มใหม่: ${notInDb} รายการ | category หาย: ${catMissing}`)

    // ── Section 3: DB items NOT in script ──
    console.log('\n── ⚠️ มีใน DB แต่ไม่อยู่ใน script (จะยังอยู่ถ้าไม่ล้าง) ─')
    let onlyInDb = 0
    for (const db of dbProducts) {
        const key = db.name.toLowerCase().trim()
        if (!scriptNames.has(key)) {
            console.log(`  ~ ${db.sku} | ${db.name} [${db.category.code}] [${db.unit}]`)
            onlyInDb++
        }
    }
    console.log(`\n  ใน DB only: ${onlyInDb} รายการ`)

    // ── Section 4: Category coverage check ──
    console.log('\n── 🏷️ Categories ที่ script ต้องการ ──────────────────')
    const neededCats = [...new Set(IMPORT_ITEMS.map(x => x.cat))]
    for (const code of neededCats) {
        const exists = catCodes.has(code)
        console.log(`  ${exists ? '✅' : '❌'} ${code}`)
    }

    // ── Summary ──
    console.log('\n╔══════════════════════════════════════════════════════╗')
    console.log(`║  MATCH: ${matched}/${IMPORT_ITEMS.length} | NEW: ${notInDb} | DB-ONLY: ${onlyInDb} | CAT-ERR: ${catMissing}`)
    console.log('╚══════════════════════════════════════════════════════╝')
    console.log('\n💡 ถ้าจะล้างแล้ว reimport — รัน: node scripts/clear-products.js')
    console.log('   แล้วตามด้วย:                  node prisma/import-stock.js\n')
}

main().catch(console.error).finally(() => p.$disconnect())
