import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

/**
 * POST /api/stock-count/[id]/start
 * DRAFT → IN_PROGRESS
 * Re-snapshot systemQty จาก inventory จริง ณ ตอนนี้
 */
export const POST = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id

    const count = await prisma.stockCount.findFirst({ where: { id, tenantId } })
    if (!count) return err('ไม่พบ Stock Count', 404)
    if (count.status !== 'DRAFT') return err(`ต้องเป็น DRAFT ก่อน (ปัจจุบัน: ${count.status})`)

    // Re-snapshot systemQty from current inventory
    const items = await prisma.stockCountItem.findMany({ where: { countId: id } })
    await prisma.$transaction(async tx => {
        for (const item of items) {
            const inv = await tx.inventory.findFirst({
                where: { tenantId, productId: item.productId, locationId: item.locationId },
            })
            await tx.stockCountItem.update({
                where: { id: item.id },
                data: { systemQty: inv?.quantity ?? 0, countedQty: null, difference: null },
            })
        }
        await tx.stockCount.update({
            where: { id },
            data: { status: 'IN_PROGRESS', startedAt: new Date() },
        })
    })

    return ok({ message: `✅ เริ่มนับสต็อค snapshot ณ ${new Date().toLocaleString('th-TH')}` })
}, ['OWNER', 'MANAGER'])
