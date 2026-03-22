import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const executeSchema = z.object({
    batchQty: z.number().positive('จำนวน batch ต้องมากกว่า 0'),
    note: z.string().optional(),
})

/**
 * POST /api/prep-recipes/[id]/execute
 *
 * รัน batch แปรรูป:
 * 1. ตัดวัตถุดิบออกจากสต็อค (ingredients × batchQty)
 * 2. เพิ่มผลผลิตเข้าสต็อค (outputQty × batchQty)
 * 3. บันทึก PrepBatch + StockMovements
 */
export const POST = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const params = await ctx.params
    const id = params?.id

    let body: any
    try { body = await req.json() } catch { return err('Invalid JSON', 400) }

    let data: z.infer<typeof executeSchema>
    try { data = executeSchema.parse(body) } catch (e: any) {
        return err(e.errors?.map((x: any) => x.message).join(', ') || 'ข้อมูลไม่ถูกต้อง')
    }

    // Load recipe with ingredients
    const recipe = await prisma.prepRecipe.findFirst({
        where: { id, tenantId, isActive: true },
        include: {
            ingredients: {
                include: {
                    product: { select: { id: true, name: true, costPrice: true, unit: true } },
                },
            },
            outputProduct: { select: { id: true, name: true, costPrice: true } },
        },
    })
    if (!recipe) return err('ไม่พบสูตร', 404)

    const warnings: string[] = []

    await prisma.$transaction(async tx => {
        // 1. Deduct each ingredient
        for (const ing of recipe.ingredients) {
            const deductQty = ing.quantity * data.batchQty

            // Upsert inventory record
            let inv = await tx.inventory.findFirst({
                where: { tenantId, productId: ing.productId, locationId: ing.locationId },
            })
            if (!inv) {
                inv = await tx.inventory.create({
                    data: {
                        tenantId,
                        productId: ing.productId,
                        locationId: ing.locationId,
                        quantity: 0,
                        avgCost: ing.product.costPrice,
                    },
                })
            }

            if (inv.quantity < deductQty) {
                warnings.push(`⚠️ ${ing.product.name}: สต็อคไม่พอ (มี ${inv.quantity} ${ing.unit}, ต้องการ ${deductQty} ${ing.unit})`)
            }

            await tx.inventory.update({
                where: { id: inv.id },
                data: { quantity: { decrement: deductQty } },
            })

            await tx.stockMovement.create({
                data: {
                    tenantId,
                    productId: ing.productId,
                    fromLocationId: ing.locationId,
                    quantity: deductQty,
                    unitCost: ing.product.costPrice,
                    totalCost: deductQty * ing.product.costPrice,
                    type: 'PREP_CONSUME',
                    referenceId: id,
                    referenceType: 'PREP_RECIPE',
                    note: `แปรรูป: ${recipe.name} × ${data.batchQty} batch`,
                    createdById: ctx.user?.userId || null,
                },
            })
        }

        // 2. Add output product to stock
        const outputTotal = recipe.outputQty * data.batchQty

        let outInv = await tx.inventory.findFirst({
            where: { tenantId, productId: recipe.outputProductId, locationId: recipe.outputLocationId },
        })
        if (!outInv) {
            outInv = await tx.inventory.create({
                data: {
                    tenantId,
                    productId: recipe.outputProductId,
                    locationId: recipe.outputLocationId,
                    quantity: 0,
                    avgCost: recipe.outputProduct.costPrice,
                },
            })
        }

        await tx.inventory.update({
            where: { id: outInv.id },
            data: { quantity: { increment: outputTotal } },
        })

        await tx.stockMovement.create({
            data: {
                tenantId,
                productId: recipe.outputProductId,
                toLocationId: recipe.outputLocationId,
                quantity: outputTotal,
                unitCost: recipe.outputProduct.costPrice,
                totalCost: outputTotal * recipe.outputProduct.costPrice,
                type: 'PREP_PRODUCE',
                referenceId: id,
                referenceType: 'PREP_RECIPE',
                note: `ผลผลิต: ${recipe.name} × ${data.batchQty} batch`,
                createdById: ctx.user?.userId || null,
            },
        })

        // 3. Record the batch
        await tx.prepBatch.create({
            data: {
                tenantId,
                recipeId: id,
                batchQty: data.batchQty,
                outputTotal,
                status: 'DONE',
                note: data.note,
                executedById: ctx.user?.userId || null,
            },
        })
    })

    return ok({
        message: `✅ แปรรูปสำเร็จ ${data.batchQty} batch → ได้ ${recipe.outputQty * data.batchQty} ${recipe.outputUnit}`,
        warnings: warnings.length > 0 ? warnings : undefined,
    })
}, ['OWNER', 'MANAGER'])
