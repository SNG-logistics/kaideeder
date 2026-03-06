// @ts-nocheck
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth, ok } from '@/lib/admin-auth'

// GET /api/admin/audit-logs?tenantId=&action=&page=1&limit=50
export const GET = withAdminAuth(async (req: NextRequest) => {
    const url = new URL(req.url)
    const tenantId = url.searchParams.get('tenantId') || undefined
    const action = url.searchParams.get('action') || undefined
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50'))
    const skip = (page - 1) * limit

    const where: any = {}
    if (tenantId) where.tenantId = tenantId
    if (action) where.action = { contains: action }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                admin: { select: { name: true, role: true } },
                user: { select: { name: true, username: true } },
                tenant: { select: { code: true, name: true } },
            },
        }),
        prisma.auditLog.count({ where }),
    ])

    return ok({ logs, total, page, limit, pages: Math.ceil(total / limit) })
})
