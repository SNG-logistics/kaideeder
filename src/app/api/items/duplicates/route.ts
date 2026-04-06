import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId

  // Find all open DUPLICATE_NAME_WARNING issues
  const issues = await prisma.validationIssue.findMany({
    where: { tenantId, issueCode: 'DUPLICATE_NAME_WARNING', status: 'OPEN' },
    include: {
      inventoryItem: {
        include: { aliases: true, conversions: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Also manually group items by normalizedName having > 1 count
  const items = await prisma.inventoryItem.findMany({
    where: { tenantId, status: { not: 'ARCHIVED' } },
    select: { id: true, name: true, normalizedName: true }
  })

  const groupMap = new Map<string, typeof items>()
  for (const item of items) {
    if (!groupMap.has(item.normalizedName)) groupMap.set(item.normalizedName, [])
    groupMap.get(item.normalizedName)!.push(item)
  }

  const normalizedGroups = Array.from(groupMap.entries())
    .filter(([_, groupItems]) => groupItems.length > 1)
    .map(([groupName, groupItems]) => ({
      groupName,
      items: groupItems
    }))

  return ok({
    issues: issues.map(i => ({
      id: i.id,
      message: i.message,
      item: i.inventoryItem,
      details: i.detailsJson
    })),
    normalizedGroups
  })
})
