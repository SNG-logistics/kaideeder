import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const executeSchema = z.object({
    producedQty:     z.number().positive('จำนวนที่ผลิตต้องมากกว่า 0'),
    sourceLocationId: z.string().min(1, 'กรุณาเลือกคลังวัตถุดิบ'),  // ตัดวัตถุดิบจากคลังนี้
    outputLocationId: z.string().min(1, 'กรุณาเลือกคลังผลผลิต'),    // เก็บผลผลิตที่คลังนี้
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

    // Calculate ratio: producedQty / yieldQty per batch
    const ratio = data.producedQty / recipe.yieldQty
    const warnings: string[] = []

    await prisma.$transaction(async tx => {
        // 1. Deduct each ingredient (scaled by ratio)
        for (const line of recipe.lines) {
            const deductQty = line.quantity * ratio

            // Upsert inventory record
            let inv = await tx.inventory.findFirst({
                where: { tenantId, productId: line.productId, locationId: data.sourceLocationId },
            })
            if (!inv) {
                inv = await tx.inventory.create({
                    data: {
                        tenantId,
                        productId: line.productId,
                        locationId: data.sourceLocationId,
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
                    fromLocationId: data.sourceLocationId,
                    quantity: deductQty,
                    unitCost: line.product.costPrice ?? 0,
                    totalCost: deductQty * (line.product.costPrice ?? 0),
                    type: 'PRODUCTION_OUT',
                    referenceId: id,
                    referenceType: 'PREP_RECIPE',
                    note: `แปรรูป: ${recipe.name} → ผลิต ${data.producedQty} ${recipe.yieldUnit}`,
                    createdById: ctx.user?.userId || null,
                },
            })
        }

        // 2. Add output product to stock
        let outInv = await tx.inventory.findFirst({
            where: { tenantId, productId: recipe.outputProductId, locationId: data.outputLocationId },
        })
        if (!outInv) {
            outInv = await tx.inventory.create({
                data: {
                    tenantId,
                    productId: recipe.outputProductId,
                    locationId: data.outputLocationId,
                    quantity: 0,
                    avgCost: recipe.outputProduct.costPrice ?? 0,
                },
            })
        }

        await tx.inventory.update({
            where: { id: outInv.id },
            data: { quantity: { increment: data.producedQty } },
        })

        await tx.stockMovement.create({
            data: {
                tenantId,
                productId: recipe.outputProductId,
                toLocationId: data.outputLocationId,
                quantity: data.producedQty,
                unitCost: recipe.outputProduct.costPrice ?? 0,
                totalCost: data.producedQty * (recipe.outputProduct.costPrice ?? 0),
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
                producedQty: data.producedQty,
                locationId: data.outputLocationId,
                note: data.note,
                preparedById: ctx.user?.userId || null,
            },
        })
    })

    return ok({
        message: `✅ แปรรูปสำเร็จ → ได้ ${data.producedQty} ${recipe.yieldUnit} (${recipe.name})`,
        warnings: warnings.length > 0 ? warnings : undefined,
    })
}, ['OWNER', 'MANAGER'])
