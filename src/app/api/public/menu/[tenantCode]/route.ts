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

        const products = await prisma.product.findMany({
            where: {
                tenantId: tenant.id,
                isActive: true,
                // only include products that have a price (menu items)
                price: { gt: 0 },
            },
            orderBy: { name: 'asc' },
            select: {
                id: true, name: true, nameEn: true, sku: true,
                price: true, unit: true, categoryId: true,
                imageUrl: true,
            },
        })

        return NextResponse.json({ tenant, categories, products })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
