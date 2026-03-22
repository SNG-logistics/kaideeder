import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/pos/bill-requests
// Returns all OPEN/PENDING_CONFIRM orders where customer has requested bill
export const GET = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    try {
        const orders = await prisma.order.findMany({
            where: {
                tenantId,
                status: { in: ['OPEN', 'PENDING_CONFIRM'] },
                note: { contains: 'เรียกเช็คบิล' },
            },
            include: {
                table: { select: { id: true, number: true, name: true, zone: true } },
                items: {
                    where: { isCancelled: false },
                    include: { product: { select: { name: true } } },
                },
            },
            orderBy: { openedAt: 'asc' },
        })
        return ok(orders)
    } catch (e: any) {
        return err(e.message)
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])
