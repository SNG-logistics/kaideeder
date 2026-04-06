import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { normalizeName } from '@/lib/inventory/normalize'
import { validateItem } from '@/lib/inventory/validation'
import { type IssueStatus, type ItemStatus, type Prisma } from '@prisma/client'

// ── GET /api/items/[id] ───────────────────────────────────────────────────────
export const GET = withAuth(async (_req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const id = (ctx.params ? await ctx.params : {}).id as string

  const item = await prisma.inventoryItem.findFirst({
    where: { id, tenantId },
    include: {
      conversions: { orderBy: { createdAt: 'asc' } },
      aliases: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
      issues: { where: { status: 'OPEN' }, orderBy: { severity: 'asc' } },
      recommendations: { where: { status: 'OPEN' } },
    },
  })

  if (!item) return err('ไม่พบรายการ', 404)
  return ok(item)
})

// ── PATCH /api/items/[id] ─────────────────────────────────────────────────────
export const PATCH = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const id = (ctx.params ? await ctx.params : {}).id as string

  const existing = await prisma.inventoryItem.findFirst({ where: { id, tenantId } })
  if (!existing) return err('ไม่พบรายการ', 404)

  const body = await req.json()

  // Build update payload (only allow listed fields)
  const allowedFields = [
    'name', 'itemRole', 'itemKind', 'categoryKey', 'proteinFamily',
    'speciesType', 'cutPart', 'formState', 'baseUnit', 'purchaseUnit',
    'trackStock', 'isPurchasable', 'isSellable', 'status',
  ] as const

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field]
  }

  // Re-normalize name if name changed
  if (typeof updateData.name === 'string') {
    updateData.normalizedName = normalizeName(updateData.name)
  }

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: updateData,
  })

  // Re-run validation on update
  const conversions = await prisma.itemUnitConversion.findMany({
    where: { inventoryItemId: id },
    select: { fromUnit: true, toUnit: true },
  })

  // Close old OPEN issues and recreate
  await prisma.validationIssue.updateMany({
    where: { entityId: id, tenantId, status: 'OPEN' },
    data: { status: 'RESOLVED' as IssueStatus, resolvedAt: new Date() },
  })

  const issues = await validateItem(updated, conversions)
  if (issues.length > 0) {
    await prisma.validationIssue.createMany({
      data: issues.map((issue) => ({
        tenantId,
        entityType: 'ITEM',
        entityId: id,
        issueCode: issue.issueCode,
        severity: issue.severity,
        message: issue.message,
        detailsJson: (issue.detailsJson ?? {}) as unknown as Prisma.InputJsonValue,
      })),
    })
  }

  return ok({ item: updated, issueCount: issues.length })
})

// end of file
