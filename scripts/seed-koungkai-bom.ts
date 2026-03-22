/**
 * Seed Recipe/BOM for koungkaitest — ข้าวมันไก่ร้าน
 * Run: npx ts-node --project tsconfig.json scripts/seed-koungkai-bom.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// ── IDs จาก DB จริง ──────────────────────────────────────────────────────
const TENANT_ID = 'cmmm1fqtr000splcwllatgrow'
const LOCATION_ID = 'cmmqfn3cb0005d0umccv6ldpd' // MAIN สต็อคหลัก

// Product IDs (SALE_ITEM menus)
const MENUS: Record<string, string> = {
    'ข้าวมันไก่':         'MF02 → ดึงจาก DB',
    'ข้าวมันไก่สามสหาย': 'MF002 → ดึงจาก DB',
    'ข้าวไก่กรอบ':        'FD02 → ดึงจาก DB',
}

// BOM config: menuSku → ingredients
const BOM_CONFIG: Array<{
    menuSku: string
    menuName: string
    ingredients: Array<{ ingName: string; qty: number; unit: string }>
}> = [
    {
        menuSku: 'MF02',
        menuName: 'ข้าวมันไก่',
        ingredients: [
            { ingName: 'ไก่ น่องติดสะโพก', qty: 0.25, unit: 'kg' },
            { ingName: 'มันหมูเจียว',       qty: 0.05, unit: 'kg' },
        ],
    },
    {
        menuSku: 'MF002',
        menuName: 'ข้าวมันไก่สามสหาย',
        ingredients: [
            { ingName: 'ไก่ น่องติดสะโพก', qty: 0.1, unit: 'kg' },
            { ingName: 'ไก่ สะโพกล้วน',    qty: 0.1, unit: 'kg' },
            { ingName: 'ไก่ อก',            qty: 0.1, unit: 'kg' },
            { ingName: 'มันหมูเจียว',       qty: 0.05, unit: 'kg' },
        ],
    },
    {
        menuSku: 'FD02',
        menuName: 'ข้าวไก่กรอบ',
        ingredients: [
            { ingName: 'ไก่ สะโพกล้วน', qty: 0.25, unit: 'kg' },
            { ingName: 'มันหมูเจียว',    qty: 0.03, unit: 'kg' },
        ],
    },
]

async function main() {
    const allProducts = await prisma.product.findMany({
        where: { tenantId: TENANT_ID },
        select: { id: true, sku: true, name: true },
    })

    const bySku  = Object.fromEntries(allProducts.map(p => [p.sku, p]))
    const byName = Object.fromEntries(allProducts.map(p => [p.name, p]))

    let created = 0

    for (const menu of BOM_CONFIG) {
        const menuProduct = bySku[menu.menuSku]
        if (!menuProduct) {
            console.warn(`⚠️  ไม่พบเมนู SKU=${menu.menuSku}`)
            continue
        }

        // ลบ Recipe เก่าถ้ามี
        const old = await prisma.recipe.findFirst({ where: { tenantId: TENANT_ID, menuName: menu.menuName } })
        if (old) {
            await prisma.recipeBOM.deleteMany({ where: { recipeId: old.id } })
            await prisma.recipe.delete({ where: { id: old.id } })
            console.log(`🗑️  ลบ Recipe เก่า: ${menu.menuName}`)
        }

        // สร้าง Recipe ใหม่
        const recipe = await prisma.recipe.create({
            data: { tenantId: TENANT_ID, menuName: menu.menuName, isActive: true },
        })

        let bomCount = 0
        for (const ing of menu.ingredients) {
            const ingProd = byName[ing.ingName]
            if (!ingProd) {
                console.warn(`  ⚠️  ไม่พบวัตถุดิบ: ${ing.ingName}`)
                continue
            }
            await prisma.recipeBOM.create({
                data: {
                    tenantId:  TENANT_ID,
                    recipeId:  recipe.id,
                    menuId:    menuProduct.id,
                    productId: ingProd.id,
                    locationId: LOCATION_ID,
                    quantity:   ing.qty,
                    unit:       ing.unit,
                },
            })
            console.log(`    ✓ ${ing.ingName} × ${ing.qty} ${ing.unit}`)
            bomCount++
        }

        console.log(`✅ "${menu.menuName}" → ${bomCount} วัตถุดิบ`)
        created++
    }

    console.log(`\n📋 เสร็จแล้ว: สร้าง ${created} recipes`)
    await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
