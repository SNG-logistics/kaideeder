import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

const include = {
    outputProduct: { select: { id: true, name: true, sku: true, unit: true } },
    lines: {
        include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
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

// PATCH /api/prep-recipes/[id]
export const PATCH = withAuth(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId, params } = ctx
        const id = params?.id
        const body = await req.json()

        const recipe = await prisma.prepRecipe.findFirst({ where: { id, tenantId } })
        if (!recipe) return err('ไม่พบสูตร', 404)

        const { lines, ...fields } = body

        await prisma.$transaction(async tx => {
            await tx.prepRecipe.update({
                where: { id },
                data: {
                    name: fields.name ?? recipe.name,
                    outputProductId: fields.outputProductId ?? recipe.outputProductId,
                    yieldQty: fields.yieldQty ?? recipe.yieldQty,
                    yieldUnit: fields.yieldUnit ?? recipe.yieldUnit,
                    note: fields.note ?? recipe.note,
                    isActive: fields.isActive ?? recipe.isActive,
                },
            })
            if (Array.isArray(lines)) {
                await tx.prepRecipeLine.deleteMany({ where: { prepRecipeId: id } })
                if (lines.length > 0) {
                    await tx.prepRecipeLine.createMany({
                        data: lines.map((l: any) => ({
                            tenantId,
                            prepRecipeId: id,
                            productId: l.productId,
                            quantity: l.quantity,
                            unit: l.unit,
                        })),
                    })
                }
            }
        })

        const updated = await prisma.prepRecipe.findUnique({ where: { id }, include })
        return ok(updated)
    } catch (e) {
        console.error('PrepRecipe patch error:', e)
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
