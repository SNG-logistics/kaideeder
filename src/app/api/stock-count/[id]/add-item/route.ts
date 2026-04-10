import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/stock-count/[id]/add-item
 *
 * Add a new item to an IN_PROGRESS StockCount Sheet from a Catalog InventoryItem.
 * If the InventoryItem doesn't have a backing Product yet, one is auto-provisioned.
 *
 * Body: { inventoryItemId: string, locationId: string }
 */
export const POST = withAuth(async (
  req: NextRequest,
  ctx: AuthContext
) => {
  const tenantId = ctx.tenantId
  const params = await ctx.params
  const countId = params?.id as string

  if (!countId) return err('ไม่พบ countId')

  const body = await req.json()
  const { inventoryItemId, locationId } = body

  if (!inventoryItemId) return err('กรุณาระบุ inventoryItemId')
  if (!locationId) return err('กรุณาระบุ locationId')

  // 1. Verify the StockCount exists and is editable
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, tenantId },
    select: { id: true, status: true },
  })
  if (!count) return err('ไม่พบ Stock Count Sheet นี้', 404)
  if (!['DRAFT', 'IN_PROGRESS'].includes(count.status)) {
    return err(`ไม่สามารถเพิ่มรายการใน Sheet สถานะ "${count.status}" ได้`)
  }

  // 2. Load the InventoryItem
  const item = await prisma.inventoryItem.findUnique({
    where: { id: inventoryItemId },
  })
  if (!item || item.tenantId !== tenantId) return err('ไม่พบรายการ Catalog นี้', 404)

  // 3. Get or provision a backing Product
  let product = await prisma.product.findFirst({
    where: { tenantId, inventoryItemId, isActive: true },
    select: { id: true, unit: true, name: true },
  })

  if (!product) {
    // Auto-provision: find a suitable RAW category
    const rawCategory = await prisma.category.findFirst({
      where: { tenantId },
      orderBy: { code: 'asc' },
    })
    if (!rawCategory) return err('ไม่พบหมวดหมู่ในระบบ กรุณาสร้างก่อน')

    const existingSkus = await prisma.product.findMany({
      where: { tenantId, sku: { startsWith: 'CAT' } },
      select: { sku: true },
    })
    const nums = existingSkus
      .map(p => parseInt(p.sku.replace('CAT', '')))
      .filter(n => !isNaN(n))
    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1
    const sku = `CAT${String(nextNum).padStart(3, '0')}`

    product = await prisma.product.create({
      data: {
        tenantId,
        sku,
        name: item.name,
        categoryId: rawCategory.id,
        productType: 'RAW_MATERIAL',
        unit: item.baseUnit,
        unitAlt: item.purchaseUnit,
        costPrice: 0,
        salePrice: 0,
        inventoryItemId: item.id,
      },
      select: { id: true, unit: true, name: true },
    })
  }

  // 4. Check if this product+location is already on the sheet
  const existing = await prisma.stockCountItem.findFirst({
    where: { countId, productId: product.id, locationId },
  })
  if (existing) {
    return err(`"${product.name}" มีในชีตนับสต็อคนี้แล้ว (${locationId})`)
  }

  // 5. Get current inventory qty for snapshot
  const inv = await prisma.inventory.findFirst({
    where: { tenantId, productId: product.id, locationId },
    select: { quantity: true },
  })

  // 6. Add the item to the sheet
  const newItem = await prisma.stockCountItem.create({
    data: {
      tenantId,
      countId,
      productId: product.id,
      locationId,
      systemQty: inv?.quantity ?? 0,
      unit: product.unit,
    },
    include: {
      product: {
        select: {
          id: true, name: true, sku: true, unit: true,
          category: { select: { name: true, icon: true, color: true } },
        },
      },
      location: { select: { id: true, code: true, name: true } },
    },
  })

  return ok(newItem, 201)
}, ['OWNER', 'MANAGER'])
