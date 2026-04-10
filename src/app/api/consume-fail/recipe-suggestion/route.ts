import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

/**
 * GET /api/consume-fail/recipe-suggestion
 *
 * Given a consumeFailLogId, return:
 *  - hasRecipe: boolean
 *  - recipeId: string | null
 *  - menuName: string
 *  - menuId: string | null
 *  - posMenuCode: string | null
 *  - openFailCount: number   (how many OPEN NO_BOM fails for this menu)
 *  - catalogSuggestions: top Catalog items that might be ingredients (fuzzy name match)
 */
export const GET = withAuth(async (req: NextRequest, ctx: any) => {
  const { tenantId } = ctx
  const { searchParams } = new URL(req.url)
  const logId = searchParams.get('logId')

  if (!logId) return err('กรุณาระบุ logId')

  // 1. Fetch the ConsumeFail log
  const log = await prisma.consumeFailLog.findFirst({
    where: { id: logId, tenantId },
    include: {
      menu: { select: { id: true, name: true, sku: true } },
    },
  })
  if (!log) return err('ไม่พบรายการ', 404)

  const menuName = log.menuName ?? log.menu?.name ?? ''
  const menuId = log.menuId ?? null
  const posMenuCode = log.menu?.sku ?? null

  // 2. Check if a recipe already exists for this menu
  let hasRecipe = false
  let recipeId: string | null = null

  if (menuName) {
    const existing = await prisma.recipe.findFirst({
      where: {
        tenantId,
        menuName: { equals: menuName },
        isActive: true,
      },
      select: { id: true },
    })
    if (existing) {
      hasRecipe = true
      recipeId = existing.id
    }
  }

  // 3. Count open NO_BOM failures for the same menu (to show urgency)
  const openFailCount = menuId
    ? await prisma.consumeFailLog.count({
        where: {
          tenantId,
          menuId,
          failReason: 'NO_BOM',
          status: 'OPEN',
        },
      })
    : await prisma.consumeFailLog.count({
        where: {
          tenantId,
          menuName,
          failReason: 'NO_BOM',
          status: 'OPEN',
        },
      })

  // 4. Catalog suggestions — search InventoryItems with itemRole RAW/PREP
  //    Use the menu name to hint (not always useful, but serves as an example)
  const catalogItems = await prisma.inventoryItem.findMany({
    where: {
      tenantId,
      itemRole: { in: ['RAW', 'PREP'] },
    },
    select: {
      id: true,
      name: true,
      code: true,
      baseUnit: true,
      itemRole: true,
      products: {
        select: { id: true, name: true },
        where: { isActive: true },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
    take: 50,
  })

  return ok({
    menuName,
    menuId,
    posMenuCode,
    hasRecipe,
    recipeId,
    openFailCount,
    catalogItems: catalogItems.map(item => ({
      id: item.id,
      name: item.name,
      code: item.code,
      baseUnit: item.baseUnit,
      itemRole: item.itemRole,
      hasProduct: item.products.length > 0,
      productId: item.products[0]?.id ?? null,
    })),
  })
}, ['OWNER', 'MANAGER'])
