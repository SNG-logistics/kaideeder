/**
 * Seed Recipe/BOM for 7 rice dishes
 * Run: npx ts-node --project tsconfig.json scripts/seed-rice-bom.ts
 *
 * What this does:
 *   1. Finds each menu product by name (partial match)
 *   2. Finds or creates a Location (KIT_STOCK or WH_MAIN)
 *   3. Finds ingredient products by name (partial match)
 *   4. Creates Recipe + RecipeBOM rows
 *
 * Adjust ingredient names/quantities as needed below.
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// ── CONFIG ──────────────────────────────────────────────────────────────────
// Change TENANT_CODE to your store's code
const TENANT_CODE = process.env.TENANT_CODE || 'demo'

// Menu → ingredients mapping
// ingredient: { name: partial match against product name, qty: per 1 serving, unit }
const RICE_MENUS: Array<{
    menuName: string          // partial match against product.name
    ingredients: Array<{ name: string; qty: number; unit: string }>
}> = [
    {
        menuName: 'ข้าวขาหมู',
        ingredients: [
            { name: 'ข้าว', qty: 0.2, unit: 'kg' },
            { name: 'ขาหมู', qty: 0.3, unit: 'kg' },
        ],
    },
    {
        menuName: 'ข้าวมันสามสหาย',
        ingredients: [
            { name: 'ข้าว', qty: 0.2, unit: 'kg' },
            { name: 'ไก่', qty: 0.15, unit: 'kg' },
            { name: 'หมูแดง', qty: 0.1, unit: 'kg' },
        ],
    },
    {
        menuName: 'ข้าวมันไก่',
        ingredients: [
            { name: 'ข้าว', qty: 0.2, unit: 'kg' },
            { name: 'ไก่', qty: 0.2, unit: 'kg' },
        ],
    },
    {
        menuName: 'ข้าวมันไก่ย่าง',
        ingredients: [
            { name: 'ข้าว', qty: 0.2, unit: 'kg' },
            { name: 'ไก่', qty: 0.2, unit: 'kg' },
        ],
    },
    {
        menuName: 'ข้าวหมูกรอบ',
        ingredients: [
            { name: 'ข้าว', qty: 0.2, unit: 'kg' },
            { name: 'หมูกรอบ', qty: 0.15, unit: 'kg' },
        ],
    },
    {
        menuName: 'ข้าวหมูแดง',
        ingredients: [
            { name: 'ข้าว', qty: 0.2, unit: 'kg' },
            { name: 'หมูแดง', qty: 0.15, unit: 'kg' },
        ],
    },
    {
        menuName: 'ข้าวไก่กรอบ',
        ingredients: [
            { name: 'ข้าว', qty: 0.2, unit: 'kg' },
            { name: 'ไก่กรอบ', qty: 0.15, unit: 'kg' },
        ],
    },
]

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    // 1. Find tenant
    const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } })
    if (!tenant) {
        console.error(`❌ Tenant "${TENANT_CODE}" not found. Set TENANT_CODE env var.`)
        console.log('Available tenants:')
        const all = await prisma.tenant.findMany({ select: { code: true, name: true } })
        all.forEach(t => console.log(`  ${t.code} — ${t.name}`))
        process.exit(1)
    }
    console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`)

    // 2. Find or get a location to use for BOM deduction
    const kitStock = await prisma.location.findFirst({
        where: { tenantId: tenant.id, code: 'KIT_STOCK', isActive: true },
    })
    const whMain = await prisma.location.findFirst({
        where: { tenantId: tenant.id, code: 'WH_MAIN', isActive: true },
    })
    const anyLocation = await prisma.location.findFirst({
        where: { tenantId: tenant.id, isActive: true },
    })

    const defaultLocation = kitStock || whMain || anyLocation
    if (!defaultLocation) {
        console.error('❌ No locations found — please create at least one Location first (Settings → Locations)')
        process.exit(1)
    }
    console.log(`📦 Default location: ${defaultLocation.name} (${defaultLocation.code})`)

    // 3. Load all products for the tenant
    const allProducts = await prisma.product.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, name: true, sku: true },
    })

    const findProduct = (namePart: string) =>
        allProducts.find(p => p.name.toLowerCase().includes(namePart.toLowerCase()))

    let created = 0
    let skipped = 0

    // 4. Process each menu
    for (const menu of RICE_MENUS) {
        const menuProduct = findProduct(menu.menuName)
        if (!menuProduct) {
            console.warn(`⚠️  Menu product not found: "${menu.menuName}" — skipping`)
            skipped++
            continue
        }

        // Check if Recipe already exists for this menu
        const existingRecipe = await prisma.recipe.findFirst({
            where: { tenantId: tenant.id, menuName: menu.menuName },
        })
        if (existingRecipe) {
            console.log(`⏭️  Recipe already exists: "${menu.menuName}" — skipping`)
            skipped++
            continue
        }

        // Create Recipe
        const recipe = await prisma.recipe.create({
            data: {
                tenantId: tenant.id,
                menuName: menu.menuName,
                isActive: true,
            },
        })

        let bomCreated = 0
        for (const ing of menu.ingredients) {
            const ingProduct = findProduct(ing.name)
            if (!ingProduct) {
                console.warn(`  ⚠️  Ingredient not found: "${ing.name}" — skipping this ingredient`)
                continue
            }

            await prisma.recipeBOM.create({
                data: {
                    tenantId: tenant.id,
                    recipeId: recipe.id,
                    menuId: menuProduct.id,
                    productId: ingProduct.id,
                    locationId: defaultLocation.id,
                    quantity: ing.qty,
                    unit: ing.unit,
                },
            })
            bomCreated++
            console.log(`    ✓ ${ing.name} × ${ing.qty} ${ing.unit} from ${defaultLocation.code}`)
        }

        console.log(`✅ "${menu.menuName}" → ${bomCreated} ingredients linked`)
        created++
    }

    console.log(`\n📋 Done: ${created} recipes created, ${skipped} skipped`)
    await prisma.$disconnect()
}

main().catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
})
