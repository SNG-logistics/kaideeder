import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const tenants = await prisma.tenant.findMany({ select: { id: true, code: true, name: true } })
    console.log('\n=== TENANTS ===')
    tenants.forEach(t => console.log(`  ${t.code} | ${t.name} | ${t.id}`))

    for (const tenant of tenants) {
        console.log(`\n=== LOCATIONS [${tenant.code}] ===`)
        const locs = await prisma.location.findMany({ where: { tenantId: tenant.id }, select: { code: true, name: true, id: true } })
        locs.forEach(l => console.log(`  ${l.code} | ${l.name} | ${l.id}`))

        console.log(`\n=== PRODUCTS [${tenant.code}] (first 60) ===`)
        const prods = await prisma.product.findMany({
            where: { tenantId: tenant.id, isActive: true },
            select: { sku: true, name: true, id: true, productType: true },
            take: 60,
            orderBy: { name: 'asc' }
        })
        prods.forEach(p => console.log(`  ${p.productType.padEnd(10)} | ${p.sku.padEnd(16)} | ${p.name}`))

        console.log(`\n=== EXISTING RECIPES [${tenant.code}] ===`)
        const recipes = await prisma.recipe.findMany({
            where: { tenantId: tenant.id },
            include: { bom: { include: { product: { select: { name: true } } } } }
        })
        recipes.forEach(r => {
            console.log(`  📋 ${r.menuName}`)
            r.bom.forEach(b => console.log(`      → ${b.product.name} × ${b.quantity} ${b.unit}`))
        })
    }
    await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
