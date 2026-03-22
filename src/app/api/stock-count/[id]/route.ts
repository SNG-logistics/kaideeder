import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

const itemSelect = {
    id: true, productId: true, locationId: true, systemQty: true, countedQty: true, difference: true, unit: true,
    product: { select: { id: true, name: true, sku: true, unit: true, category: { select: { name: true, icon: true, color: true } } } },
    location: { select: { id: true, code: true, name: true } },
}

// GET /api/stock-count/[id]
export const GET = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id

    const count = await prisma.stockCount.findFirst({
        where: { id, tenantId },
        include: {
            location: { select: { code: true, name: true } },
            items: { select: itemSelect, orderBy: [{ location: { code: 'asc' } }, { product: { name: 'asc' } }] },
        },
    })
    if (!count) return err('ไม่พบ Stock Count', 404)
    return ok(count)
}, ['OWNER', 'MANAGER'])

// PATCH /api/stock-count/[id]  → update countedQty on items
export const PATCH = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id
    const body = await req.json()

    const count = await prisma.stockCount.findFirst({ where: { id, tenantId } })
    if (!count) return err('ไม่พบ Stock Count', 404)
    if (count.status === 'ADJUSTED' || count.status === 'CANCELLED') {
        return err(`ไม่สามารถแก้ไขได้ (status: ${count.status})`)
    }

    // body.items = [{ id: string, countedQty: number | null }]
    const { items, note } = body as {
        items?: { id: string; countedQty: number | null }[]
        note?: string
    }

    await prisma.$transaction(async tx => {
        if (items?.length) {
            for (const item of items) {
                await tx.stockCountItem.updateMany({
                    where: { id: item.id, countId: id },
                    data: { countedQty: item.countedQty },
                })
            }
        }
        if (note !== undefined) {
            await tx.stockCount.update({ where: { id }, data: { note } })
        }
    })

    const updated = await prisma.stockCount.findUnique({
        where: { id },
        include: {
            location: { select: { code: true, name: true } },
            items: { select: itemSelect, orderBy: [{ location: { code: 'asc' } }, { product: { name: 'asc' } }] },
        },
    })
    return ok(updated)
}, ['OWNER', 'MANAGER'])

// DELETE /api/stock-count/[id]  → cancel (only DRAFT)
export const DELETE = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id

    const count = await prisma.stockCount.findFirst({ where: { id, tenantId } })
    if (!count) return err('ไม่พบ Stock Count', 404)
    if (!['DRAFT', 'IN_PROGRESS'].includes(count.status)) {
        return err('ยกเลิกได้เฉพาะ DRAFT / IN_PROGRESS เท่านั้น')
    }
    await prisma.stockCount.update({ where: { id }, data: { status: 'CANCELLED' } })
    return ok({ cancelled: true })
}, ['OWNER', 'MANAGER'])
