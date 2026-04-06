import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'

// POST /api/recommendations/[id]/approve
export const POST = withAuth(async (_req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const userId = ctx.user?.userId ?? null
  const id = (ctx.params ? await ctx.params : {}).id as string

  const rec = await prisma.aiRecommendation.findFirst({
    where: { id, tenantId, status: 'OPEN' },
  })
  if (!rec) return err('ไม่พบคำแนะนำ หรือไม่อยู่ในสถานะ OPEN', 404)

  const updated = await prisma.aiRecommendation.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: userId,
    },
  })

  // Apply changes from detailsJson if recommendation is FIX_METADATA
  if (rec.recommendationType === 'FIX_METADATA' && rec.entityId) {
    const details = rec.detailsJson as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    const allowedPatchFields = [
      'itemRole', 'itemKind', 'categoryKey', 'proteinFamily',
      'speciesType', 'cutPart', 'formState', 'baseUnit', 'purchaseUnit',
    ]
    for (const field of allowedPatchFields) {
      if (details[field] !== undefined) patch[field] = details[field]
    }
    if (Object.keys(patch).length > 0) {
      await prisma.inventoryItem.update({ where: { id: rec.entityId }, data: patch })
      // Mark as APPLIED
      await prisma.aiRecommendation.update({ where: { id }, data: { status: 'APPLIED' } })
    }
  }

  return ok(updated)
})
