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

// DELETE /api/pos/bill-requests?orderId=xxx
// OWNER/MANAGER only — cancels a bill request by removing the marker from order note
export const DELETE = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')
    if (!orderId) return err('orderId is required', 400)

    try {
        const order = await prisma.order.findFirst({
            where: { id: orderId, tenantId, note: { contains: 'เรียกเช็คบิล' } },
        })
        if (!order) return err('Bill request not found', 404)

        // Strip the bill-request marker — keep any other note text intact
        const cleanedNote = (order.note ?? '')
            .split('\n')
            .filter(line => !line.includes('เรียกเช็คบิล'))
            .join('\n')
            .trim() || null

        await prisma.order.update({
            where: { id: orderId },
            data: { note: cleanedNote },
        })
        return ok({ message: 'Bill request cancelled' })
    } catch (e: any) {
        return err(e.message)
    }
}, ['OWNER', 'MANAGER'])

