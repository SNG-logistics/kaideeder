const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient({ log: [] })
async function go() {
    const total = await p.product.count()
    const byType = await p.product.groupBy({ by: ['productType'], _count: { id: true } })
    const cats = await p.category.findMany({ select: { code: true, name: true }, orderBy: { code: 'asc' } })
    console.log('Total products:', total)
    byType.forEach(x => console.log(' -', x.productType, ':', x._count.id))
    console.log('Categories:', cats.map(x => x.code).join(', '))
}
go().catch(console.error).finally(() => p.$disconnect())
