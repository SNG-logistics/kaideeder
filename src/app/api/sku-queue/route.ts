import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'

/**
 * GET /api/sku-queue?status=PENDING|APPROVED_MAP|APPROVED_NEW|REJECTED
 * Returns SkuSuggestion list for the Review Queue UI (TASK-4)
 */
export const GET = withAuth<any>(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'PENDING'

    const suggestions = await prisma.skuSuggestion.findMany({
        where: { tenantId, status: status as any },
        include: {
            matchedProduct: {
                select: { sku: true, name: true, unit: true, category: { select: { code: true, name: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
    })

    return NextResponse.json({ success: true, data: suggestions })
}, ['OWNER', 'MANAGER'])
