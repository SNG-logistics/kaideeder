/**
 * reset-for-test.js
 * ========================
 * ล้างข้อมูล Transaction ทั้งหมด เตรียมเทส "ระบบนับสต็อก"
 * รัน: node reset-for-test.js
 *
 * ⚠️  จะล้าง: Inventory, StockMovement, Order, OrderItem, Payment,
 *             SalesImport, SalesImportItem, StockTransfer, StockAdjustment,
 *             PurchaseOrder, PurchaseOrderItem
 * ✅  เก็บ: Products, Locations, Users, DiningTables, Categories,
 *           Recipes, DiningTableStatus reset → AVAILABLE
 */

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function reset() {
    console.log('\n╔══════════════════════════════════════════╗')
    console.log('║   🗑️  Reset DB สำหรับ Test ระบบนับสต็อก  ║')
    console.log('╚══════════════════════════════════════════╝\n')

    // ── 1. ล้าง Transaction data (order of deletion = FK dependency) ──
    console.log('🧹 กำลังล้างข้อมูล...')

    const del = async (label, fn) => {
        const r = await fn()
        console.log(`  ✅ ล้าง ${label}: ${r.count ?? JSON.stringify(r)} รายการ`)
    }

    await del('Payment', () => p.payment.deleteMany())
    await del('OrderItem', () => p.orderItem.deleteMany())
    await del('Order', () => p.order.deleteMany())
    await del('SalesImportItem', () => p.salesImportItem.deleteMany())
    await del('SalesImport', () => p.salesImport.deleteMany())
    await del('StockMovement', () => p.stockMovement.deleteMany())
    await del('StockTransferItem', () => p.stockTransferItem.deleteMany())
    await del('StockTransfer', () => p.stockTransfer.deleteMany())
    await del('PurchaseOrderItem', () => p.purchaseOrderItem.deleteMany())
    await del('PurchaseOrder', () => p.purchaseOrder.deleteMany())
    await del('StockAdjustmentItem', () => p.stockAdjustmentItem.deleteMany().catch(() => ({ count: 0 })))
    await del('StockAdjustment', () => p.stockAdjustment.deleteMany().catch(() => ({ count: 0 })))
    await del('Inventory', () => p.inventory.deleteMany())

    // ── 2. Reset DiningTable status ──
    await p.diningTable.updateMany({ data: { status: 'AVAILABLE' } })
    console.log('  ✅ Reset โต๊ะทั้งหมด → AVAILABLE')

    // ── 3. Seed Inventory เริ่มต้น (สำหรับเทส) ──
    console.log('\n📦 Seed Inventory เริ่มต้น (ข้อมูลเทส)...')

    const locations = await p.location.findMany({ select: { id: true, code: true } })
    const loc = Object.fromEntries(locations.map(l => [l.code, l.id]))

    const products = await p.product.findMany({ select: { id: true, sku: true, costPrice: true } })
    const prod = Object.fromEntries(products.map(p => [p.sku, p]))

    // ─── คลังเครื่องดื่ม 1 — เบียร์/เครื่องดื่ม ───────────────────
    const drinkStock = [
        { sku: 'B001', qty: 120, cost: 18000 },  // Beer Lao ขวดใหญ่
        { sku: 'B002', qty: 240, cost: 12000 },  // Beer Lao กระป๋อง
        { sku: 'B003', qty: 48, cost: 28000 },  // Heineken ขวดใหญ่
        { sku: 'B004', qty: 48, cost: 22000 },  // Carlsberg ขวดใหญ่
        { sku: 'B005', qty: 24, cost: 22000 },  // Tiger ขวดใหญ่
        { sku: 'D001', qty: 24, cost: 8000 },  // Pepsi ขวดพลาสติก
        { sku: 'D002', qty: 48, cost: 7000 },  // Pepsi กระป๋อง
        { sku: 'D003', qty: 48, cost: 7000 },  // Coca-Cola กระป๋อง
        { sku: 'D004', qty: 48, cost: 7000 },  // Sprite กระป๋อง
        { sku: 'D005', qty: 60, cost: 5000 },  // โซดา
        { sku: 'WI01', qty: 60, cost: 3000 },  // น้ำดื่มขวดเล็ก
        { sku: 'WI02', qty: 48, cost: 3000 },  // น้ำดื่มขวดกลาง
        { sku: 'WI03', qty: 24, cost: 5000 },  // น้ำดื่มขวดใหญ่
        { sku: 'WI04', qty: 20, cost: 5000 },  // น้ำแข็งถังเล็ก
        { sku: 'WI05', qty: 10, cost: 8000 },  // น้ำแข็งถังใหญ่
        { sku: 'W001', qty: 3, cost: 700000 },  // JW Black
        { sku: 'W002', qty: 3, cost: 380000 },  // JW Red  
        { sku: 'W003', qty: 2, cost: 550000 },  // Penfolds
        { sku: 'KR01', qty: 24, cost: 28000 },  // Heineken คาราโอเกะ
    ]

    let invCount = 0
    for (const item of drinkStock) {
        const product = prod[item.sku]
        if (!product || !loc['WH_DRINKbar1']) continue
        await p.inventory.upsert({
            where: { productId_locationId: { productId: product.id, locationId: loc['WH_DRINKbar1'] } },
            update: { quantity: item.qty, avgCost: item.cost },
            create: { productId: product.id, locationId: loc['WH_DRINKbar1'], quantity: item.qty, avgCost: item.cost }
        })
        // อัพเดต product.costPrice
        await p.product.update({ where: { id: product.id }, data: { costPrice: item.cost } })
        invCount++
    }

    // ─── คลังของสด — วัตถุดิบ ─────────────────────────────────────
    const freshStock = [
        { sku: 'RM01', qty: 15.5, cost: 45000 },  // ไก่ทั้งตัว (กก.)
        { sku: 'RM02', qty: 8.0, cost: 150000 },  // เนื้อวัว (กก.)
        { sku: 'RP01', qty: 10.0, cost: 80000 },  // หมูสามชั้น (กก.)
        { sku: 'RS01', qty: 5.0, cost: 120000 },  // กุ้งสด (กก.)
        { sku: 'RS02', qty: 4.0, cost: 100000 },  // ปลาหมึก (กก.)
        { sku: 'RV01', qty: 8.0, cost: 15000 },  // มันฝรั่ง (กก.)
        { sku: 'RV02', qty: 5.0, cost: 12000 },  // หัวหอม (กก.)
        { sku: 'RV03', qty: 3.0, cost: 25000 },  // กระเทียม (กก.)
    ]

    for (const item of freshStock) {
        const product = prod[item.sku]
        if (!product || !loc['WH_FRESH']) continue
        await p.inventory.upsert({
            where: { productId_locationId: { productId: product.id, locationId: loc['WH_FRESH'] } },
            update: { quantity: item.qty, avgCost: item.cost },
            create: { productId: product.id, locationId: loc['WH_FRESH'], quantity: item.qty, avgCost: item.cost }
        })
        await p.product.update({ where: { id: product.id }, data: { costPrice: item.cost } })
        invCount++
    }

    // ─── คลังใหญ่ — เครื่องปรุง/ของแห้ง ──────────────────────────
    const mainStock = [
        { sku: 'DG01', qty: 50, cost: 18000 },  // ข้าวสาร (กก.)
        { sku: 'DG02', qty: 30, cost: 25000 },  // ข้าวเหนียว (กก.)
        { sku: 'DG03', qty: 10, cost: 35000 },  // น้ำมันพืช (ลิตร)
        { sku: 'DG04', qty: 6, cost: 20000 },  // ซีอิ๊วขาว (ขวด)
    ]

    for (const item of mainStock) {
        const product = prod[item.sku]
        if (!product || !loc['WH_MAIN']) continue
        await p.inventory.upsert({
            where: { productId_locationId: { productId: product.id, locationId: loc['WH_MAIN'] } },
            update: { quantity: item.qty, avgCost: item.cost },
            create: { productId: product.id, locationId: loc['WH_MAIN'], quantity: item.qty, avgCost: item.cost }
        })
        await p.product.update({ where: { id: product.id }, data: { costPrice: item.cost } })
        invCount++
    }

    console.log(`  ✅ Seed Inventory: ${invCount} รายการ ใน 3 คลัง`)

    // ── สรุป ──
    const totalInv = await p.inventory.count()
    const totalProducts = await p.product.count()
    const totalLocations = await p.location.count()
    const totalTables = await p.diningTable.count()

    console.log('\n╔══════════════════════════════════╗')
    console.log('║   ✅ Reset เสร็จสมบูรณ์!           ║')
    console.log('╚══════════════════════════════════╝')
    console.log(`  Products:  ${totalProducts}`)
    console.log(`  Locations: ${totalLocations}`)
    console.log(`  Tables:    ${totalTables} (ทั้งหมด AVAILABLE)`)
    console.log(`  Inventory: ${totalInv} รายการ (สด ใหม่)`)
    console.log(`\n  🎯 พร้อมเทสระบบนับสต็อกแล้ว!\n`)

    await p.$disconnect()
}

reset().catch(async (e) => {
    console.error('❌ Error:', e.message)
    await p.$disconnect()
    process.exit(1)
})
