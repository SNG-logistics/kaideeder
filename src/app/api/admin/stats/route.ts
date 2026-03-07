// @ts-nocheck
/**
 * GET /api/admin/stats — KPI summary for admin dashboard
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/admin-auth'

async function handler(req: NextRequest) {

    const [
        totalTenants,
        activeTenants,
        suspendedTenants,
        pastDueTenants,
        pendingTopups,
        totalPlans,
        walletAgg,
        recentTopups,
    ] = await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: 'ACTIVE' } }),
        prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
        prisma.tenant.count({ where: { status: 'PAST_DUE' } }),
        prisma.topupRequest.count({ where: { status: 'PENDING' } }),
        prisma.plan.count(),
        prisma.wallet.aggregate({ _sum: { balanceLAK: true } }),
        prisma.topupRequest.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                amountLAK: true,
                channel: true,
                createdAt: true,
                tenant: { select: { name: true, code: true } },
                user: { select: { name: true } },
            },
        }),
    ])

    return NextResponse.json({
        success: true,
        data: {
            tenants: { total: totalTenants, active: activeTenants, suspended: suspendedTenants, pastDue: pastDueTenants },
            pendingTopups,
            totalPlans,
            totalWalletLAK: walletAgg._sum.balanceLAK ?? 0,
            recentTopups,
        },
    })
}

export const GET = withAdminAuth(handler)
