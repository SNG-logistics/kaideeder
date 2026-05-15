import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const ingredientSchema = z.object({
    rawMaterialId: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().min(1),
    locationId: z.string().min(1),
})

const toppingSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    price: z.number().min(0),
    isActive: z.boolean().default(true),
    ingredients: z.array(ingredientSchema),
})

const setupSchema = z.object({
    baseIngredients: z.array(ingredientSchema),
    toppings: z.array(toppingSchema),
})

// GET /api/stock-setup/[productId] — โหลด config ปัจจุบัน
export const GET = withAuth<any>(async (_req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const resolvedParams = await ctx.params
    const productId = resolvedParams?.productId
    if (!productId) return err('Missing productId', 400)

    const product = await prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true, name: true, sku: true, unit: true, toppingsJson: true },
    })
    if (!product) return err('ไม่พบเมนู', 404)

    // หา Base Recipe ตามชื่อเมนู
    const baseRecipe = await prisma.recipe.findFirst({
        where: { tenantId, menuName: product.name, isActive: true },
        include: {
            bom: {
                include: {
                    product: { select: { id: true, name: true, sku: true, unit: true } },
                },
            },
        },
    })

    // Parse toppings + โหลด recipe ของแต่ละ topping
    let toppingsConfig: any[] = []
    try {
        const rawToppings: any[] = product.toppingsJson ? JSON.parse(product.toppingsJson) : []
        for (const t of rawToppings) {
            let toppingRecipe = null
            if (t.recipeId) {
                toppingRecipe = await prisma.recipe.findFirst({
                    where: { id: t.recipeId, tenantId, isActive: true },
                    include: {
                        bom: {
                            include: {
                                product: { select: { id: true, name: true, sku: true, unit: true } },
                            },
                        },
                    },
                })
            }
            toppingsConfig.push({
                id: t.id,
                name: t.name,
                price: t.price ?? 0,
                isActive: t.isActive ?? true,
                recipeId: t.recipeId || null,
                ingredients: (toppingRecipe as any)?.bom?.map((b: any) => ({
                    rawMaterialId: b.productId,
                    rawMaterialName: b.product.name,
                    rawMaterialSku: b.product.sku,
                    rawMaterialUnit: b.product.unit,
                    quantity: b.quantity,
                    unit: b.unit,
                    locationId: b.locationId,
                    locationName: b.locationId,
                })) || [],
            })
        }
    } catch { /* ignore */ }

    return ok({
        product: { id: product.id, name: product.name, sku: product.sku },
        baseRecipeId: baseRecipe?.id || null,
        baseIngredients: (baseRecipe as any)?.bom?.map((b: any) => ({
            rawMaterialId: b.productId,
            rawMaterialName: b.product.name,
            rawMaterialSku: b.product.sku,
            rawMaterialUnit: b.product.unit,
            quantity: b.quantity,
            unit: b.unit,
            locationId: b.locationId,
            locationName: b.locationId,
        })) || [],
        toppings: toppingsConfig,
    })
}, ['OWNER', 'MANAGER'])

// POST /api/stock-setup/[productId] — บันทึกทุกอย่างครั้งเดียว
export const POST = withAuth<any>(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const resolvedParams = await ctx.params
    const productId = resolvedParams?.productId
    if (!productId) return err('Missing productId', 400)

    const product = await prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true, name: true },
    })
    if (!product) return err('ไม่พบเมนู', 404)

    const body = await req.json()
    const data = setupSchema.parse(body)

    // 1) Upsert Base Recipe
    let baseRecipeId: string | null = null
    if (data.baseIngredients.length > 0) {
        const existingRecipe = await prisma.recipe.findFirst({
            where: { tenantId, menuName: product.name, isActive: true },
        })
        if (existingRecipe) {
            // ลบ BOM เดิมทั้งหมด แล้วสร้างใหม่
            await prisma.recipeBOM.deleteMany({ where: { recipeId: existingRecipe.id } })
            await prisma.recipeBOM.createMany({
                data: data.baseIngredients.map(ing => ({
                    tenantId,
                    recipeId: existingRecipe.id,
                    productId: ing.rawMaterialId,
                    locationId: ing.locationId,
                    quantity: ing.quantity,
                    unit: ing.unit,
                })),
            })
            baseRecipeId = existingRecipe.id
        } else {
            const newRecipe = await prisma.recipe.create({
                data: {
                    tenantId,
                    menuName: product.name,
                    isActive: true,
                    bom: {
                        create: data.baseIngredients.map(ing => ({
                            tenantId,
                            productId: ing.rawMaterialId,
                            locationId: ing.locationId,
                            quantity: ing.quantity,
                            unit: ing.unit,
                        })),
                    },
                },
            })
            baseRecipeId = newRecipe.id
        }
    }

    // 2) Upsert Recipe สำหรับแต่ละ Topping + สร้าง toppingsJson ใหม่
    const finalToppings: any[] = []
    for (const top of data.toppings) {
        let toppingRecipeId: string | null = null

        if (top.ingredients.length > 0) {
            const toppingRecipeName = `[TOPPING] ${top.name}`
            const existingTopRecipe = await prisma.recipe.findFirst({
                where: { tenantId, menuName: toppingRecipeName, isActive: true },
            })
            if (existingTopRecipe) {
                await prisma.recipeBOM.deleteMany({ where: { recipeId: existingTopRecipe.id } })
                await prisma.recipeBOM.createMany({
                    data: top.ingredients.map(ing => ({
                        tenantId,
                        recipeId: existingTopRecipe.id,
                        productId: ing.rawMaterialId,
                        locationId: ing.locationId,
                        quantity: ing.quantity,
                        unit: ing.unit,
                    })),
                })
                toppingRecipeId = existingTopRecipe.id
            } else {
                const newTopRecipe = await prisma.recipe.create({
                    data: {
                        tenantId,
                        menuName: toppingRecipeName,
                        isActive: true,
                        bom: {
                            create: top.ingredients.map(ing => ({
                                tenantId,
                                productId: ing.rawMaterialId,
                                locationId: ing.locationId,
                                quantity: ing.quantity,
                                unit: ing.unit,
                            })),
                        },
                    },
                })
                toppingRecipeId = newTopRecipe.id
            }
        }

        finalToppings.push({
            id: top.id,
            name: top.name,
            price: top.price,
            isActive: top.isActive,
            recipeId: toppingRecipeId,
            recipeName: toppingRecipeId ? `[TOPPING] ${top.name}` : undefined,
        })
    }

    // 3) อัพเดท Product.toppingsJson
    await prisma.product.update({
        where: { id: productId },
        data: { toppingsJson: finalToppings.length > 0 ? JSON.stringify(finalToppings) : null },
    })

    return ok({ baseRecipeId, toppings: finalToppings })
}, ['OWNER', 'MANAGER'])
