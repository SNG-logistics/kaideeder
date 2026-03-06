import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok } from '@/lib/api'

// GET /api/movements — Stock movement history
export const GET = withAuth<any>(async (req: NextRequest, context: any) => {
    const { tenantId } = context
    const url = new URL(req.url)
    const productId = url.searchParams.get('productId')
    const type = url.searchParams.get('type')
    const limit = parseInt(url.searchParams.get('limit') || '100')

    const where: Record<string, unknown> = { tenantId }
    if (productId) where.productId = productId
    if (type) where.type = type

    const movements = await prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            product: { select: { name: true, sku: true, unit: true } },
            fromLocation: { select: { name: true, code: true } },
            toLocation: { select: { name: true, code: true } },
            createdBy: { select: { name: true } },
        },
    })
    return ok(movements)
})
