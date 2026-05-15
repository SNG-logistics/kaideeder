import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// PUT /api/locations/[id] — update name/type
export const PUT = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const id = (context as any).params?.id as string
    if (!id) return err('Missing id', 400)

    const body = await req.json()
    const { name, nameLao, type } = body
    if (!name?.trim()) return err('กรุณาระบุชื่อคลัง', 400)

    const loc = await prisma.location.findUnique({ where: { id } })
    if (!loc || (loc as any).tenantId !== tenantId) return err('ไม่พบคลัง', 404)

    const updated = await prisma.location.update({
        where: { id },
        data: {
            name: name.trim(),
            nameLao: nameLao?.trim() || null,
            ...(type && { type }),
        },
    })
    return ok(updated)
}, ['owner', 'manager'])

// DELETE /api/locations/[id]
// Cascade order: PrepProduction → PrepRecipe (→ PrepRecipeLine via Cascade)
//   → StockCountItems → StockCounts (set null) → StockTransfer → StockMovements
//   → Inventory → RecipeBOM locationId (set '') → Location
export const DELETE = withAuth(async (_req: NextRequest, context) => {
    const { tenantId } = context as any
    const params = await context.params
    const id = params?.id as string
    if (!id) return err('Missing id', 400)

    const loc = await prisma.location.findUnique({
        where: { id },
        include: { _count: { select: { inventory: true } } },
    })
    if (!loc || (loc as any).tenantId !== tenantId) return err('ไม่พบคลัง', 404)

    // 1. PrepProduction (references PrepRecipe & Location — both non-nullable)
    const prepProd = await prisma.prepProduction.deleteMany({
        where: { locationId: id, tenantId },
    })

    // 2. PrepRecipe (references Location via outputLocationId — non-nullable)
    //    PrepRecipeLine will CASCADE from PrepRecipe delete
    const prepRecipes = await prisma.prepRecipe.deleteMany({
        where: { outputLocationId: id, tenantId },
    })

    // 3. PrepRecipeLines that reference this location as ingredient location
    //    (those not already cascaded from step 2)
    const prepLines = await prisma.prepRecipeLine.deleteMany({
        where: { locationId: id },
    })

    // 4. StockCountItems (locationId non-nullable)
    const countItems = await prisma.stockCountItem.deleteMany({
        where: { locationId: id },
    })

    // 5. StockCounts locationId is nullable → set to null
    await prisma.stockCount.updateMany({
        where: { locationId: id },
        data: { locationId: null },
    })

    // 6. StockTransfers (fromLocationId / toLocationId both non-nullable)
    const transFrom = await prisma.stockTransfer.deleteMany({
        where: { fromLocationId: id, tenantId },
    })
    const transTo = await prisma.stockTransfer.deleteMany({
        where: { toLocationId: id, tenantId },
    })

    // 7. StockMovements (fromLocationId / toLocationId nullable)
    const movFrom = await prisma.stockMovement.deleteMany({
        where: { fromLocationId: id, tenantId },
    })
    const movTo = await prisma.stockMovement.deleteMany({
        where: { toLocationId: id, tenantId },
    })

    // 8. Inventory
    const invCount = await prisma.inventory.deleteMany({
        where: { locationId: id, tenantId },
    })

    // 9. RecipeBOM.locationId is a plain String (no FK), set to empty string
    const bomCount = await prisma.recipeBOM.updateMany({
        where: { locationId: id, tenantId },
        data: { locationId: '' },
    })

    // 10. Finally delete the location
    await prisma.location.delete({ where: { id } })

    return ok({
        deleted: true,
        locationName: loc.name,
        cleaned: {
            inventory: invCount.count,
            stockCountItems: countItems.count,
            stockMovementsFrom: movFrom.count,
            stockMovementsTo: movTo.count,
            transfersFrom: transFrom.count,
            transfersTo: transTo.count,
            prepRecipeLines: prepLines.count,
            prepRecipes: prepRecipes.count,
            prepProductions: prepProd.count,
            bomUpdated: bomCount.count,
        },
    })
}, ['OWNER', 'MANAGER'])
