import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

/**
 * POST /api/stock-count/[id]/complete
 * IN_PROGRESS → COMPLETED
 * คำนวณ difference = countedQty - systemQty ทุก item
 * item ที่ยังไม่ได้นับ (countedQty = null) → ถือว่า = systemQty (difference = 0)
 */
export const POST = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id

    const count = await prisma.stockCount.findFirst({ where: { id, tenantId } })
    if (!count) return err('ไม่พบ Stock Count', 404)
    if (count.status !== 'IN_PROGRESS') return err(`ต้องเป็น IN_PROGRESS ก่อน (ปัจจุบัน: ${count.status})`)

    const items = await prisma.stockCountItem.findMany({ where: { countId: id } })

    await prisma.$transaction(async tx => {
        for (const item of items) {
            const counted = item.countedQty ?? item.systemQty // ไม่นับ = ถือว่าตรงกัน
            const diff = counted - item.systemQty
            await tx.stockCountItem.update({
                where: { id: item.id },
                data: {
                    countedQty: counted,
                    difference: diff,
                },
            })
        }
        await tx.stockCount.update({
            where: { id },
            data: { status: 'COMPLETED', completedAt: new Date() },
        })
    })

    const diffItems = items.filter(i => {
        const counted = i.countedQty ?? i.systemQty
        return Math.abs(counted - i.systemQty) > 0.001
    })

    return ok({
        message: `✅ นับสต็อคเสร็จ — พบผลต่าง ${diffItems.length} รายการ`,
        differenceCount: diffItems.length,
    })
}, ['OWNER', 'MANAGER'])
