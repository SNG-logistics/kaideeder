import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// PUT /api/locations/[id] — update name/type
export const PUT = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const id = (context as any).params?.id as string
    if (!id) return err('Missing id', 400)

    const body = await req.json()
    const { name, nameLao, type } = body
    if (!name?.trim()) return err('กรุณาระบุชื่อคลัง', 400)

    const loc = await prisma.location.findUnique({ where: { id } })
    if (!loc || (loc as any).tenantId !== tenantId) return err('ไม่พบคลัง', 404)

    const updated = await prisma.location.update({
        where: { id },
        data: {
            name: name.trim(),
            nameLao: nameLao?.trim() || null,
            ...(type && { type }),
        },
    })
    return ok(updated)
}, ['owner', 'manager'])

// DELETE /api/locations/[id] — hard delete + cleanup related records
export const DELETE = withAuth(async (_req: NextRequest, context) => {
    const { tenantId } = context as any
    const params = await context.params
    const id = params?.id as string
    if (!id) return err('Missing id', 400)

    const loc = await prisma.location.findUnique({
        where: { id },
        include: { _count: { select: { inventory: true } } },
    })
    if (!loc || (loc as any).tenantId !== tenantId) return err('ไม่พบคลัง', 404)

    // ลบข้อมูลที่เกี่ยวข้องทั้งหมดก่อน
    const invCount = await prisma.inventory.deleteMany({ where: { locationId: id, tenantId } })
    const movFrom = await prisma.stockMovement.deleteMany({ where: { fromLocationId: id, tenantId } })
    const movTo = await prisma.stockMovement.deleteMany({ where: { toLocationId: id, tenantId } })
    const bomCount = await prisma.recipeBOM.updateMany({ where: { locationId: id, tenantId }, data: { locationId: '' } })

    await prisma.location.delete({ where: { id } })

    return ok({
        deleted: true,
        locationName: loc.name,
        cleaned: {
            inventory: invCount.count,
            stockMovementsFrom: movFrom.count,
            stockMovementsTo: movTo.count,
            bomUpdated: bomCount.count,
        },
    })
}, ['OWNER', 'MANAGER'])
