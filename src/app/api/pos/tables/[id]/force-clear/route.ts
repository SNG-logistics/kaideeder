import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// POST /api/pos/tables/[id]/force-clear
// Force-release a stuck OCCUPIED table back to AVAILABLE
// (when there's no active order but table is stuck)
export const POST = withAuth(async (_req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const id = params?.id as string
    if (!id) return err('Missing table id', 400)

    const table = await prisma.diningTable.findFirst({
        where: { id, tenantId },
        include: {
            orders: {
                where: { status: 'OPEN' },
                select: { id: true, orderNumber: true },
            },
        },
    })

    if (!table) return err('ไม่พบโต๊ะ', 404)

    // ถ้ามี order OPEN อยู่ → ไม่ยอม force clear
    if (table.orders.length > 0) {
        return err(
            `โต๊ะนี้มีออเดอร์ที่ยังเปิดอยู่ (${table.orders[0].orderNumber}) — กรุณาปิดบิลก่อน`,
            409,
        )
    }

    // Force release
    const updated = await prisma.diningTable.update({
        where: { id },
        data: { status: 'AVAILABLE' },
    })

    return ok({ cleared: true, tableId: id, tableName: updated.name })
}, ['OWNER', 'MANAGER', 'CASHIER'])
