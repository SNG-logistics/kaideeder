// @ts-nocheck
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth, ok, err } from '@/lib/admin-auth'

// GET /api/admin/topups?status=PENDING
export const GET = withAdminAuth(async (req: NextRequest) => {
    const status = new URL(req.url).searchParams.get('status') || 'PENDING'

    const topups = await prisma.topupRequest.findMany({
        where: { status: status as any },
        orderBy: { createdAt: 'desc' },
        include: {
            tenant: { select: { id: true, code: true, name: true } },
            user: { select: { id: true, username: true, name: true } },
        },
    })

    return ok(topups)
})
