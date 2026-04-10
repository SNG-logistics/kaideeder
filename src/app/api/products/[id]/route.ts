import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/products/[id]
export const GET = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const raw = await prisma.product.findFirst({
        where: { id: params?.id, tenantId },
        include: {
            category: true,
            inventory: { include: { location: true } },
            bom: { include: { recipe: true } },
        },
    })
    if (!raw) return err('ไม่พบสินค้า', 404)
    const imageUrl = raw.imageBase64
        ? `data:image/webp;base64,${raw.imageBase64}`
        : raw.imageUrl || null
    const { imageBase64, ...rest } = raw
    return ok({ ...rest, imageUrl })
})

// PATCH /api/products/[id]
export const PATCH = withAuth(async (req: NextRequest, ctx) => {
    try {
        const { tenantId } = ctx as any
        const params = await ctx.params
        const body = await req.json()
        const existing = await prisma.product.findFirst({ where: { id: params?.id, tenantId } })
        if (!existing) return err('ไม่พบสินค้า', 404)

        // Whitelist only safe fields — never pass raw body to Prisma
        const {
            sku, name, nameTh, nameLao, categoryId, productType,
            unit, unitAlt, convFactor, costPrice, salePrice,
            reorderPoint, minQty, isActive, isFeatured, note,
            imageUrl, inventoryItemId, toppingsJson,
        } = body
        const updateData: Record<string, unknown> = {}
        if (sku !== undefined) updateData.sku = sku
        if (name !== undefined) updateData.name = name
        if (nameTh !== undefined) updateData.nameTh = nameTh
        if (nameLao !== undefined) updateData.nameLao = nameLao
        if (categoryId !== undefined) updateData.categoryId = categoryId
        if (productType !== undefined) updateData.productType = productType
        if (unit !== undefined) updateData.unit = unit
        if (unitAlt !== undefined) updateData.unitAlt = unitAlt
        if (convFactor !== undefined) updateData.convFactor = convFactor
        if (costPrice !== undefined) updateData.costPrice = Number(costPrice)
        if (salePrice !== undefined) updateData.salePrice = Number(salePrice)
        if (reorderPoint !== undefined) updateData.reorderPoint = reorderPoint
        if (minQty !== undefined) updateData.minQty = minQty
        if (isActive !== undefined) updateData.isActive = isActive
        if (isFeatured !== undefined) updateData.isFeatured = isFeatured
        if (note !== undefined) updateData.note = note
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl
        if (inventoryItemId !== undefined) updateData.inventoryItemId = inventoryItemId
        if (toppingsJson !== undefined) updateData.toppingsJson = toppingsJson  // ✅ topping support

        const product = await prisma.product.update({
            where: { id: params?.id },
            data: updateData,
            include: { category: true },
        })
        return ok(product)
    } catch (e) {
        console.error('PATCH product error:', e)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])


// DELETE /api/products/[id] (soft delete)
export const DELETE = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const existing = await prisma.product.findFirst({ where: { id: params?.id, tenantId } })
    if (!existing) return err('ไม่พบสินค้า', 404)
    await prisma.product.update({
        where: { id: params?.id },
        data: { isActive: false },
    })
    return ok({ deleted: true })
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])
