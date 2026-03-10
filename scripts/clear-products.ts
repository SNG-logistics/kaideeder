/**
 * scripts/clear-products.ts
 * ล้าง products ทั้งหมดของ tenant หนึ่งก่อน import ใหม่
 *
 * รัน: npx tsx scripts/clear-products.ts [tenant-code]
 * ค่า default: store-001
 *
 * ⚠️  จะลบ: products + inventory + product aliases + sku suggestions
 * ✅  คงไว้:  categories, locations, users, orders, purchase orders
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const tenantCode = process.argv[2]

    // ถ้าไม่ระบุ หรือไม่พบ → แสดง list ทั้งหมด
    if (!tenantCode) {
        const all = await prisma.tenant.findMany({ select: { code: true, name: true } })
        console.log('\n📋 Tenants ที่มีอยู่:')
        all.forEach(t => console.log(`   ${t.code}  (${t.name})`))
        console.log('\nรัน: npx tsx scripts/clear-products.ts <code> --force')
        return
    }

    const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode } })
    if (!tenant) {
        const all = await prisma.tenant.findMany({ select: { code: true, name: true } })
        console.error(`\n❌ ไม่พบ tenant: "${tenantCode}"`)
        console.log('\n📋 Tenants ที่มีอยู่:')
        all.forEach(t => console.log(`   ${t.code}  (${t.name})`))
        process.exit(1)
    }


    const tenantId = tenant.id
    console.log(`\n🏪 Tenant: ${tenant.name} (${tenant.code})`)
    console.log(`   ID: ${tenantId}`)

    // นับก่อนลบ
    const counts = {
        products:      await prisma.product.count({ where: { tenantId } }),
        inventory:     await prisma.inventory.count({ where: { tenantId } }),
        aliases:       await prisma.productAlias.count({ where: { tenantId } }),
        suggestions:   await prisma.skuSuggestion.count({ where: { tenantId } }),
        recipeBOMs:    await prisma.recipeBOM.count({ where: { tenantId } }),
        stockMovements: await prisma.stockMovement.count({ where: { tenantId } }),
    }

    console.log('\n📊 รายการที่จะลบ:')
    Object.entries(counts).forEach(([k, v]) => console.log(`   ${k}: ${v}`))

    if (counts.products === 0) {
        console.log('\n✅ ไม่มี product ให้ลบ — ระบบพร้อมสำหรับ import ใหม่')
        return
    }

    const force = process.argv.includes('--force')
    if (!force) {
        console.log('\n⚠️  ใช้ flag --force เพื่อยืนยันการลบ:')
        console.log(`   npx tsx scripts/clear-products.ts ${tenantCode} --force`)
        return
    }


    console.log('\n🗑️  กำลังลบ...')

    // ต้องลบตาม FK order
    const d1 = await prisma.stockMovement.deleteMany({ where: { tenantId } })
    console.log(`   ✅ stockMovements: ${d1.count}`)

    const d2 = await prisma.recipeBOM.deleteMany({ where: { tenantId } })
    console.log(`   ✅ recipeBOMs: ${d2.count}`)

    const d3 = await prisma.inventory.deleteMany({ where: { tenantId } })
    console.log(`   ✅ inventory: ${d3.count}`)

    const d4 = await prisma.productAlias.deleteMany({ where: { tenantId } })
    console.log(`   ✅ productAliases: ${d4.count}`)

    const d5 = await prisma.skuSuggestion.deleteMany({ where: { tenantId } })
    console.log(`   ✅ skuSuggestions: ${d5.count}`)

    // ลบ orderItems, purchaseItems ที่อ้างถึง product (ถ้ามี)
    // ไม่ลบ orders/purchaseOrders — แค่ตัด productId link
    try {
        await prisma.$executeRaw`
            UPDATE order_items SET productId = NULL WHERE tenantId = ${tenantId}
        `
        console.log('   ✅ order_items: unlinked productId')
    } catch { /* ignore if column not nullable */ }

    try {
        await prisma.$executeRaw`
            UPDATE purchase_items SET productId = NULL WHERE tenantId = ${tenantId}
        `
        console.log('   ✅ purchase_items: unlinked productId')
    } catch { /* ignore if column not nullable */ }

    const d6 = await prisma.product.deleteMany({ where: { tenantId } })
    console.log(`   ✅ products: ${d6.count}`)

    console.log('\n🎉 เสร็จสิ้น! พร้อมสำหรับ import ไฟล์ใหม่')
    console.log('   → ไปที่ http://localhost:3000/products แล้วกด 📂 Import Excel')
}

main()
    .catch(e => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
