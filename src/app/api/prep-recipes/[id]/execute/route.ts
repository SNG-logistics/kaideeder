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
 * 1. ตัดวัตถุดิบออกจากสต็อค (lines × ratio)
 * 2. เพิ่มผลผลิตเข้าสต็อค  (producedQty)
 * 3. บันทึก PrepProduction + StockMovements
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

    // Load recipe with lines
    const recipe = await prisma.prepRecipe.findFirst({
        where: { id, tenantId, isActive: true },
        include: {
            lines: {
                include: {
                    product: { select: { id: true, name: true, costPrice: true, unit: true } },
                },
            },
            outputProduct: { select: { id: true, name: true, costPrice: true } },
        },
    })
    if (!recipe) return err('ไม่พบสูตร', 404)

    // Calculate producedQty based on batchQty
    const ratio = data.batchQty
    const producedQty = data.batchQty * recipe.yieldQty
    const warnings: string[] = []

    await prisma.$transaction(async tx => {
        // 1. Deduct each ingredient (scaled by ratio)
        for (const line of recipe.lines) {
            const deductQty = line.quantity * ratio

            // Upsert inventory record
            let inv = await tx.inventory.findFirst({
                where: { tenantId, productId: line.productId, locationId: line.locationId },
            })
            if (!inv) {
                inv = await tx.inventory.create({
                    data: {
                        tenantId,
                        productId: line.productId,
                        locationId: line.locationId,
                        quantity: 0,
                        avgCost: line.product.costPrice ?? 0,
                    },
                })
            }

            if (inv.quantity < deductQty) {
                warnings.push(`⚠️ ${line.product.name}: สต็อคไม่พอ (มี ${inv.quantity} ${line.unit}, ต้องการ ${deductQty.toFixed(2)} ${line.unit})`)
            }

            await tx.inventory.update({
                where: { id: inv.id },
                data: { quantity: { decrement: deductQty } },
            })

            await tx.stockMovement.create({
                data: {
                    tenantId,
                    productId: line.productId,
                    fromLocationId: line.locationId,
                    quantity: deductQty,
                    unitCost: line.product.costPrice ?? 0,
                    totalCost: deductQty * (line.product.costPrice ?? 0),
                    type: 'PRODUCTION_OUT',
                    referenceId: id,
                    referenceType: 'PREP_RECIPE',
                    note: `แปรรูป: ${recipe.name} → ผลิต ${producedQty} ${recipe.yieldUnit}`,
                    createdById: ctx.user?.userId || null,
                },
            })
        }

        // 2. Add output product to stock
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
                    avgCost: recipe.outputProduct.costPrice ?? 0,
                },
            })
        }

        await tx.inventory.update({
            where: { id: outInv.id },
            data: { quantity: { increment: producedQty } },
        })

        await tx.stockMovement.create({
            data: {
                tenantId,
                productId: recipe.outputProductId,
                toLocationId: recipe.outputLocationId,
                quantity: producedQty,
                unitCost: recipe.outputProduct.costPrice ?? 0,
                totalCost: producedQty * (recipe.outputProduct.costPrice ?? 0),
                type: 'PRODUCTION_IN',
                referenceId: id,
                referenceType: 'PREP_RECIPE',
                note: `ผลผลิต: ${recipe.name}`,
                createdById: ctx.user?.userId || null,
            },
        })

        // 3. Record the production
        await tx.prepProduction.create({
            data: {
                tenantId,
                prepRecipeId: id,
                producedQty: producedQty,
                locationId: recipe.outputLocationId,
                note: data.note,
                preparedById: ctx.user?.userId || null,
            },
        })
    })

    return ok({
        message: `✅ แปรรูปสำเร็จ → ได้ ${producedQty} ${recipe.yieldUnit} (${recipe.name})`,
        warnings: warnings.length > 0 ? warnings : undefined,
    })
}, ['OWNER', 'MANAGER'])
