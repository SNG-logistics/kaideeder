import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { type Prisma } from '@prisma/client'
import { classifyItem, buildTenantGlossary } from '@/lib/inventory/ai-classifier'
import { checkDuplicates } from '@/lib/inventory/duplicate-check'

/**
 * POST /api/items/ai-classify
 * Classify an item name with AI. Does NOT save to inventory_items.
 * Body: { name: string }
 */
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  try {
    const tenantId = ctx.tenantId
    const body = await req.json()
    const name: string = body?.name?.trim() ?? ''

    if (!name) return err('กรุณาระบุชื่อรายการ')
    if (name.length > 255) return err('ชื่อรายการยาวเกินไป')

    // Run AI classify + duplicate check in parallel
    const [glossary, duplicates] = await Promise.all([
      buildTenantGlossary(tenantId),
      checkDuplicates({ tenantId, name }),
    ])

    const classification = await classifyItem(name, glossary)

    // Persist classification log (no master write)
    await prisma.aiItemClassification.create({
      data: {
        tenantId,
        inputName: name,
        suggestedRole: classification.suggestedRole,
        suggestedKind: classification.suggestedKind,
        suggestedCategory: classification.suggestedCategory,
        suggestedBaseUnit: classification.suggestedBaseUnit,
        suggestedPurchaseUnit: classification.suggestedPurchaseUnit,
        suggestedCode: classification.suggestedCode,
        suggestedProteinFamily: classification.suggestedProteinFamily,
        suggestedSpeciesType: classification.suggestedSpeciesType,
        suggestedCutPart: classification.suggestedCutPart,
        suggestedFormState: classification.suggestedFormState,
        confidenceScore: classification.confidenceScore,
        duplicateCandidateJson: duplicates as unknown as Prisma.InputJsonValue,
        warningJson: classification.warnings as unknown as Prisma.InputJsonValue,
        rawModelResponse: classification.rawModelResponse as Prisma.InputJsonValue ?? undefined,
      },
    })

    return ok({
      suggested: {
        item_role: classification.suggestedRole,
        item_kind: classification.suggestedKind,
        category_key: classification.suggestedCategory,
        protein_family: classification.suggestedProteinFamily,
        species_type: classification.suggestedSpeciesType,
        cut_part: classification.suggestedCutPart,
        form_state: classification.suggestedFormState,
        base_unit: classification.suggestedBaseUnit,
        purchase_unit: classification.suggestedPurchaseUnit,
        code: classification.suggestedCode,
      },
      confidence: classification.confidenceScore,
      duplicates: duplicates.map((d) => ({
        item_id: d.itemId,
        name: d.name,
        score: d.score,
        match_type: d.matchType,
      })),
      warnings: classification.warnings,
    })
  } catch (error) {
    console.error('[ai-classify] error:', error)
    return err('เกิดข้อผิดพลาดในการจัดหมวดหมู่')
  }
})
