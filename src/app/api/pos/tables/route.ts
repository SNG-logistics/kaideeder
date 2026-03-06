import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

// GET /api/pos/tables — list all tables with current order info
export const GET = withAuth(async (_req, context) => {
    const { tenantId } = context as any
    const tables = await prisma.diningTable.findMany({
        where: { tenantId, isActive: true },
        orderBy: { number: 'asc' },
        include: {
            orders: {
                where: { status: 'OPEN' },
                include: {
                    items: {
                        where: { isCancelled: false },
                        include: { product: true },
                    },
                },
                take: 1,
            },
        },
    })
    return ok(tables)
}, ['owner', 'manager', 'cashier'])

const updateTableSchema = z.object({
    id: z.string().min(1),
    status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED']).optional(),
})

// POST /api/pos/tables — update table status
export const POST = withAuth(async (req: NextRequest, context) => {
    try {
        const { tenantId } = context as any
        const body = await req.json()
        const data = updateTableSchema.parse(body)

        // Verify table belongs to tenant
        const existing = await prisma.diningTable.findUnique({ where: { id: data.id } })
        if (!existing || (existing as any).tenantId !== tenantId) return err('Not found', 404)

        const table = await prisma.diningTable.update({
            where: { id: data.id },
            data: { ...(data.status && { status: data.status }) },
        })
        return ok(table)
    } catch (error: any) {
        if (error?.name === 'ZodError') return err(error.errors.map((e: any) => e.message).join(', '))
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])
