import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// PATCH /api/kitchen/items/[itemId]/served — Waiter/Cashier marks as served
export const PATCH = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params;
    const itemId = params?.itemId;
    if (!itemId) return err('Missing itemId')

    const item = await prisma.orderItem.findUnique({
        where: { id: itemId },
        include: { order: true },
    })

    if (!item) return err('ไม่พบรายการ', 404)
    if ((item.order as any).tenantId !== tenantId) return err('ไม่พบรายการ', 404)
    if (item.kitchenStatus !== 'READY') return err(`รายการยังไม่ READY (ตอนนี้: ${item.kitchenStatus})`)

    const updated = await prisma.orderItem.update({
        where: { id: itemId },
        data: {
            kitchenStatus: 'SERVED',
            statusChangedAt: new Date(),
            statusChangedById: ctx.user?.userId || null,
        },
        include: {
            product: { select: { name: true, sku: true } },
        },
    })

    return ok(updated)
}, ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN', 'BAR'])
