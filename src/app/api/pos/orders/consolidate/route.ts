import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

/**
 * POST /api/pos/orders/consolidate
 * Body: { tableId: string }
 *
 * Merges ALL PENDING_CONFIRM orders for a table into the main OPEN order.
 * If there is no OPEN order, promotes the earliest PENDING_CONFIRM to OPEN.
 * Returns the single consolidated OPEN order.
 *
 * Why: QR customers may order in multiple rounds (each creates a separate order).
 * Before checkout, the cashier needs one unified order with all items and a
 * correct grand total.
 */
export const POST = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any

    let body: any
    try { body = await req.json() } catch { return err('Invalid JSON', 400) }

    const { tableId } = body
    if (!tableId) return err('tableId is required', 400)

    try {
        // Verify the table belongs to this tenant
        const table = await prisma.diningTable.findFirst({
            where: { id: tableId, tenantId, isActive: true },
        })
        if (!table) return err('Table not found', 404)

        // Load all active orders for this table, oldest first
        const allOrders = await prisma.order.findMany({
            where: {
                tenantId,
                tableId,
                status: { in: ['OPEN', 'PENDING_CONFIRM'] },
            },
            orderBy: { openedAt: 'asc' },
            include: {
                items: { where: { isCancelled: false } },
            },
        })

        if (allOrders.length === 0) return err('No active orders for this table', 404)

        // If already a single order, just return it
        if (allOrders.length === 1) {
            // If it's PENDING_CONFIRM, promote it to OPEN
            if (allOrders[0].status === 'PENDING_CONFIRM') {
                const promoted = await prisma.order.update({
                    where: { id: allOrders[0].id },
                    data: { status: 'OPEN' },
                    include: { items: { where: { isCancelled: false }, include: { product: true } } },
                })
                return ok(promoted)
            }
            const single = await prisma.order.findUnique({
                where: { id: allOrders[0].id },
                include: { items: { where: { isCancelled: false }, include: { product: true } } },
            })
            return ok(single)
        }

        // ── Multiple orders: merge all into the primary ────────────────
        // Primary = the OPEN order, or the first PENDING_CONFIRM if none OPEN
        const primaryOrder = allOrders.find(o => o.status === 'OPEN') ?? allOrders[0]
        const others = allOrders.filter(o => o.id !== primaryOrder.id)

        // Collect all items from secondary orders
        const itemsToMove = others.flatMap(o => o.items)

        await prisma.$transaction(async (tx) => {
            // 1. Copy items from secondary orders into primary
            if (itemsToMove.length > 0) {
                await tx.orderItem.createMany({
                    data: itemsToMove.map(item => ({
                        tenantId,                        // ← required field
                        orderId: primaryOrder.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        note: item.note,
                        kitchenStatus: item.kitchenStatus,
                        isCancelled: false,
                    })),
                })
            }

            // 2. Mark secondary orders as CANCELLED (so table shows clean)
            await tx.order.updateMany({
                where: { id: { in: others.map(o => o.id) } },
                data: {
                    status: 'CANCELLED',
                    note: `รวมเข้าออเดอร์ ${primaryOrder.orderNumber}`,
                },
            })

            // 3. Recalculate subtotal/totalAmount and ensure OPEN
            const freshItems = await tx.orderItem.findMany({
                where: { orderId: primaryOrder.id, isCancelled: false },
            })
            const newSubtotal = freshItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
            await tx.order.update({
                where: { id: primaryOrder.id },
                data: { status: 'OPEN', subtotal: newSubtotal, totalAmount: newSubtotal },
            })
        })

        // Return the fresh merged order
        const merged = await prisma.order.findUnique({
            where: { id: primaryOrder.id },
            include: {
                items: {
                    where: { isCancelled: false },
                    include: { product: true },
                },
            },
        })

        return ok(merged)
    } catch (e: any) {
        console.error('[consolidate] Error:', e)
        return err(e?.message || 'เกิดข้อผิดพลาดในการรวมออเดอร์', 500)
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])
