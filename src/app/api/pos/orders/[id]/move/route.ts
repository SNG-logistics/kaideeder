import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const moveSchema = z.object({ targetTableId: z.string().min(1) })

// PATCH /api/pos/orders/[id]/move — move order to another table
export const PATCH = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const id = params?.id
    if (!id) return err('Missing order id')

    try {
        const body = await req.json()
        const { targetTableId } = moveSchema.parse(body)

        const order = await prisma.order.findFirst({ where: { id, tenantId } })
        if (!order) return err('ไม่พบออเดอร์', 404)
        if (order.status !== 'OPEN') return err('ออเดอร์ปิดแล้ว')

        // Ensure target table belongs to the same tenant and has no open order
        const targetTable = await prisma.diningTable.findFirst({ where: { id: targetTableId, tenantId } })
        if (!targetTable) return err('ไม่พบโต๊ะปลายทาง', 404)
        const existing = await prisma.order.findFirst({
            where: { tableId: targetTableId, tenantId, status: 'OPEN' },
        })
        if (existing) return err('โต๊ะปลายทางมีออเดอร์อยู่แล้ว')

        const oldTableId = order.tableId

        // Move order to new table
        const updated = await prisma.order.update({
            where: { id },
            data: { tableId: targetTableId },
            include: { table: true, items: { include: { product: true } } },
        })

        // Update table statuses
        await prisma.diningTable.update({ where: { id: targetTableId }, data: { status: 'OCCUPIED' } })
        // Free the original table only if no other open orders
        const stillOpen = await prisma.order.findFirst({ where: { tableId: oldTableId ?? undefined, status: 'OPEN' } })
        if (!stillOpen && oldTableId) {
            await prisma.diningTable.update({ where: { id: oldTableId }, data: { status: 'AVAILABLE' } })
        }

        return ok(updated)
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('Move order error:', error)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])
