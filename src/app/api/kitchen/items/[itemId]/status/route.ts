import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const statusSchema = z.object({
    status: z.enum(['ACCEPTED', 'COOKING', 'READY', 'SERVED']),
})

// PATCH /api/kitchen/items/[itemId]/status — Kitchen updates item status
export const PATCH = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const itemId = params?.itemId
    if (!itemId) return err('Missing itemId')

    try {
        const body = await req.json()
        const { status } = statusSchema.parse(body)

        const item = await prisma.orderItem.findUnique({
            where: { id: itemId },
            include: { order: true },
        })

        if (!item) return err('ไม่พบรายการ', 404)
        if (item.isCancelled) return err('รายการนี้ถูกยกเลิกแล้ว')
        if ((item.order as any).tenantId !== tenantId) return err('ไม่พบรายการ', 404)
        if (item.order.status !== 'OPEN') return err('ออเดอร์ปิดแล้ว')


        // Validate status transition — BAR items have a shorter flow
        const isBar = item.stationId === 'BAR'
        const validTransitions: Record<string, string[]> = isBar
            ? {
                PENDING:  ['ACCEPTED'],
                ACCEPTED: ['SERVED'],         // BAR: รับงาน → เสิร์ฟทันที (ไม่ผ่านครัว)
            }
            : {
                PENDING:  ['ACCEPTED'],
                ACCEPTED: ['COOKING'],
                COOKING:  ['READY'],
                READY:    ['SERVED'],
            }

        const allowed = validTransitions[item.kitchenStatus] || []
        if (!allowed.includes(status)) {
            return err(`ไม่สามารถเปลี่ยนจาก ${item.kitchenStatus} เป็น ${status}`)
        }

        const updated = await prisma.orderItem.update({
            where: { id: itemId },
            data: {
                kitchenStatus: status,
                statusChangedAt: new Date(),
                statusChangedById: ctx.user?.userId || null,
            },
            include: {
                product: { select: { name: true, sku: true } },
                statusChangedBy: { select: { name: true } },
            },
        })

        return ok(updated)
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors[0].message)
        console.error('Kitchen status error:', error)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'KITCHEN', 'BAR'])
