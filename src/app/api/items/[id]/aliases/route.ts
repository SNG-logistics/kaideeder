import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { normalizeName } from '@/lib/inventory/normalize'
import type { AliasSource } from '@prisma/client'

// POST /api/items/[id]/aliases
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const id = (ctx.params ? await ctx.params : {}).id as string

  const item = await prisma.inventoryItem.findFirst({ where: { id, tenantId } })
  if (!item) return err('ไม่พบรายการ', 404)

  const body = await req.json()
  const aliasName: string = body.aliasName ?? body.alias_name ?? ''
  if (!aliasName.trim()) return err('กรุณาระบุชื่อ alias')

  const normalizedAliasName = normalizeName(aliasName)
  const sourceType: AliasSource = body.sourceType ?? body.source_type ?? 'USER'

  try {
    const alias = await prisma.itemAlias.create({
      data: {
        tenantId,
        inventoryItemId: id,
        aliasName: aliasName.trim(),
        normalizedAliasName,
        sourceType,
      },
    })
    return ok(alias, 201)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return err('ชื่อ alias นี้มีอยู่แล้ว', 409)
    }
    throw error
  }
})

// GET /api/items/[id]/aliases
export const GET = withAuth(async (_req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const id = (ctx.params ? await ctx.params : {}).id as string
  const aliases = await prisma.itemAlias.findMany({
    where: { inventoryItemId: id, tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  return ok(aliases)
})
