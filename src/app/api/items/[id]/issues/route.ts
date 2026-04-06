import { NextRequest } from 'next/server'
import { withAuth, ok, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import type { IssueStatus } from '@prisma/client'

// GET /api/items/[id]/issues
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const id = (ctx.params ? await ctx.params : {}).id as string
  const statusFilter = (new URL(req.url).searchParams.get('status') ?? 'OPEN') as IssueStatus

  const issues = await prisma.validationIssue.findMany({
    where: { entityId: id, tenantId, status: statusFilter },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  })

  return ok(issues)
})
