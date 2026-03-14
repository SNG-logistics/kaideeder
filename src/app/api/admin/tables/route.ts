import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/admin/tables — list all dining tables for the admin (requires auth)
export const GET = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId }: any = ctx
    const tables = await prisma.diningTable.findMany({
        where: { tenantId },
        orderBy: [{ zone: 'asc' }, { number: 'asc' }],
    })
    return ok({ tables })
})
