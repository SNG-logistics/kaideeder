import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const ingredientSchema = z.object({
    productId: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().min(1),
    locationId: z.string().min(1),
})

const recipeSchema = z.object({
    name: z.string().min(1, 'ต้องระบุชื่อสูตร'),
    outputProductId: z.string().min(1),
    outputQty: z.number().positive(),
    outputUnit: z.string().min(1),
    outputLocationId: z.string().min(1),
    note: z.string().optional(),
    ingredients: z.array(ingredientSchema).min(1, 'ต้องมีวัตถุดิบอย่างน้อย 1 รายการ'),
})

// GET /api/prep-recipes — list all prep recipes
export const GET = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const recipes = await prisma.prepRecipe.findMany({
        where: { tenantId, isActive: true },
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
                take: 5,
            },
        },
        orderBy: { createdAt: 'desc' },
    })
    return ok(recipes)
}, ['OWNER', 'MANAGER'])

// POST /api/prep-recipes — create a new prep recipe
export const POST = withAuth(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId } = ctx
        const body = await req.json()
        const data = recipeSchema.parse(body)

        // Verify output product belongs to tenant
        const outputProduct = await prisma.product.findFirst({
            where: { id: data.outputProductId, tenantId },
        })
        if (!outputProduct) return err('ไม่พบสินค้าผลผลิต')

        // Verify output location
        const outputLocation = await prisma.location.findFirst({
            where: { id: data.outputLocationId, tenantId },
        })
        if (!outputLocation) return err('ไม่พบคลังผลผลิต')

        // Create recipe + ingredients in one transaction
        const recipe = await prisma.prepRecipe.create({
            data: {
                tenantId,
                name: data.name,
                outputProductId: data.outputProductId,
                outputQty: data.outputQty,
                outputUnit: data.outputUnit,
                outputLocationId: data.outputLocationId,
                note: data.note,
                ingredients: {
                    create: data.ingredients.map(ing => ({
                        tenantId,
                        productId: ing.productId,
                        quantity: ing.quantity,
                        unit: ing.unit,
                        locationId: ing.locationId,
                    })),
                },
            },
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
        return ok(recipe)
    } catch (e) {
        if (e instanceof z.ZodError) return err(e.errors.map(x => x.message).join(', '))
        console.error('PrepRecipe create error:', e)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER'])
