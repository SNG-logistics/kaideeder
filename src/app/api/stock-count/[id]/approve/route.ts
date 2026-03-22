import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

/**
 * POST /api/stock-count/[id]/approve
 * COMPLETED → ADJUSTED
 *
 * สำหรับทุก item ที่ difference != 0:
 * 1. อัปเดต Inventory (increment difference)
 * 2. สร้าง StockMovement (type = ADJUSTMENT)
 */
export const POST = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id

    const count = await prisma.stockCount.findFirst({
        where: { id, tenantId },
        include: { items: true },
    })
    if (!count) return err('ไม่พบ Stock Count', 404)
    if (count.status !== 'COMPLETED') return err(`ต้องเป็น COMPLETED ก่อน (ปัจจุบัน: ${count.status})`)

    const changedItems = count.items.filter(i => i.difference !== null && Math.abs(i.difference!) > 0.001)

    await prisma.$transaction(async tx => {
        for (const item of changedItems) {
            const diff = item.difference!

            // Update or upsert inventory record
            const inv = await tx.inventory.findFirst({
                where: { tenantId, productId: item.productId, locationId: item.locationId },
            })
            if (inv) {
                await tx.inventory.update({
                    where: { id: inv.id },
                    data: { quantity: { increment: diff } },
                })
            } else {
                await tx.inventory.create({
                    data: {
                        tenantId,
                        productId: item.productId,
                        locationId: item.locationId,
                        quantity: diff,
                        avgCost: 0,
                    },
                })
            }

            // StockMovement for audit trail
            await tx.stockMovement.create({
                data: {
                    tenantId,
                    productId: item.productId,
                    fromLocationId: diff < 0 ? item.locationId : null,
                    toLocationId: diff > 0 ? item.locationId : null,
                    quantity: Math.abs(diff),
                    unitCost: 0,
                    totalCost: 0,
                    type: 'ADJUSTMENT',
                    referenceId: id,
                    referenceType: 'STOCK_COUNT',
                    note: `นับสต็อค: ${count.name} (${diff > 0 ? '+' : ''}${diff.toFixed(2)} ${item.unit})`,
                    createdById: ctx.user?.userId || null,
                },
            })
        }

        await tx.stockCount.update({
            where: { id },
            data: { status: 'ADJUSTED', approvedAt: new Date() },
        })
    })

    return ok({
        message: `✅ Apply adjustment เรียบร้อย — ปรับ ${changedItems.length} รายการ`,
        adjustedCount: changedItems.length,
    })
}, ['OWNER', 'MANAGER'])
