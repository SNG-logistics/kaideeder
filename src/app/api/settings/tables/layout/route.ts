import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const updateLayoutSchema = z.object({
    tables: z.array(z.object({
        id: z.string().min(1),
        posX: z.number(),
        posY: z.number(),
        width: z.number(),
        height: z.number(),
        shape: z.string()
    }))
})

// PUT /api/settings/tables/layout — batch update table positions
export const PUT = withAuth(async (req: NextRequest, context) => {
    try {
        const { tenantId } = context as any
        const body = await req.json()
        const data = updateLayoutSchema.parse(body)

        // Using transaction for batch update
        const updates = data.tables.map(t => 
            prisma.diningTable.updateMany({
                where: { id: t.id, tenantId },
                data: {
                    posX: t.posX,
                    posY: t.posY,
                    width: t.width,
                    height: t.height,
                    shape: t.shape
                }
            })
        )

        await prisma.$transaction(updates)
        return ok({ message: 'Layout saved successfully' })
    } catch (error: any) {
        if (error?.name === 'ZodError') return err(error.errors.map((e: any) => e.message).join(', '))
        return err('เกิดข้อผิดพลาดในการบันทึกผังร้าน')
    }
}, ['owner', 'manager'])
