import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok } from '@/lib/api'

// GET /api/locations
export const GET = withAuth(async (_req, context) => {
    const { tenantId } = context as any
    const locations = await prisma.location.findMany({
        where: { tenantId, isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
            _count: { select: { inventory: true } },
        },
    })
    return ok(locations)
})
