import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok } from '@/lib/api'

// GET /api/inventory — สต็อคทุกคลัง
export const GET = withAuth<any>(async (req: NextRequest, context: any) => {
    const url = new URL(req.url)
    const locationId = url.searchParams.get('locationId')
    const categoryId = url.searchParams.get('categoryId')
    const search = url.searchParams.get('search') || ''
    const lowOnly = url.searchParams.get('lowOnly') === 'true'

    const { tenantId } = context
    const where: Record<string, unknown> = { tenantId }
    if (locationId) where.locationId = locationId
    if (search) {
        where.product = {
            OR: [
                { name: { contains: search } },
                { sku: { contains: search } },
            ],
            isActive: true,
            ...(categoryId ? { categoryId } : {}),
        }
    } else {
        where.product = { isActive: true, ...(categoryId ? { categoryId } : {}) }
    }

    const inventory = await prisma.inventory.findMany({
        where,
        include: {
            product: { include: { category: true } },
            location: true,
        },
        orderBy: { product: { name: 'asc' } },
    })

    // Filter low stock if requested
    const result = lowOnly
        ? inventory.filter(inv => inv.quantity <= inv.product.minQty && inv.product.minQty > 0)
        : inventory

    // Summary per location
    const summary = inventory.reduce((acc, inv) => {
        const code = inv.location.code
        if (!acc[code]) acc[code] = { name: inv.location.name, items: 0, totalValue: 0 }
        acc[code].items++
        acc[code].totalValue += inv.quantity * inv.avgCost
        return acc
    }, {} as Record<string, { name: string; items: number; totalValue: number }>)

    return ok({ inventory: result, summary, total: result.length })
}, ['owner', 'manager', 'warehouse', 'kitchen', 'bar'])
