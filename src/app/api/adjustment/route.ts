import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err, ApiHandler } from '@/lib/api'
import { z } from 'zod'
import { MovementType } from '@prisma/client'

const adjustSchema = z.object({
    locationId: z.string().min(1),
    reason: z.string().min(1),
    note: z.string().optional(),
    items: z.array(z.object({
        productId: z.string().min(1),
        actualQty: z.number().min(0),
    })).min(1),
})

// GET /api/adjustment
export const GET = withAuth(async (_req, context) => {
    const { tenantId } = (context as any)
    const adjustments = await prisma.stockAdjustment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
            adjustedBy: { select: { name: true } },
            _count: { select: { items: true } },
        },
    })
    return ok(adjustments)
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])

// POST /api/adjustment — ปรับสต็อค (นับของจริง)
export const POST = withAuth<any>(async (req: NextRequest, context) => {
    try {
        const { tenantId } = context as any
        const body = await req.json()
        const data = adjustSchema.parse(body)

        const result = await prisma.$transaction(async (tx) => {
            const adjustment = await tx.stockAdjustment.create({
                data: {
                    tenantId,
                    locationId: data.locationId,
                    status: 'APPROVED',
                    reason: data.reason,
                    note: data.note,
                    adjustedById: context.user?.userId,
                },
            })

            for (const item of data.items) {
                const inv = await tx.inventory.findUnique({
                    where: { productId_locationId: { productId: item.productId, locationId: data.locationId } },
                })
                const systemQty = inv?.quantity || 0
                const diffQty = item.actualQty - systemQty

                await tx.adjustmentItem.create({
                    data: {
                        tenantId,
                        adjustmentId: adjustment.id,
                        productId: item.productId,
                        locationId: data.locationId,
                        systemQty,
                        actualQty: item.actualQty,
                        diffQty,
                        unitCost: inv?.avgCost || 0,
                    },
                })

                // อัพเดตสต็อค
                await tx.inventory.upsert({
                    where: { productId_locationId_tenantId: { productId: item.productId, locationId: data.locationId, tenantId } },
                    update: { quantity: item.actualQty },
                    create: {
                        tenantId,
                        productId: item.productId,
                        locationId: data.locationId,
                        quantity: item.actualQty,
                        avgCost: 0,
                    },
                })

                // Stock movement (ถ้ามีส่วนต่าง)
                if (diffQty !== 0) {
                    await tx.stockMovement.create({
                        data: {
                            tenantId,
                            productId: item.productId,
                            ...(diffQty > 0 ? { toLocationId: data.locationId } : { fromLocationId: data.locationId }),
                            quantity: Math.abs(diffQty),
                            unitCost: inv?.avgCost || 0,
                            totalCost: Math.abs(diffQty) * (inv?.avgCost || 0),
                            type: MovementType.ADJUSTMENT,
                            referenceId: adjustment.id,
                            referenceType: 'ADJUSTMENT',
                            note: `${data.reason}: ระบบ ${systemQty} → จริง ${item.actualQty}`,
                            createdById: context.user?.userId,
                        },
                    })
                }
            }

            return adjustment
        })

        return ok({ id: result.id })
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('Adjustment error:', error)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])