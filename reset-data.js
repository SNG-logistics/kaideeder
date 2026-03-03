/**
 * reset-data.js
 * รีเซ็ทข้อมูล transaction ทั้งหมด (ยอดคงเหลือ, ยอดขาย, ประวัติซื้อ)
 * คงไว้: users, products, categories, locations, suppliers, recipes, dining_tables
 *
 * Usage: node reset-data.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({ log: ['warn', 'error'] })

async function main() {
    console.log('⚠️  กำลังรีเซ็ทข้อมูล transaction...\n')

    // ลบตามลำดับ FK dependency
    const steps = [
        // Sales & Orders
        { name: 'sales_events', fn: () => prisma.salesEvent.deleteMany() },
        { name: 'order_items', fn: () => prisma.orderItem.deleteMany() },
        { name: 'payments', fn: () => prisma.payment.deleteMany() },
        { name: 'orders', fn: () => prisma.order.deleteMany() },

        // Sales imports
        { name: 'sales_import_items', fn: () => prisma.salesImportItem.deleteMany() },
        { name: 'sales_imports', fn: () => prisma.salesImport.deleteMany() },

        // Stock adjustments
        { name: 'adjustment_items', fn: () => prisma.adjustmentItem.deleteMany() },
        { name: 'stock_adjustments', fn: () => prisma.stockAdjustment.deleteMany() },

        // Transfers
        { name: 'transfer_items', fn: () => prisma.transferItem.deleteMany() },
        { name: 'stock_transfers', fn: () => prisma.stockTransfer.deleteMany() },

        // Purchase
        { name: 'purchase_items', fn: () => prisma.purchaseItem.deleteMany() },
        { name: 'purchase_orders', fn: () => prisma.purchaseOrder.deleteMany() },

        // Stock movements & inventory
        { name: 'stock_movements', fn: () => prisma.stockMovement.deleteMany() },
        { name: 'inventory', fn: () => prisma.inventory.deleteMany() },

        // Reset dining table status
        { name: 'dining_tables (reset status)', fn: () => prisma.diningTable.updateMany({ data: { status: 'AVAILABLE' } }) },
    ]

    for (const step of steps) {
        try {
            const result = await step.fn()
            const count = 'count' in result ? result.count : '—'
            console.log(`  ✅ ${step.name.padEnd(30)} rows: ${count}`)
        } catch (e) {
            console.log(`  ⚠️  ${step.name.padEnd(30)} ข้ามไป (${e.message.split('\n')[0]})`)
        }
    }

    console.log('\n✅ รีเซ็ทเสร็จแล้ว!')
    console.log('   - ยอดคงเหลือสินค้า: 0 ทุกรายการ')
    console.log('   - ประวัติการซื้อ: ถูกลบ')
    console.log('   - ประวัติการขาย: ถูกลบ')
    console.log('   - สินค้า / Categories / Users: ยังคงอยู่')
}

main()
    .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
    .finally(() => prisma.$disconnect())
