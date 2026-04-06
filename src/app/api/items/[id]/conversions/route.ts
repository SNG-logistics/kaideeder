import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

// POST /api/items/[id]/conversions
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const id = (ctx.params ? await ctx.params : {}).id as string

  const item = await prisma.inventoryItem.findFirst({ where: { id, tenantId } })
  if (!item) return err('ไม่พบรายการ', 404)

  const body = await req.json()
  const fromUnit: string = body.fromUnit ?? body.from_unit ?? ''
  const toUnit: string = body.toUnit ?? body.to_unit ?? ''
  const ratio: number = body.ratio

  if (!fromUnit || !toUnit) return err('กรุณาระบุ fromUnit และ toUnit')
  if (!ratio || ratio <= 0) return err('กรุณาระบุ ratio ที่มากกว่า 0')

  try {
    const conversion = await prisma.itemUnitConversion.create({
      data: {
        tenantId,
        inventoryItemId: id,
        fromUnit,
        toUnit,
        ratio: new Decimal(ratio),
        isDefault: body.isDefault ?? true,
      },
    })
    return ok(conversion, 201)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return err(`มี conversion ${fromUnit}→${toUnit} อยู่แล้ว`, 409)
    }
    throw error
  }
})

// GET /api/items/[id]/conversions
export const GET = withAuth(async (_req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const id = (ctx.params ? await ctx.params : {}).id as string
  const conversions = await prisma.itemUnitConversion.findMany({
    where: { inventoryItemId: id, tenantId },
    orderBy: { createdAt: 'asc' },
  })
  return ok(conversions)
})
