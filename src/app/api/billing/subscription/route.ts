// @ts-nocheck
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/billing/subscription — current sub + days remaining
export const GET = withAuth(async (_req: NextRequest, context) => {
    const { tenantId } = context

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { status: true, subEndsAt: true, graceEndsAt: true },
    })
    if (!tenant) return err('Tenant not found', 404)

    const activeSub = await prisma.subscription.findFirst({
        where: { tenantId, status: 'ACTIVE' },
        orderBy: { endAt: 'desc' },
        include: { plan: true },
    })

    const now = new Date()
    const daysLeft = tenant.subEndsAt
        ? Math.max(0, Math.ceil((tenant.subEndsAt.getTime() - now.getTime()) / 86400_000))
        : null

    return ok({
        tenantStatus: tenant.status,
        subEndsAt: tenant.subEndsAt,
        graceEndsAt: tenant.graceEndsAt,
        daysLeft,
        activePlan: activeSub?.plan ?? null,
        activeSub: activeSub ?? null,
    })
})
