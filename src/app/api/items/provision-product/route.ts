import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/items/provision-product
 * 
 * Auto-creates a Product(type=RAW_MATERIAL) row for an InventoryItem
 * that doesn't yet have one. This is needed so the BOM can reference
 * a productId for stock deduction.
 * 
 * Body: { inventoryItemId: string, locationId: string }
 * Returns: { productId: string, sku: string, name: string, unit: string }
 */
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId

  try {
    const body = await req.json()
    const { inventoryItemId, locationId } = body

    if (!inventoryItemId) return err('กรุณาระบุ inventoryItemId')

    // 1. Check if already has a Product
    const existing = await prisma.product.findFirst({
      where: { tenantId, inventoryItemId, isActive: true },
      select: { id: true, sku: true, name: true, unit: true },
    })

    if (existing) {
      return ok(existing) // already provisioned
    }

    // 2. Load the InventoryItem
    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    })

    if (!item || item.tenantId !== tenantId) {
      return err('ไม่พบรายการ Catalog นี้ในระบบ', 404)
    }

    // 3. Find or create a RAW_MATERIAL category
    let rawCategory = await prisma.category.findFirst({
      where: { tenantId, code: { in: ['RAW_MEAT', 'RAW_PORK', 'RAW_SEA', 'RAW_VEG', 'DRY_GOODS', 'OTHER'] } },
      orderBy: { code: 'asc' },
    })

    if (!rawCategory) {
      // Fallback: use the first category
      rawCategory = await prisma.category.findFirst({ where: { tenantId } })
    }

    if (!rawCategory) {
      return err('ไม่พบหมวดหมู่ในระบบ — กรุณาสร้างหมวดหมู่อย่างน้อย 1 อันก่อน')
    }

    // 4. Generate SKU
    const prefix = 'CAT'
    const existingSku = await prisma.product.findMany({
      where: { tenantId, sku: { startsWith: prefix } },
      select: { sku: true },
      orderBy: { sku: 'desc' },
    })

    let nextNum = 1
    const matched = existingSku.filter(p => /^\d+$/.test(p.sku.slice(prefix.length)))
    if (matched.length > 0) {
      nextNum = Math.max(...matched.map(p => parseInt(p.sku.slice(prefix.length)) || 0)) + 1
    }
    const sku = `${prefix}${String(nextNum).padStart(3, '0')}`

    // 5. Create Product + link to InventoryItem
    const product = await prisma.product.create({
      data: {
        tenantId,
        sku,
        name: item.name,
        categoryId: rawCategory.id,
        productType: 'RAW_MATERIAL',
        unit: item.baseUnit,
        unitAlt: item.purchaseUnit,
        convFactor: null,
        costPrice: 0,
        salePrice: 0,
        inventoryItemId: item.id,
      },
      select: { id: true, sku: true, name: true, unit: true },
    })

    // 6. If locationId supplied, create Inventory record (starting at 0)
    if (locationId) {
      const existingInv = await prisma.inventory.findFirst({
        where: { tenantId, productId: product.id, locationId },
      })
      if (!existingInv) {
        await prisma.inventory.create({
          data: {
            tenantId,
            productId: product.id,
            locationId,
            quantity: 0,
          },
        })
      }
    }

    return ok(product)
  } catch (error) {
    console.error('[POST /api/items/provision-product] error:', error)
    return err('เกิดข้อผิดพลาดในการสร้าง Product อัตโนมัติ')
  }
}, ['OWNER', 'MANAGER'])
