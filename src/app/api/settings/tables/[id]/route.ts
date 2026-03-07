import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// DELETE /api/settings/tables/[id] — soft delete (set isActive=false)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return withAuth(async (_req, context) => {
        const { tenantId } = context as any
        const { id } = await params

        // Verify ownership
        const table = await prisma.diningTable.findUnique({
            where: { id },
            include: {
                orders: { where: { status: 'OPEN' }, select: { id: true }, take: 1 },
            },
        })
        if (!table || (table as any).tenantId !== tenantId) return err('ไม่พบโต๊ะ', 404)

        // Block deletion if there is an open order
        if (table.orders.length > 0) {
            return err('ไม่สามารถลบโต๊ะที่มีออเดอร์ที่ยังเปิดอยู่', 400)
        }

        await prisma.diningTable.update({
            where: { id },
            data: { isActive: false },
        })
        return ok({ deleted: true })
    }, ['owner', 'manager'])(req, { params })
}
