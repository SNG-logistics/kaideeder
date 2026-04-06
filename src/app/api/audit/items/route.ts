import { NextRequest } from 'next/server'
import { withAuth, ok, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { validateItem } from '@/lib/inventory/validation'
import type { Prisma } from '@prisma/client'

/**
 * POST /api/audit/items/run
 * On-demand catalog audit for the tenant.
 * Scans all non-archived items, runs all 8 validation rules, upserts issues and recommendations.
 */
export const POST = withAuth(async (_req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId

  const items = await prisma.inventoryItem.findMany({
    where: { tenantId, status: { not: 'ARCHIVED' } },
    include: { conversions: { select: { fromUnit: true, toUnit: true } } },
  })

  let issuesCreated = 0
  let recsCreated = 0

  for (const item of items) {
    // Close existing OPEN issues for this item before re-running
    await prisma.validationIssue.updateMany({
      where: { entityId: item.id, tenantId, status: 'OPEN' },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    })

    const issues = await validateItem(item, item.conversions)
    if (issues.length > 0) {
      await prisma.validationIssue.createMany({
        data: issues.map((i) => ({
          tenantId,
          entityType: 'ITEM',
          entityId: item.id,
          issueCode: i.issueCode,
          severity: i.severity,
          message: i.message,
          detailsJson: (i.detailsJson ?? {}) as Prisma.InputJsonValue,
        })),
      })
      issuesCreated += issues.length
    }

    // Create recommendation if there are ERROR-level issues
    const hasError = issues.some((i) => i.severity === 'ERROR')
    if (hasError) {
      const existingRec = await prisma.aiRecommendation.findFirst({
        where: {
          tenantId,
          entityId: item.id,
          recommendationType: 'FIX_METADATA',
          status: 'OPEN',
        },
      })
      if (!existingRec) {
        await prisma.aiRecommendation.create({
          data: {
            tenantId,
            entityType: 'ITEM',
            entityId: item.id,
            recommendationType: 'FIX_METADATA',
            title: `"${item.name}" มีข้อผิดพลาดที่ต้องแก้ไข`,
            detailsJson: { issues: issues.filter((i) => i.severity === 'ERROR') } as unknown as Prisma.InputJsonValue,
            confidenceScore: 1.0,
            riskLevel: 'HIGH',
          },
        })
        recsCreated++
      }
    }
  }

  return ok({
    scanned: items.length,
    issuesCreated,
    recsCreated,
  })
})

/**
 * GET /api/audit/items/summary
 * Returns count breakdown by status group for the tenant.
 */
export const GET = withAuth(async (_req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId

  const [byStatus, openIssuesByCode, openRecs] = await Promise.all([
    prisma.inventoryItem.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    }),
    prisma.validationIssue.groupBy({
      by: ['issueCode'],
      where: { tenantId, status: 'OPEN' },
      _count: { id: true },
    }),
    prisma.aiRecommendation.count({ where: { tenantId, status: 'OPEN' } }),
  ])

  return ok({
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])),
    openIssuesByCode: Object.fromEntries(openIssuesByCode.map((r) => [r.issueCode, r._count.id])),
    openRecommendations: openRecs,
  })
})
