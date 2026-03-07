import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// PATCH /api/kitchen/orders/[orderId]/serve-all — Mark all READY items as SERVED
export const PATCH = withAuth(async (_req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const orderId = params?.orderId
    if (!orderId) return err('Missing orderId')

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { orderItems: { where: { isCancelled: false } } },
    })
    if (!order) return err('ไม่พบออเดอร์', 404)
    if ((order as any).tenantId !== tenantId) return err('ไม่พบออเดอร์', 404)
    if (order.status !== 'OPEN') return err('ออเดอร์ปิดแล้ว')

    const readyItems = order.orderItems.filter(i => i.kitchenStatus === 'READY')
    if (readyItems.length === 0) return err('ไม่มีรายการที่พร้อมเสิร์ฟ')

    await prisma.orderItem.updateMany({
        where: {
            orderId,
            kitchenStatus: 'READY',
            isCancelled: false,
        },
        data: {
            kitchenStatus: 'SERVED',
            statusChangedAt: new Date(),
            statusChangedById: ctx.user?.userId || null,
        },
    })

    return ok({ served: readyItems.length })
}, ['OWNER', 'MANAGER', 'KITCHEN', 'BAR', 'CASHIER'])
