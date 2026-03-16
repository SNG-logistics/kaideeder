import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/menu/[tenantCode]
// Returns sale products (SALE_ITEM/ENTERTAIN, salePrice>0) grouped by non-stock categories.
// Categories with no matching products are excluded from the response.
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ tenantCode: string }> }
) {
    const { tenantCode } = await params

    try {
        const tenant = await prisma.tenant.findFirst({
            where: { code: tenantCode, status: 'ACTIVE' },
            select: { id: true, code: true, name: true, displayName: true, logoUrl: true, currency: true },
        })
        if (!tenant) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

        // Only SALE products with a price
        const rawProducts = await prisma.product.findMany({
            where: {
                tenantId: tenant.id,
                isActive: true,
                salePrice: { gt: 0 },
                productType: { in: ['SALE_ITEM', 'ENTERTAIN'] },
            },
            orderBy: { name: 'asc' },
            select: {
                id: true, name: true, sku: true,
                salePrice: true, unit: true, categoryId: true,
                imageUrl: true,
            },
        })
        // Map salePrice → price (mobile page uses .price)
        const products = rawProducts.map(p => ({ ...p, price: p.salePrice }))

        // Build set of categoryIds that have at least 1 eligible product
        const activeCatIds = new Set(products.map(p => p.categoryId))

        // Only categories that actually have at least 1 eligible sale product
        const categories = await prisma.category.findMany({
            where: {
                tenantId: tenant.id,
                isActive: true,
                id: { in: [...activeCatIds] },
            },
            orderBy: { name: 'asc' },
        })

        return NextResponse.json({ tenant, categories, products })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
