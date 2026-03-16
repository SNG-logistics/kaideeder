import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/menu/[tenantCode]
// Returns active products grouped by category for a tenant
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

        const categories = await prisma.category.findMany({
            where: { tenantId: tenant.id, isActive: true },
            orderBy: { name: 'asc' },
        })

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
        // Map salePrice → price so the mobile menu page needs no changes
        const products = rawProducts.map(p => ({ ...p, price: p.salePrice }))

        return NextResponse.json({ tenant, categories, products })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
