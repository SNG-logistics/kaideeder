import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/pos/orders/[orderId]/confirm — cashier confirms a PENDING_CONFIRM order
// If an OPEN order already exists at the same table → merge items into it and delete the PENDING_CONFIRM
// If no OPEN order at table → simple status upgrade to OPEN
export const POST = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId, user }: any = ctx
    const { id: orderId } = await (ctx as any).params

    if (!orderId) return err('Missing orderId')

    const pendingOrder = await prisma.order.findFirst({
        where: { id: orderId, tenantId, status: 'PENDING_CONFIRM' },
        include: { table: true, items: true },
    })
    if (!pendingOrder) return err('Order not found or already confirmed')

    // ── Check if there's already an OPEN order at this table ──────────────
    const existingOpen = pendingOrder.tableId
        ? await prisma.order.findFirst({
              where: { tenantId, tableId: pendingOrder.tableId, status: 'OPEN' },
          })
        : null

    if (existingOpen) {
        // ── MERGE: move items from PENDING_CONFIRM into the existing OPEN order ──
        await prisma.$transaction(async (tx) => {
            // Re-assign all items to the open order
            await tx.orderItem.updateMany({
                where: { orderId: pendingOrder.id },
                data: { orderId: existingOpen.id },
            })

            // Delete the now-empty PENDING_CONFIRM order
            await tx.order.delete({ where: { id: pendingOrder.id } })

            // Recalculate totals on the surviving order
            const allItems = await tx.orderItem.findMany({
                where: { orderId: existingOpen.id, isCancelled: false },
            })
            const newSubtotal = allItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
            await tx.order.update({
                where: { id: existingOpen.id },
                data: { subtotal: newSubtotal, totalAmount: newSubtotal },
            })
        })

        const merged = await prisma.order.findUnique({
            where: { id: existingOpen.id },
            include: { table: true, items: { include: { product: true } } },
        })
        return ok(merged)
    }

    // ── No existing OPEN order → just promote to OPEN (first-time QR) ──────
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
    if (pendingOrder.tableId) {
        await prisma.diningTable.update({
            where: { id: pendingOrder.tableId },
            data: { status: 'OCCUPIED' },
        })
    }

    return ok(updated)
}, ['OWNER', 'MANAGER', 'CASHIER'])
