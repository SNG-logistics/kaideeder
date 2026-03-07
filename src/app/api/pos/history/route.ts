import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/pos/history — closed orders (CLOSED/CANCELLED) sorted by closedAt desc
// Note: OrderStatus enum = OPEN | CLOSED | CANCELLED | VOID
export const GET = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''

    try {
        const orders = await prisma.order.findMany({
            where: {
                tenantId,
                status: { in: ['CLOSED', 'CANCELLED'] },
                ...(search ? {
                    OR: [
                        { orderNumber: { contains: search } },
                        { table: { name: { contains: search } } },
                    ]
                } : {}),
            },
            orderBy: { openedAt: 'desc' },
            take: limit,
            include: {
                table: { select: { id: true, name: true, zone: true } },
                items: {
                    where: { isCancelled: false },
                    include: {
                        product: { select: { id: true, name: true, sku: true } },
                    },
                    orderBy: { id: 'asc' },
                },
                payments: {
                    select: {
                        id: true, method: true, amount: true,
                        receivedAmount: true, changeAmount: true,
                    }
                },
                createdBy: { select: { name: true } },
            },
        })

        return ok(orders)
    } catch (e: any) {
        console.error('[history API error]', e)
        return err(e.message || 'Failed to load history', 500)
    }
})
