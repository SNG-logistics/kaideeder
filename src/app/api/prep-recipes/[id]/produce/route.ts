import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const produceSchema = z.object({
    producedQty: z.number().positive('ผลิตได้ต้องมากกว่า 0'),
    locationId: z.string().min(1, 'ต้องระบุคลังเก็บผลผลิต'),
    note: z.string().optional(),
})

/**
 * POST /api/prep-recipes/[id]/produce
 *
 * บันทึกการผลิต Prep Item:
 * 1. คำนวณ ratio = producedQty / recipe.yieldQty
 * 2. สำหรับทุก line: neededQty = line.quantity × ratio
 *    - ตัด inventory ของวัตถุดิบดิบ (ค้นหาจาก product ทุก location)
 *    - สร้าง StockMovement(PRODUCTION_OUT)
 * 3. เพิ่ม inventory ของ outputProduct ที่ locationId
 *    - สร้าง StockMovement(PRODUCTION_IN)
 * 4. สร้าง PrepProduction record
 * ⚠️ วัตถุดิบไม่พอ → warn แต่ไม่ block
 */
export const POST = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const params = await ctx.params
    const id = params?.id

    let body: any
    try { body = await req.json() } catch { return err('Invalid JSON') }

    let data: z.infer<typeof produceSchema>
    try { data = produceSchema.parse(body) } catch (e: any) {
        return err(e.errors?.map((x: any) => x.message).join(', ') || 'ข้อมูลไม่ถูกต้อง')
    }

    // Load recipe + lines + output product
    const recipe = await prisma.prepRecipe.findFirst({
        where: { id, tenantId, isActive: true },
        include: {
            lines: {
                include: { product: { select: { id: true, name: true, costPrice: true } } },
            },
            outputProduct: { select: { id: true, name: true, costPrice: true, unit: true } },
        },
    })
    if (!recipe) return err('ไม่พบสูตร', 404)

    // Verify location
    const location = await prisma.location.findFirst({ where: { id: data.locationId, tenantId } })
    if (!location) return err('ไม่พบคลัง')

    const ratio = data.producedQty / recipe.yieldQty
    const warnings: string[] = []

    await prisma.$transaction(async tx => {
        // 1. Deduct each raw ingredient
        for (const line of recipe.lines) {
            const neededQty = line.quantity * ratio

            // Find best inventory location (highest qty first)
            const inventories = await tx.inventory.findMany({
                where: { tenantId, productId: line.productId, quantity: { not: 0 } },
                include: { location: { select: { code: true } } },
                orderBy: { quantity: 'desc' },
            })

            if (inventories.length === 0) {
                warnings.push(`⚠️ ${line.product.name}: ไม่มีสต็อค (ต้องการ ${neededQty.toFixed(2)} ${line.unit})`)
                continue
            }

            const totalAvail = inventories.reduce((s, i) => s + i.quantity, 0)
            if (totalAvail < neededQty) {
                warnings.push(`⚠️ ${line.product.name}: สต็อคไม่พอ (มี ${totalAvail.toFixed(2)}, ต้องการ ${neededQty.toFixed(2)} ${line.unit})`)
            }

            // Deduct from first available location
            const inv = inventories[0]
            await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { decrement: neededQty } } })

            await tx.stockMovement.create({
                data: {
                    tenantId,
                    productId: line.productId,
                    fromLocationId: inv.locationId,
                    quantity: neededQty,
                    unitCost: line.product.costPrice,
                    totalCost: neededQty * line.product.costPrice,
                    type: 'PRODUCTION_OUT',
                    referenceId: id,
                    referenceType: 'PREP_PRODUCTION',
                    note: `แปรรูป: ${recipe.name} (ผลิต ${data.producedQty} ${recipe.yieldUnit})`,
                    createdById: ctx.user?.userId || null,
                },
            })
        }

        // 2. Add output product to stock at chosen location
        const outInv = await tx.inventory.findFirst({
            where: { tenantId, productId: recipe.outputProductId, locationId: data.locationId },
        })
        if (outInv) {
            await tx.inventory.update({
                where: { id: outInv.id },
                data: { quantity: { increment: data.producedQty } },
            })
        } else {
            await tx.inventory.create({
                data: {
                    tenantId,
                    productId: recipe.outputProductId,
                    locationId: data.locationId,
                    quantity: data.producedQty,
                    avgCost: recipe.outputProduct.costPrice,
                },
            })
        }

        await tx.stockMovement.create({
            data: {
                tenantId,
                productId: recipe.outputProductId,
                toLocationId: data.locationId,
                quantity: data.producedQty,
                unitCost: recipe.outputProduct.costPrice,
                totalCost: data.producedQty * recipe.outputProduct.costPrice,
                type: 'PRODUCTION_IN',
                referenceId: id,
                referenceType: 'PREP_PRODUCTION',
                note: `ผลผลิต: ${recipe.name}`,
                createdById: ctx.user?.userId || null,
            },
        })

        // 3. Record PrepProduction
        await tx.prepProduction.create({
            data: {
                tenantId,
                prepRecipeId: id,
                producedQty: data.producedQty,
                locationId: data.locationId,
                preparedById: ctx.user?.userId || null,
                note: data.note,
            },
        })
    })

    return ok({
        message: `✅ ผลิตสำเร็จ: ${recipe.name} ${data.producedQty} ${recipe.yieldUnit} → คลัง ${location.code}`,
        warnings: warnings.length > 0 ? warnings : undefined,
    })
}, ['OWNER', 'MANAGER'])
