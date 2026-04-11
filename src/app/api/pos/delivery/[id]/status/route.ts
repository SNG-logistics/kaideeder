import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const schema = z.object({
    deliveryStatus: z.enum(['RECEIVED', 'PREPARING', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
    driverNote: z.string().optional(),
    riderId: z.string().optional(),
})

// Rider สามารถเปลี่ยนสถานะได้เฉพาะ transitions เหล่านี้
const RIDER_ALLOWED_TRANSITIONS: Record<string, string> = {
    ASSIGNED: 'OUT_FOR_DELIVERY',       // รับงาน → กำลังส่ง
    OUT_FOR_DELIVERY: 'DELIVERED',      // กำลังส่ง → ส่งแล้ว
}

// PATCH /api/pos/delivery/[id]/status — update delivery status
export const PATCH = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId, user } = ctx
    const params = await ctx.params
    const id = params?.id   // this is the DeliveryInfo id
    if (!id) return err('Missing id')

    try {
        const body = await req.json()
        const data = schema.parse(body)

        const info = await prisma.deliveryInfo.findFirst({
            where: { id, tenantId },
        })
        if (!info) return err('ไม่พบข้อมูล delivery', 404)

        // 🛵 Rider: จำกัดเฉพาะ transition ที่อนุญาต
        if (user?.role === 'RIDER') {
            const allowedNext = RIDER_ALLOWED_TRANSITIONS[info.deliveryStatus]
            if (!allowedNext || data.deliveryStatus !== allowedNext) {
                return err('Rider ไม่สามารถเปลี่ยนสถานะนี้ได้', 403)
            }
        }

        const updated = await prisma.deliveryInfo.update({
            where: { id },
            data: {
                deliveryStatus: data.deliveryStatus,
                ...(data.driverNote !== undefined && { driverNote: data.driverNote }),
                ...(data.riderId !== undefined && { riderId: data.riderId }),
                ...(data.deliveryStatus === 'DELIVERED' && { deliveredAt: new Date() }),
            },
            include: {
                order: {
                    include: {
                        items: { where: { isCancelled: false }, include: { product: true } },
                        payments: true,
                    },
                },
            },
        })

        return ok(updated)
    } catch (e: any) {
        if (e instanceof z.ZodError) return err(e.errors.map(x => x.message).join(', '))
        return err(e.message)
    }
}, ['OWNER', 'MANAGER', 'CASHIER', 'RIDER'])
