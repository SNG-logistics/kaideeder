/**
 * clear-products.js — ลบ Products ทั้งหมดออกจาก DB อย่างปลอดภัย
 * รัน: node scripts/clear-products.js
 *
 * ลำดับการลบตาม FK constraint (ลูกก่อน พ่อทีหลัง)
 * ⚠️  Recipes ยังอยู่ (ชื่อ) แต่ BOM จะถูกเคลียร์
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient({ log: [] })

async function main() {
    console.log('\n🗑️  เริ่มล้างข้อมูลสินค้า...\n')

    // 1. Recipe BOM (FK → Product)
    const bom = await p.recipeBOM.deleteMany({})
    console.log(`  ✅ ลบ RecipeBOM:          ${bom.count} รายการ`)

    // 2. Inventory (FK → Product)
    const inv = await p.inventory.deleteMany({})
    console.log(`  ✅ ลบ Inventory:           ${inv.count} รายการ`)

    // 3. PurchaseItems (FK → Product + PurchaseOrder)
    const pi = await p.purchaseItem.deleteMany({})
    console.log(`  ✅ ลบ PurchaseItems:       ${pi.count} รายการ`)

    // 4. PurchaseOrders (now safe — no more PurchaseItems)
    const po = await p.purchaseOrder.deleteMany({})
    console.log(`  ✅ ลบ PurchaseOrders:      ${po.count} รายการ`)

    // 5. TransferItems (FK → Product + StockTransfer)
    const ti = await p.transferItem.deleteMany({})
    console.log(`  ✅ ลบ TransferItems:       ${ti.count} รายการ`)

    // 6. StockTransfers (now safe)
    const st = await p.stockTransfer.deleteMany({})
    console.log(`  ✅ ลบ StockTransfers:      ${st.count} รายการ`)

    // 7. AdjustmentItems (FK → Product via adjustmentId)
    const ai = await p.adjustmentItem.deleteMany({})
    console.log(`  ✅ ลบ AdjustmentItems:     ${ai.count} รายการ`)

    // 8. StockAdjustments (now safe)
    const adj = await p.stockAdjustment.deleteMany({})
    console.log(`  ✅ ลบ StockAdjustments:    ${adj.count} รายการ`)

    // 9. Products — ล้างได้แล้ว
    const prod = await p.product.deleteMany({})
    console.log(`  ✅ ลบ Products:            ${prod.count} รายการ`)

    console.log('\n✨ เสร็จแล้ว! ตอนนี้ Products ว่างเปล่า')
    console.log('   📌 Recipes (ชื่อเมนู) ยังอยู่ แต่ BOM ถูกลบแล้ว')
    console.log('\n▶  ขั้นต่อไป — reimport:')
    console.log('   node prisma/import-stock.js      (71 วัตถุดิบ hardcoded)')
    console.log('   หรือ npx tsx scripts/import-stock-pack.ts  (Excel file)\n')
}

main().catch(console.error).finally(() => p.$disconnect())
