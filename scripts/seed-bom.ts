/**
 * Universal Recipe/BOM Seed Script
 * ใช้ได้กับทุก tenant — กำหนดค่าที่ BOM_CONFIG ด้านล่าง
 *
 * วิธีใช้:
 *   1. แก้ TENANT_CODE ให้ตรงกับร้าน (เช่น 'koungkaitest', 'store-001')
 *   2. แก้ BOM_CONFIG ให้ตรงกับเมนูและวัตถุดิบของร้าน
 *   3. รัน: npx ts-node --project tsconfig.json scripts/seed-bom.ts
 *
 * ถ้าไม่รู้จำนวนวัตถุดิบที่ใช้ต่อจาน ให้ตั้ง qty=1, unit='จาน' ไปก่อน
 * แล้วแก้ทีหลังได้ใน Settings → Recipes
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// ═══════════════════════════════════════════════════════════════
// ► แก้ค่าตรงนี้ให้ตรงกับร้าน
// ═══════════════════════════════════════════════════════════════
const TENANT_CODE = process.env.TENANT_CODE || 'koungkaitest'

/**
 * BOM_CONFIG — กำหนดสูตรของแต่ละเมนู
 * menuName    : ชื่อเมนูที่ตรงกับใน Products (SALE_ITEM)
 * ingredients : วัตถุดิบ (ชื่อต้องตรงกับ Products ที่มีอยู่ในระบบ)
 *   name : ชื่อ product วัตถุดิบ (partial match — ไม่ต้องพิมพ์เต็ม)
 *   qty  : ปริมาณที่ใช้ต่อ 1 จาน
 *   unit : หน่วย (kg, g, ชิ้น, จาน, ฯลฯ)
 *   locationCode : code ของ location สต็อคที่จะตัด (ไม่ระบุ = ใช้ location แรกที่หาได้)
 */
const BOM_CONFIG: Array<{
    menuName: string
    ingredients: Array<{
        name: string
        qty: number
        unit: string
        locationCode?: string
    }>
}> = [
    // ── ตัวอย่าง: koungkaitest ──────────────────────────────────
    {
        menuName: 'ข้าวมันไก่',
        ingredients: [
            { name: 'ไก่ น่องติดสะโพก', qty: 0.25, unit: 'kg', locationCode: 'MAIN' },
            { name: 'มันหมูเจียว',       qty: 0.05, unit: 'kg', locationCode: 'MAIN' },
        ],
    },
    {
        menuName: 'ข้าวมันไก่สามสหาย',
        ingredients: [
            { name: 'ไก่ น่องติดสะโพก', qty: 0.10, unit: 'kg', locationCode: 'MAIN' },
            { name: 'ไก่ สะโพกล้วน',    qty: 0.10, unit: 'kg', locationCode: 'MAIN' },
            { name: 'ไก่ อก',            qty: 0.10, unit: 'kg', locationCode: 'MAIN' },
            { name: 'มันหมูเจียว',       qty: 0.05, unit: 'kg', locationCode: 'MAIN' },
        ],
    },
    {
        menuName: 'ข้าวไก่กรอบ',
        ingredients: [
            { name: 'ไก่ สะโพกล้วน', qty: 0.25, unit: 'kg', locationCode: 'MAIN' },
            { name: 'มันหมูเจียว',    qty: 0.03, unit: 'kg', locationCode: 'MAIN' },
        ],
    },
    // ── เพิ่มเมนูอื่นตรงนี้ ────────────────────────────────────
    // {
    //     menuName: 'ข้าวขาหมู',
    //     ingredients: [
    //         { name: 'ขาหมู', qty: 0.3, unit: 'kg', locationCode: 'KIT_STOCK' },
    //     ],
    // },
]
// ═══════════════════════════════════════════════════════════════

async function main() {
    // 1. หา tenant
    const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } })
    if (!tenant) {
        console.error(`❌ ไม่พบ Tenant "${TENANT_CODE}"`)
        const all = await prisma.tenant.findMany({ select: { code: true, name: true } })
        console.log('Tenants ที่มีในระบบ:', all.map(t => `${t.code} (${t.name})`).join(', '))
        process.exit(1)
    }
    console.log(`\n🏪 Tenant: ${tenant.name} [${tenant.id}]`)

    // 2. โหลด products ทั้งหมด
    const allProducts = await prisma.product.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, sku: true, name: true, productType: true },
    })

    // 3. โหลด locations
    const allLocations = await prisma.location.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, code: true, name: true },
    })
    const locationMap = Object.fromEntries(allLocations.map(l => [l.code, l]))
    const defaultLocation = allLocations[0]

    if (!defaultLocation) {
        console.error('❌ ไม่มี Location — กรุณาสร้าง Location ก่อน (Settings → Locations)')
        process.exit(1)
    }
    console.log(`📦 Locations: ${allLocations.map(l => l.code).join(', ')}`)

    // Helper: หา product จากชื่อบางส่วน
    const findByName = (namePart: string) =>
        allProducts.find(p => p.name.toLowerCase().includes(namePart.toLowerCase()))

    // Helper: หา product จากชื่อเต็ม (exact) ก่อน แล้ว fallback partial
    const findMenu = (name: string) =>
        allProducts.find(p => p.name === name) || findByName(name)

    let totalCreated = 0
    let totalSkipped = 0

    console.log('\n──────────────────────────────────────────')

    for (const config of BOM_CONFIG) {
        const menuProduct = findMenu(config.menuName)
        if (!menuProduct) {
            console.warn(`⚠️  ไม่พบเมนู "${config.menuName}" ในระบบ — ข้าม`)
            totalSkipped++
            continue
        }

        // ลบ Recipe เก่า (ถ้ามี) เพื่อ upsert ใหม่
        const existing = await prisma.recipe.findFirst({
            where: { tenantId: tenant.id, menuName: config.menuName },
        })
        if (existing) {
            await prisma.recipeBOM.deleteMany({ where: { recipeId: existing.id } })
            await prisma.recipe.delete({ where: { id: existing.id } })
            console.log(`🔄 อัพเดท: ${config.menuName}`)
        } else {
            console.log(`✨ สร้างใหม่: ${config.menuName}`)
        }

        // สร้าง Recipe
        const recipe = await prisma.recipe.create({
            data: { tenantId: tenant.id, menuName: config.menuName, isActive: true },
        })

        let bomCount = 0
        for (const ing of config.ingredients) {
            const ingProduct = findByName(ing.name)
            if (!ingProduct) {
                console.warn(`   ⚠️  ไม่พบวัตถุดิบ "${ing.name}" — ข้าม`)
                continue
            }

            const loc = ing.locationCode
                ? (locationMap[ing.locationCode] || defaultLocation)
                : defaultLocation

            await prisma.recipeBOM.create({
                data: {
                    tenantId:   tenant.id,
                    recipeId:   recipe.id,
                    menuId:     menuProduct.id,
                    productId:  ingProduct.id,
                    locationId: loc.id,
                    quantity:   ing.qty,
                    unit:       ing.unit,
                },
            })
            console.log(`   ✓ ${ingProduct.name} × ${ing.qty} ${ing.unit} [${loc.code}]`)
            bomCount++
        }

        console.log(`   → ${bomCount} วัตถุดิบ\n`)
        totalCreated++
    }

    console.log('──────────────────────────────────────────')
    console.log(`✅ เสร็จแล้ว: สร้าง/อัพเดท ${totalCreated} recipes, ข้าม ${totalSkipped}`)
    await prisma.$disconnect()
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })
