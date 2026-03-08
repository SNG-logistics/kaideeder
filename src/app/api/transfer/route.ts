import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'
import { MovementType, TransferStatus } from '@prisma/client'

const transferSchema = z.object({
    fromLocationId: z.string().min(1),
    toLocationId: z.string().min(1),
    note: z.string().optional(),
    items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
    })).min(1),
})

// GET /api/transfer
export const GET = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const transfers = await prisma.stockTransfer.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
            fromLocation: true,
            toLocation: true,
            requestedBy: { select: { name: true } },
            items: true,
            _count: { select: { items: true } },
        },
    })
    return ok(transfers)
})

// POST /api/transfer — เบิก/โอนระหว่างคลัง
export const POST = withAuth(async (req: NextRequest, { user, tenantId }: any) => {
    try {
        const body = await req.json()
        const data = transferSchema.parse(body)

        if (data.fromLocationId === data.toLocationId) {
            return err('คลังต้นทางและปลายทางต้องไม่เหมือนกัน')
        }

        const result = await prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.create({
                data: {
                    tenantId,
                    fromLocationId: data.fromLocationId,
                    toLocationId: data.toLocationId,
                    status: TransferStatus.COMPLETED,
                    note: data.note,
                    requestedById: user?.userId,
                    items: {
                        create: data.items.map(item => ({
                            tenantId,
                            productId: item.productId,
                            quantity: item.quantity,
                        })),
                    },
                },
                include: { items: true },
            })

            for (const item of transfer.items) {
                // ลดสต็อคจากคลังต้นทาง
                const fromInv = await tx.inventory.findUnique({
                    where: { tenantId_productId_locationId: { tenantId, productId: item.productId, locationId: data.fromLocationId } },
                })
                if (!fromInv || fromInv.quantity < item.quantity) {
                    throw new Error(`สต็อคไม่พอ: ${item.productId}`)
                }

                await tx.inventory.update({
                    where: { tenantId_productId_locationId: { tenantId, productId: item.productId, locationId: data.fromLocationId } },
                    data: { quantity: { decrement: item.quantity } },
                })

                // เพิ่มสต็อคคลังปลายทาง — B-03 Fix: merge WAC ถ้ามีสต็อคเดิม
                const fromCost = fromInv.avgCost
                const toInv = await tx.inventory.findUnique({
                    where: { tenantId_productId_locationId: { tenantId, productId: item.productId, locationId: data.toLocationId } },
                })
                // คำนวณ WAC ใหม่ที่ Destination
                const toQty = toInv?.quantity ?? 0
                const toCost = toInv?.avgCost ?? 0
                const newTotalQty = toQty + item.quantity
                const mergedAvgCost = newTotalQty > 0
                    ? (toQty * toCost + item.quantity * fromCost) / newTotalQty
                    : fromCost

                await tx.inventory.upsert({
                    where: { tenantId_productId_locationId: { tenantId, productId: item.productId, locationId: data.toLocationId } },
                    update: { quantity: { increment: item.quantity }, avgCost: mergedAvgCost },
                    create: {
                        tenantId,
                        productId: item.productId,
                        locationId: data.toLocationId,
                        quantity: item.quantity,
                        avgCost: fromCost,
                    },
                })


                // Stock movement
                await tx.stockMovement.create({
                    data: {
                        tenantId,
                        productId: item.productId,
                        fromLocationId: data.fromLocationId,
                        toLocationId: data.toLocationId,
                        quantity: item.quantity,
                        unitCost: fromCost,
                        totalCost: item.quantity * fromCost,
                        type: MovementType.TRANSFER,
                        referenceId: transfer.id,
                        referenceType: 'TRANSFER',
                        createdById: user?.userId,
                    },
                })
            }

            return transfer
        })

        return ok({ id: result.id, items: result.items.length })
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('Transfer error:', error)
        return err(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'WAREHOUSE', 'KITCHEN', 'BAR'])
