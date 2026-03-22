import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

// GET /api/prep-recipes/[id]
export const GET = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id
    const recipe = await prisma.prepRecipe.findFirst({
        where: { id, tenantId },
        include: {
            outputProduct: { select: { id: true, name: true, sku: true, unit: true } },
            outputLocation: { select: { id: true, code: true, name: true } },
            ingredients: {
                include: {
                    product: { select: { id: true, name: true, sku: true, unit: true } },
                    location: { select: { id: true, code: true, name: true } },
                },
            },
            batches: {
                orderBy: { createdAt: 'desc' },
                take: 20,
            },
        },
    })
    if (!recipe) return err('ไม่พบสูตร', 404)
    return ok(recipe)
}, ['OWNER', 'MANAGER'])

// DELETE /api/prep-recipes/[id]
export const DELETE = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id
    const recipe = await prisma.prepRecipe.findFirst({ where: { id, tenantId } })
    if (!recipe) return err('ไม่พบสูตร', 404)
    // Soft delete
    await prisma.prepRecipe.update({ where: { id }, data: { isActive: false } })
    return ok({ deleted: true })
}, ['OWNER', 'MANAGER'])

// PUT /api/prep-recipes/[id] — update recipe + replace ingredients
export const PUT = withAuth(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId, params } = ctx
        const id = params?.id
        const body = await req.json()

        const recipe = await prisma.prepRecipe.findFirst({ where: { id, tenantId } })
        if (!recipe) return err('ไม่พบสูตร', 404)

        const { ingredients, ...fields } = body

        await prisma.$transaction(async tx => {
            // Update main fields
            await tx.prepRecipe.update({
                where: { id },
                data: {
                    name: fields.name ?? recipe.name,
                    outputProductId: fields.outputProductId ?? recipe.outputProductId,
                    outputQty: fields.outputQty ?? recipe.outputQty,
                    outputUnit: fields.outputUnit ?? recipe.outputUnit,
                    outputLocationId: fields.outputLocationId ?? recipe.outputLocationId,
                    note: fields.note,
                },
            })
            // Replace all ingredients if provided
            if (Array.isArray(ingredients)) {
                await tx.prepRecipeIngredient.deleteMany({ where: { recipeId: id } })
                await tx.prepRecipeIngredient.createMany({
                    data: ingredients.map((ing: any) => ({
                        tenantId,
                        recipeId: id,
                        productId: ing.productId,
                        quantity: ing.quantity,
                        unit: ing.unit,
                        locationId: ing.locationId,
                    })),
                })
            }
        })

        const updated = await prisma.prepRecipe.findUnique({
            where: { id },
            include: {
                outputProduct: { select: { id: true, name: true, sku: true, unit: true } },
                outputLocation: { select: { id: true, code: true, name: true } },
                ingredients: {
                    include: {
                        product: { select: { id: true, name: true, sku: true, unit: true } },
                        location: { select: { id: true, code: true, name: true } },
                    },
                },
            },
        })
        return ok(updated)
    } catch (e) {
        console.error('PrepRecipe update error:', e)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER'])
