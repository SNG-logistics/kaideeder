import { NextRequest } from 'next/server'
import { withAuth, ok, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import type { RecStatus } from '@prisma/client'

// GET /api/recommendations
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entity_type') ?? undefined
  const status = (searchParams.get('status') ?? 'OPEN') as RecStatus
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))

  const where = {
    tenantId,
    status,
    ...(entityType ? { entityType } : {}),
  }

  const [recommendations, total] = await Promise.all([
    prisma.aiRecommendation.findMany({
      where,
      orderBy: [{ confidenceScore: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        inventoryItem: {
          select: { id: true, name: true, code: true, status: true },
        },
      },
    }),
    prisma.aiRecommendation.count({ where }),
  ])

  return ok({ recommendations, total, page, limit })
})
