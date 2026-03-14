import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

type Ctx = { params: Promise<{ orderId: string }> }

// POST /api/pos/orders/[orderId]/confirm — cashier confirms a PENDING_CONFIRM order
// Sets status to OPEN so kitchen picks it up
export const POST = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId, user }: any = ctx
    const params = (ctx as any).params
    const orderId = params?.orderId

    if (!orderId) return err('Missing orderId')

    const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId, status: 'PENDING_CONFIRM' },
        include: { table: true, items: true },
    })
    if (!order) return err('Order not found or already confirmed')

    // Mark order as OPEN and ensure kitchen items are properly marked
    const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
            status: 'OPEN',
            openedAt: new Date(),
            createdById: user?.userId ?? null,
        },
        include: { table: true, items: { include: { product: true } } },
    })

    // Mark table as OCCUPIED
    if (order.tableId) {
        await prisma.diningTable.update({
            where: { id: order.tableId },
            data: { status: 'OCCUPIED' },
        })
    }

    return ok(updated)
}, ['OWNER', 'MANAGER', 'CASHIER'])
