import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok } from '@/lib/api'

/** GET /api/products/search?q=&limit=8
 *  Auth-protected — results scoped strictly to calling tenant
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const limit = parseInt(searchParams.get('limit') || '8')

    if (!q || q.length < 1) {
        return ok({ products: [] })
    }

    const products = await prisma.product.findMany({
        where: {
            tenantId,
            isActive: true,
            OR: [
                { name: { contains: q } },
                { sku: { contains: q } },
                { nameTh: { contains: q } },
            ]
        },
        select: { sku: true, name: true, unit: true },
        take: limit,
        orderBy: { name: 'asc' },
    })

    return ok({ products })
})
