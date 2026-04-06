import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/items/search-for-bom?q=หมู&limit=25
 * 
 * Fast autocomplete for the Recipe BOM builder.
 * Returns InventoryItem rows with their unit conversions,
 * and whether they already have a backing Product row.
 */
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '25'), 50)

  const where: any = {
    tenantId,
    status: { not: 'ARCHIVED' },
  }

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { normalizedName: { contains: q } },
      { code: { contains: q } },
      { aliases: { some: { aliasName: { contains: q } } } },
    ]
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      itemRole: true,
      itemKind: true,
      categoryKey: true,
      baseUnit: true,
      purchaseUnit: true,
      status: true,
      conversions: {
        select: { fromUnit: true, toUnit: true, ratio: true },
      },
      products: {
        where: { tenantId, isActive: true },
        select: { id: true, sku: true, name: true, unit: true },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
    take: limit,
  })

  // Flatten for UI
  const results = items.map((item) => ({
    inventoryItemId: item.id,
    code: item.code,
    name: item.name,
    itemRole: item.itemRole,
    itemKind: item.itemKind,
    categoryKey: item.categoryKey,
    baseUnit: item.baseUnit,
    purchaseUnit: item.purchaseUnit,
    status: item.status,
    conversions: item.conversions,
    // Backing Product
    hasProduct: item.products.length > 0,
    productId: item.products[0]?.id ?? null,
    productSku: item.products[0]?.sku ?? null,
  }))

  return ok(results)
})
