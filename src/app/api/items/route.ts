import { NextRequest } from 'next/server'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { normalizeName } from '@/lib/inventory/normalize'
import { validateItem } from '@/lib/inventory/validation'
import { checkDuplicates } from '@/lib/inventory/duplicate-check'
import {
  CONFIDENCE_REVIEW_THRESHOLD,
  CONFIDENCE_RECOMMENDATION_THRESHOLD,
} from '@/lib/inventory/ai-classifier'
import type { ItemRole, ItemKind, ItemStatus, AiItemStatus, Prisma } from '@prisma/client'

// ── GET /api/items ────────────────────────────────────────────────────────────
export const GET = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const role = searchParams.get('role') as ItemRole | null
  const status = searchParams.get('status') as ItemStatus | null
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))

  const where = {
    tenantId,
    ...(role ? { itemRole: role } : {}),
    ...(status ? { status } : { status: { not: 'ARCHIVED' as ItemStatus } }),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { normalizedName: { contains: normalizeName(search) } },
            { code: { contains: search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        conversions: true,
        _count: { select: { issues: { where: { status: 'OPEN' } } } },
      },
    }),
    prisma.inventoryItem.count({ where }),
  ])

  return ok({ items, total, page, limit })
})

// ── POST /api/items ───────────────────────────────────────────────────────────
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  const tenantId = ctx.tenantId
  const userId = ctx.user?.userId ?? null

  try {
    const body = await req.json()

    const name: string = body.name?.trim() ?? ''
    if (!name) return err('กรุณาระบุชื่อรายการ')

    const itemRole: ItemRole = body.itemRole ?? body.item_role
    const itemKind: ItemKind = body.itemKind ?? body.item_kind
    const baseUnit: string = body.baseUnit ?? body.base_unit ?? ''

    if (!itemRole) return err('กรุณาระบุประเภทรายการ (itemRole)')
    if (!itemKind) return err('กรุณาระบุชนิดรายการ (itemKind)')
    if (!baseUnit) return err('กรุณาระบุหน่วยฐาน (baseUnit)')

    const normalizedName = normalizeName(name)

    // Derive status from AI confidence
    const aiConfidence: number | undefined = body.aiConfidence ?? body.ai_confidence
    let status: ItemStatus = 'DRAFT'
    if (aiConfidence !== undefined && aiConfidence < CONFIDENCE_REVIEW_THRESHOLD) {
      status = 'NEED_REVIEW'
    }

    // Auto-generate code if not supplied
    const code: string =
      body.code?.trim() || `${itemRole}_${(body.categoryKey || body.category_key || 'ITEM').toUpperCase()}_${Date.now()}`

    const item = await prisma.inventoryItem.create({
      data: {
        tenantId,
        code,
        name,
        normalizedName,
        itemRole,
        itemKind,
        categoryKey: body.categoryKey ?? body.category_key ?? null,
        proteinFamily: body.proteinFamily ?? body.protein_family ?? null,
        speciesType: body.speciesType ?? body.species_type ?? null,
        cutPart: body.cutPart ?? body.cut_part ?? null,
        formState: body.formState ?? body.form_state ?? null,
        baseUnit,
        purchaseUnit: body.purchaseUnit ?? body.purchase_unit ?? null,
        trackStock: body.trackStock ?? body.track_stock ?? true,
        isPurchasable: body.isPurchasable ?? body.is_purchasable ?? true,
        isSellable: body.isSellable ?? body.is_sellable ?? false,
        status,
        aiConfidence: aiConfidence ?? null,
        aiStatus: aiConfidence !== undefined ? ('AI_SUGGESTED' as AiItemStatus) : null,
        createdById: userId,
      },
    })

    // Fetch conversions for validation (none yet — just created)
    const issues = await validateItem(item, [])

    // Persist validation issues
    if (issues.length > 0) {
      await prisma.validationIssue.createMany({
        data: issues.map((issue) => ({
          tenantId,
          entityType: 'ITEM',
          entityId: item.id,
          issueCode: issue.issueCode,
          severity: issue.severity,
          message: issue.message,
          detailsJson: (issue.detailsJson ?? {}) as unknown as Prisma.InputJsonValue,
        })),
      })
    }

    // Create AiRecommendation if confidence is below recommendation threshold
    if (aiConfidence !== undefined && aiConfidence < CONFIDENCE_RECOMMENDATION_THRESHOLD) {
      await prisma.aiRecommendation.create({
        data: {
          tenantId,
          entityType: 'ITEM',
          entityId: item.id,
          recommendationType: 'FIX_METADATA',
          title: `รายการ "${name}" ต้องการการตรวจสอบ (confidence ${Math.round(aiConfidence * 100)}%)`,
          detailsJson: {
            reason: 'AI confidence ต่ำกว่าเกณฑ์',
            confidence: aiConfidence,
            threshold: CONFIDENCE_RECOMMENDATION_THRESHOLD,
          },
          confidenceScore: aiConfidence,
          riskLevel: aiConfidence < 0.4 ? 'HIGH' : 'MEDIUM',
        },
      })
    }

    // Create duplicate recommendation if duplicates found
    const duplicates = await checkDuplicates({ tenantId, name, excludeId: item.id })
    if (duplicates.length > 0) {
      await prisma.aiRecommendation.create({
        data: {
          tenantId,
          entityType: 'ITEM',
          entityId: item.id,
          recommendationType: 'REVIEW_DUPLICATE',
          title: `พบรายการชื่อใกล้เคียง "${name}" — กรุณาตรวจสอบ`,
          detailsJson: { candidates: duplicates.slice(0, 5) } as unknown as Prisma.InputJsonValue,
          confidenceScore: duplicates[0].score,
          riskLevel: 'MEDIUM',
        },
      })
    }

    return ok({ item, issueCount: issues.length }, 201)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return err('รหัสรายการ (code) ซ้ำกับที่มีอยู่แล้ว', 409)
    }
    console.error('[POST /api/items] error:', error)
    return err('เกิดข้อผิดพลาดในการบันทึก')
  }
})
