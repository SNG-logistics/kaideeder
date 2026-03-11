import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// ── Category code → SKU prefix mapping ──────────────────────────────────────
// Must match codes in upsert-categories.js
const SKU_PREFIX: Record<string, string> = {
    // INGREDIENT
    PROTEIN_PORK: 'PP',
    PROTEIN_MEAT: 'PM',
    SEAFOOD:      'SF',
    EGG:          'EG',
    DAIRY:        'DY',
    VEGHERB:      'VH',
    MUSHROOM:     'MR',
    DRY_GOODS:    'DG',
    FROZEN:       'FZ',
    // SUPPLY
    BOX_BAG:      'BB',
    TISSUE_CLEAN: 'TC',
    DISPOSABLE:   'DS',
    // ALCOHOL
    BEER:         'B',
    BEER_DRAFT:   'BD',
    WINE:         'W',
    SOJU:         'SJ',
    // NON-ALCOHOL
    WATER:        'WI',
    SOFT_DRINK:   'SD',
    // CAFE
    COFFEE:       'CF',
    TEA:          'TE',
    SMOOTHIE:     'SM',
    // FOOD
    FOOD_GRILL:   'FG',
    FOOD_FRY:     'FF',
    FOOD_BOIL:    'FB',
    FOOD_SALAD:   'FL',
    FOOD_STIR:    'FS',
    FOOD_SNACK:   'FK',
    FOOD_SEA:     'FE',
    FOOD_RICE:    'FR',
    // OTHER
    SET:          'ST',
    KARAOKE:      'KR',
    ENTERTAIN:    'EN',
    OTHER:        'OT',
    // Legacy codes (keep for backward compatibility)
    DRINK:        'D',
    COCKTAIL:     'CK',
    FOOD_NOODLE:  'FN',
    FOOD_VEG:     'FV',
    FOOD_LAAB:    'FA',
    RAW_MEAT:     'RM',
    RAW_PORK:     'RP',
    RAW_VEG:      'RV',
    PACKAGING:    'PK',
}

// GET /api/products/next-sku?categoryId=xxx
export const GET = withAuth(async (req: NextRequest, ctx) => {
    const url = new URL(req.url)
    const categoryId = url.searchParams.get('categoryId')
    if (!categoryId) return err('กรุณาระบุ categoryId')

    const category = await prisma.category.findUnique({ where: { id: categoryId } })
    if (!category) return err('ไม่พบหมวดหมู่')

    // Use mapped prefix, or derive from first 2 uppercase letters of code
    const prefix = SKU_PREFIX[category.code] ?? category.code.slice(0, 2).toUpperCase()

    const existing = await prisma.product.findMany({
        where: {
            tenantId: ctx.tenantId,
            sku: { startsWith: prefix },
        },
        select: { sku: true },
    })

    const exactMatches = existing.filter(p => {
        const rest = p.sku.slice(prefix.length)
        return /^\d+$/.test(rest)
    })

    let nextNum = 1
    if (exactMatches.length > 0) {
        const maxNum = Math.max(...exactMatches.map(p => parseInt(p.sku.slice(prefix.length)) || 0))
        nextNum = maxNum + 1
    }

    const nextSku = `${prefix}${String(nextNum).padStart(2, '0')}`

    return ok({ prefix, nextSku, categoryCode: category.code })
})
