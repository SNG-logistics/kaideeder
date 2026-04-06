import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { normalizeName } from '@/lib/inventory/normalize'

const MERGE_WARNING_LIMIT = 20

export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const userId = ctx.user?.userId ?? null

  try {
    const body = await req.json()
    const masterId: string = body?.masterId
    const aliasIds: string[] = body?.aliasIds ?? []

    if (!masterId) return err('กรุณาระบุ masterId (รายการหลักที่ต้องการเก็บไว้)')
    if (!aliasIds || aliasIds.length === 0) return err('กรุณาระบุรายการที่ต้องการยุบรวมอย่างน้อย 1 รายการ')
    if (aliasIds.includes(masterId)) return err('ไม่สามารถยุบรวมรายการเข้ากับตัวเองได้')
    if (aliasIds.length > MERGE_WARNING_LIMIT) return err(`ไม่สามารถยุบรวมเกิน ${MERGE_WARNING_LIMIT} รายการต่อครั้งได้`)

    // Validate master exists
    const master = await prisma.inventoryItem.findUnique({
      where: { id: masterId, tenantId },
      include: { conversions: true, aliases: true },
    })
    if (!master) return err('ไม่พบรายการหลัก (MasterItem) ในระบบ', 404)

    // Validate all aliases exist
    const aliasesToMerge = await prisma.inventoryItem.findMany({
      where: { id: { in: aliasIds }, tenantId },
      include: { conversions: true, aliases: true },
    })

    if (aliasesToMerge.length !== aliasIds.length) {
      return err('รายการที่จะยุบรวมบางส่วนไม่พบในระบบ หรือถูกลบไปแล้ว', 400)
    }

    // Define interactive transaction for strict atomicity & relational integrity
    await prisma.$transaction(async (tx) => {
      // Create a set of master's existing concepts to prevent uniqueness constraint failures
      const masterAliases = new Set(master.aliases.map((a) => a.normalizedAliasName))
      const masterConversions = new Set(
        master.conversions.map((c) => `${c.fromUnit}->${c.toUnit}`)
      )

      for (const aliasItem of aliasesToMerge) {
        // 1. Move the AliasItem's OWN name into an ItemAlias under Master
        const normalizedItemName = normalizeName(aliasItem.name)
        if (!masterAliases.has(normalizedItemName)) {
          await tx.itemAlias.create({
            data: {
              tenantId,
              inventoryItemId: masterId,
              aliasName: aliasItem.name,
              normalizedAliasName: normalizedItemName,
              sourceType: 'USER',
            },
          })
          masterAliases.add(normalizedItemName)
        }

        // 2. Move existing ItemAliases from AliasItem to Master
        for (const existingAlias of aliasItem.aliases) {
          if (!masterAliases.has(existingAlias.normalizedAliasName)) {
            await tx.itemAlias.update({
              where: { id: existingAlias.id },
              data: { inventoryItemId: masterId },
            })
            masterAliases.add(existingAlias.normalizedAliasName)
          } else {
            // Already exists on master -> discard redundant alias
            await tx.itemAlias.delete({ where: { id: existingAlias.id } })
          }
        }

        // 3. Move Unit Conversions safely
        for (const conv of aliasItem.conversions) {
          const key = `${conv.fromUnit}->${conv.toUnit}`
          if (!masterConversions.has(key)) {
            await tx.itemUnitConversion.update({
              where: { id: conv.id },
              data: { inventoryItemId: masterId },
            })
            masterConversions.add(key)
          } else {
            await tx.itemUnitConversion.delete({ where: { id: conv.id } })
          }
        }

        // 4. Move Product references (Phase 2 Bridge!)
        await tx.product.updateMany({
          where: { tenantId, inventoryItemId: aliasItem.id },
          data: { inventoryItemId: masterId },
        })

        // 5. Transfer AiItemClassifications (Historical Logs)
        await tx.aiItemClassification.updateMany({
          where: { tenantId, inventoryItemId: aliasItem.id },
          data: { inventoryItemId: masterId },
        })

        // 6. Delete volatile objects linked to aliasItem
        await tx.validationIssue.deleteMany({
          where: { tenantId, entityId: aliasItem.id, entityType: 'ITEM' },
        })
        
        await tx.aiRecommendation.deleteMany({
          where: { tenantId, entityId: aliasItem.id, entityType: 'ITEM' },
        })

        await tx.entityUsageSummary.deleteMany({
          where: { tenantId, entityId: aliasItem.id, entityType: 'ITEM' },
        })

        // Finally, delete the Alias item
        await tx.inventoryItem.delete({
          where: { id: aliasItem.id, tenantId },
        })
      }
    })

    return ok({ message: `ยุบรวม ${aliasIds.length} รายการเสร็จสมบูรณ์` })
  } catch (error) {
    console.error('[POST /api/items/merge] error:', error)
    return err('เกิดข้อผิดพลาดในการรวมรายการ')
  }
})
