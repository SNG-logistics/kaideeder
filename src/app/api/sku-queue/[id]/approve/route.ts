import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'

/**
 * POST /api/sku-queue/[id]/approve
 * Body: { action: 'map' | 'new', targetProductId?, editedName?, editedUnit?, editedCategory?, editedAlias? }
 *
 * action=map  → link rawName to matchedProduct (or targetProductId) + create alias
 * action=new  → create new Product with suggestedSku (or a provided sku)
 */
export const POST = withAuth<any>(async (req: NextRequest, ctx: any) => {
    const { tenantId, userId } = ctx
    const id = ctx.params?.id as string
    const body = await req.json()
    const { action, targetProductId, editedName, editedUnit, editedCategoryCode, editedAlias } = body

    const suggestion = await prisma.skuSuggestion.findFirst({ where: { id, tenantId } })
    if (!suggestion) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
    if (suggestion.status !== 'PENDING') {
        return NextResponse.json({ error: 'รายการนี้ถูกจัดการแล้ว' }, { status: 409 })
    }

    const finalName = editedName || suggestion.rawName
    const finalUnit = editedUnit || suggestion.rawUnit || 'ชิ้น'
    const finalCatCode = editedCategoryCode || suggestion.rawCategory || 'OTHER'
    const aliasToCreate = editedAlias || suggestion.rawName

    // Resolve category
    const category = await prisma.category.findFirst({ where: { tenantId, code: finalCatCode } })
        ?? await prisma.category.findFirst({ where: { tenantId, code: 'OTHER' } })
    if (!category) return NextResponse.json({ error: 'ไม่พบ category' }, { status: 400 })

    // ── action: map ────────────────────────────────────────────────────────
    if (action === 'map') {
        const productId = targetProductId || suggestion.matchedProductId
        if (!productId) return NextResponse.json({ error: 'ต้องระบุ targetProductId' }, { status: 400 })

        await prisma.productAlias.upsert({
            where: { tenantId_alias: { tenantId, alias: aliasToCreate.toLowerCase().trim() } },
            update: { productId },
            create: { tenantId, productId, alias: aliasToCreate.toLowerCase().trim(), source: 'manual' },
        })
        await prisma.skuSuggestion.update({
            where: { id },
            data: { status: 'APPROVED_MAP', resolvedById: userId, resolvedAt: new Date(), matchedProductId: productId },
        })
        await prisma.auditLog.create({
            data: {
                actorType: 'TENANT_USER', userId, tenantId,
                action: 'SKU_APPROVE_MAP',
                payload: { suggestionId: id, productId, alias: aliasToCreate } as any,
            },
        }).catch(() => { })

        return NextResponse.json({ success: true, action: 'map', productId })
    }

    // ── action: new ────────────────────────────────────────────────────────
    if (action === 'new') {
        const sku = suggestion.suggestedSku
        if (!sku) return NextResponse.json({ error: 'ไม่มี suggestedSku' }, { status: 400 })

        // Product type from category
        const RAW_CATS = new Set(['PROTEIN_PORK', 'PROTEIN_MEAT', 'SEAFOOD', 'EGG', 'DAIRY', 'VEGHERB', 'MUSHROOM', 'DRY_GOODS', 'FROZEN'])
        const SUPPLY_CATS = new Set(['BOX_BAG', 'TISSUE_CLEAN', 'DISPOSABLE'])
        const productType = RAW_CATS.has(finalCatCode) ? 'RAW_MATERIAL'
            : SUPPLY_CATS.has(finalCatCode) ? 'PACKAGING' : 'SALE_ITEM'

        const product = await prisma.product.create({
            data: {
                tenantId, sku,
                name: finalName,
                categoryId: category.id,
                productType: productType as any,
                unit: finalUnit,
                costPrice: suggestion.rawCostPrice ?? 0,
                salePrice: suggestion.rawSalePrice ?? 0,
                note: '[สร้างจากคิวอนุมัติ]',
            },
        })

        // Create alias if provided
        if (editedAlias) {
            await prisma.productAlias.upsert({
                where: { tenantId_alias: { tenantId, alias: editedAlias.toLowerCase().trim() } },
                update: { productId: product.id },
                create: { tenantId, productId: product.id, alias: editedAlias.toLowerCase().trim(), source: 'manual' },
            })
        }

        // Auto-create empty Recipe for food categories
        const FOOD_CATEGORIES = new Set(['FOOD_GRILL', 'FOOD_FRY', 'FOOD_BOIL', 'FOOD_SALAD', 'FOOD_STIR', 'FOOD_SNACK', 'FOOD_SEA', 'FOOD_RICE'])
        if (FOOD_CATEGORIES.has(finalCatCode)) {
            await prisma.recipe.create({ data: { tenantId, menuName: finalName, note: '[Auto] รอเพิ่มส่วนผสม' } }).catch(() => { })
        }

        await prisma.skuSuggestion.update({
            where: { id },
            data: { status: 'APPROVED_NEW', resolvedById: userId, resolvedAt: new Date() },
        })
        await prisma.auditLog.create({
            data: {
                actorType: 'TENANT_USER', userId, tenantId,
                action: 'SKU_APPROVE_NEW',
                payload: { suggestionId: id, sku, name: finalName } as any,
            },
        }).catch(() => { })

        return NextResponse.json({ success: true, action: 'new', sku, productId: product.id })
    }

    return NextResponse.json({ error: 'action ต้องเป็น map หรือ new' }, { status: 400 })
}, ['OWNER', 'MANAGER'])
