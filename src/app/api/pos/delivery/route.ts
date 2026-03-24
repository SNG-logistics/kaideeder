import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/pos/delivery — delivery queue (active delivery orders)
export const GET = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status')  // optional filter

    try {
        const where: any = {
            tenantId,
            orderType: 'DELIVERY',
            status: { in: ['OPEN', 'PENDING_CONFIRM'] },
        }

        const orders = await prisma.order.findMany({
            where,
            include: {
                deliveryInfo: true,
                items: {
                    where: { isCancelled: false },
                    include: { product: { select: { name: true } } },
                },
                payments: true,
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { openedAt: 'desc' },
        })

        // Optionally filter by deliveryStatus
        const filtered = statusFilter
            ? orders.filter(o => o.deliveryInfo?.deliveryStatus === statusFilter)
            : orders

        return ok(filtered)
    } catch (e: any) {
        return err(e.message)
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])
