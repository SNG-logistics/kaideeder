// @ts-nocheck
/**
 * GET /api/admin/store-stats
 * Returns per-tenant statistics for the database control center
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth } from '@/lib/admin-auth'

async function handler(_req: NextRequest) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // All tenants with relation counts
    const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            code: true,
            name: true,
            displayName: true,
            status: true,
            currency: true,
            createdAt: true,
            subEndsAt: true,
            wallet: { select: { balanceLAK: true } },
            _count: {
                select: {
                    users: true,
                    products: { where: { isActive: true } },
                    tables: { where: { isActive: true } },
                },
            },
        },
    })

    // Per-tenant order stats (today + live)
    const orderStats = await prisma.order.groupBy({
        by: ['tenantId', 'status'],
        _count: { id: true },
        where: {
            tenantId: { in: tenants.map(t => t.id) },
        },
    })

    // Today's orders per tenant
    const todayOrders = await prisma.order.groupBy({
        by: ['tenantId'],
        _count: { id: true },
        where: {
            tenantId: { in: tenants.map(t => t.id) },
            openedAt: { gte: today },
        },
    })

    // Build lookup maps
    const statsByTenant: Record<string, { open: number; pending: number; total: number }> = {}
    for (const row of orderStats) {
        if (!statsByTenant[row.tenantId]) statsByTenant[row.tenantId] = { open: 0, pending: 0, total: 0 }
        statsByTenant[row.tenantId].total += row._count.id
        if (row.status === 'OPEN') statsByTenant[row.tenantId].open = row._count.id
        if (row.status === 'PENDING_CONFIRM') statsByTenant[row.tenantId].pending = row._count.id
    }
    const todayByTenant: Record<string, number> = {}
    for (const row of todayOrders) todayByTenant[row.tenantId] = row._count.id

    const data = tenants.map(t => ({
        id: t.id,
        code: t.code,
        name: t.name,
        displayName: t.displayName,
        status: t.status,
        currency: t.currency,
        createdAt: t.createdAt,
        subEndsAt: t.subEndsAt,
        walletLAK: t.wallet?.balanceLAK ?? 0,
        users: t._count.users,
        products: t._count.products,
        tables: t._count.tables,
        ordersToday: todayByTenant[t.id] ?? 0,
        ordersOpen: statsByTenant[t.id]?.open ?? 0,
        ordersPending: statsByTenant[t.id]?.pending ?? 0,
        ordersTotal: statsByTenant[t.id]?.total ?? 0,
    }))

    return NextResponse.json({ ok: true, data })
}

export const GET = withAdminAuth(handler)
