import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// DELETE /api/pos/orders/[id]/items/[itemId] — cancel an item
export const DELETE = withAuth(async (_req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const orderId = params?.id
    const itemId = params?.itemId
    if (!orderId || !itemId) return err('Missing ids')

    try {
        const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } })
        if (!order) return err('ไม่พบออเดอร์', 404)
        if (order.status !== 'OPEN') return err('ออเดอร์ปิดแล้ว ไม่สามารถยกเลิกรายการ')

        const item = await prisma.orderItem.findUnique({ where: { id: itemId } })
        if (!item || item.orderId !== orderId) return err('ไม่พบรายการ', 404)

        // Mark as cancelled
        await prisma.orderItem.update({
            where: { id: itemId },
            data: { isCancelled: true },
        })

        // Recalculate subtotal
        const activeItems = await prisma.orderItem.findMany({
            where: { orderId, isCancelled: false },
        })
        const subtotal = activeItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)

        let discountAmount = order.discount
        if (order.discountType === 'PERCENT') {
            discountAmount = subtotal * (order.discount / 100)
        }
        const totalAmount = subtotal - discountAmount + order.serviceCharge + order.vat

        await prisma.order.update({
            where: { id: orderId },
            data: { subtotal, totalAmount },
        })

        return ok({ message: 'ยกเลิกรายการแล้ว' })
    } catch (error) {
        console.error('Cancel item error:', error)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])
