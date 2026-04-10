import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

const include = {
    outputProduct: { select: { id: true, name: true, sku: true, unit: true } },
    outputLocation: { select: { id: true, code: true, name: true } },
    lines: {
        include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
            location: { select: { id: true, code: true, name: true } },
        },
    },
    productions: {
        orderBy: { producedAt: 'desc' as const },
        take: 20,
        include: {
            location: { select: { id: true, code: true, name: true } },
        },
    },
}

// GET /api/prep-recipes/[id]
export const GET = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id
    const recipe = await prisma.prepRecipe.findFirst({ where: { id, tenantId }, include })
    if (!recipe) return err('ไม่พบสูตร', 404)
    return ok(recipe)
}, ['OWNER', 'MANAGER'])

// PUT /api/prep-recipes/[id]
export const PUT = withAuth(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId, params } = ctx
        const id = params?.id
        const body = await req.json()

        const recipe = await prisma.prepRecipe.findFirst({ where: { id, tenantId } })
        if (!recipe) return err('ไม่พบสูตร', 404)

        const { ingredients, ...fields } = body

        await prisma.$transaction(async tx => {
            await tx.prepRecipe.update({
                where: { id },
                data: {
                    name: fields.name ?? recipe.name,
                    outputProductId: fields.outputProductId ?? recipe.outputProductId,
                    outputLocationId: fields.outputLocationId ?? recipe.outputLocationId,
                    yieldQty: fields.outputQty ?? recipe.yieldQty,
                    yieldUnit: fields.outputUnit ?? recipe.yieldUnit,
                    note: fields.note ?? recipe.note,
                    isActive: fields.isActive ?? recipe.isActive,
                },
            })
            if (Array.isArray(ingredients)) {
                await tx.prepRecipeLine.deleteMany({ where: { prepRecipeId: id } })
                if (ingredients.length > 0) {
                    await tx.prepRecipeLine.createMany({
                        data: ingredients.map((l: any) => ({
                            tenantId,
                            prepRecipeId: id,
                            productId: l.productId,
                            quantity: l.quantity,
                            unit: l.unit,
                            locationId: l.locationId,
                        })),
                    })
                }
            }
        })

        const updated = await prisma.prepRecipe.findUnique({ where: { id }, include })
        return ok(updated)
    } catch (e) {
        console.error('PrepRecipe put error:', e)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER'])

// DELETE /api/prep-recipes/[id]  — soft delete
export const DELETE = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id
    const recipe = await prisma.prepRecipe.findFirst({ where: { id, tenantId } })
    if (!recipe) return err('ไม่พบสูตร', 404)
    await prisma.prepRecipe.update({ where: { id }, data: { isActive: false } })
    return ok({ deleted: true })
}, ['OWNER', 'MANAGER'])
