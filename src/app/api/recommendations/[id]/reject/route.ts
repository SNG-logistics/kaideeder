import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'

// POST /api/recommendations/[id]/reject
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
      status: 'REJECTED',
      approvedAt: new Date(),
      approvedBy: userId,
    },
  })

  return ok(updated)
})
