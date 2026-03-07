import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const renameSchema = z.object({ newName: z.string().min(1, 'กรุณาระบุชื่อโซน') })

// PUT /api/settings/tables/zones/[zone] — rename zone (update all tables in that zone)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ zone: string }> }) {
    return withAuth(async (r, context) => {
        const { tenantId } = context as any
        const { zone } = await params
        const body = await r.json()
        const parsed = renameSchema.safeParse(body)
        if (!parsed.success) return err(parsed.error.errors.map(e => e.message).join(', '))

        const zoneName = decodeURIComponent(zone)
        const newName = parsed.data.newName.trim()

        // Verify zone exists for this tenant
        const count = await prisma.diningTable.count({
            where: { tenantId, zone: zoneName },
        })
        if (count === 0) return err('ไม่พบโซนนี้', 404)

        // Rename all tables in the zone
        await prisma.diningTable.updateMany({
            where: { tenantId, zone: zoneName },
            data: { zone: newName },
        })

        return ok({ renamed: true, from: zoneName, to: newName })
    }, ['owner', 'manager'])(req, { params })
}

// DELETE /api/settings/tables/zones/[zone] — delete zone (soft-delete all tables in it)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ zone: string }> }) {
    return withAuth(async (_r, context) => {
        const { tenantId } = context as any
        const { zone } = await params
        const zoneName = decodeURIComponent(zone)

        // Block if any table in zone has open orders
        const openOrders = await prisma.order.count({
            where: {
                status: 'OPEN',
                table: { tenantId, zone: zoneName },
            },
        })
        if (openOrders > 0) return err(`มีออเดอร์ที่ยังเปิดอยู่ในโซน "${zoneName}" ไม่สามารถลบได้`, 400)

        // Soft-delete all tables in zone
        await prisma.diningTable.updateMany({
            where: { tenantId, zone: zoneName },
            data: { isActive: false },
        })

        return ok({ deleted: true, zone: zoneName })
    }, ['owner', 'manager'])(req, { params })
}
