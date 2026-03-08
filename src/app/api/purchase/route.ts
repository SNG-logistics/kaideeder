import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { calcWAC } from '@/lib/utils'
import { z } from 'zod'
import { MovementType, POStatus } from '@prisma/client'

const poSchema = z.object({
    supplierId: z.string().optional(),
    purchaseDate: z.string().optional(),
    note: z.string().optional(),
    items: z.array(z.object({
        productId: z.string().min(1),
        locationId: z.string().min(1),
        quantity: z.number().positive(),
        unitCost: z.number().min(0),
    })).min(1),
})

// GET /api/purchase — รายการใบสั่งซื้อ
export const GET = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    const [orders, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                supplier: true,
                createdBy: { select: { name: true } },
                _count: { select: { items: true } },
            },
        }),
        prisma.purchaseOrder.count({ where: { tenantId } }),
    ])
    return ok({ orders, total, page, pages: Math.ceil(total / limit) })
})

// POST /api/purchase — สร้าง PO + รับสินค้าเข้าคลังทันที
export const POST = withAuth(async (req: NextRequest, { user, tenantId }: any) => {
    try {
        const body = await req.json()
        const data = poSchema.parse(body)

        const totalAmount = data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0)
        const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`

        const result = await prisma.$transaction(async (tx) => {
            const po = await tx.purchaseOrder.create({
                data: {
                    tenantId,
                    poNumber,
                    supplierId: data.supplierId || null,
                    status: POStatus.RECEIVED,
                    totalAmount,
                    note: data.note,
                    purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
                    createdById: user?.userId,
                    items: {
                        create: data.items.map(item => ({
                            tenantId,
                            productId: item.productId,
                            locationId: item.locationId,
                            quantity: item.quantity,
                            unitCost: item.unitCost,
                            totalCost: item.quantity * item.unitCost,
                        })),
                    },
                },
                include: { items: true },
            })

            // อัพเดต Inventory + Stock Movement สำหรับแต่ละรายการ
            for (const item of po.items) {
                const existing = await tx.inventory.findUnique({
                    where: { tenantId_productId_locationId: { tenantId, productId: item.productId, locationId: item.locationId } }
                })

                const newAvgCost = calcWAC(
                    existing?.quantity || 0,
                    existing?.avgCost || 0,
                    item.quantity,
                    item.unitCost
                )

                // Upsert inventory
                await tx.inventory.upsert({
                    where: { tenantId_productId_locationId: { tenantId, productId: item.productId, locationId: item.locationId } },
                    update: {
                        quantity: { increment: item.quantity },
                        avgCost: newAvgCost,
                    },
                    create: {
                        tenantId,
                        productId: item.productId,
                        locationId: item.locationId,
                        quantity: item.quantity,
                        avgCost: item.unitCost,
                    },
                })

                // อัพเดต Product costPrice (WAC)
                await tx.product.update({
                    where: { id: item.productId },
                    data: { costPrice: newAvgCost },
                })

                // Stock movement
                await tx.stockMovement.create({
                    data: {
                        tenantId,
                        productId: item.productId,
                        toLocationId: item.locationId,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        totalCost: item.quantity * item.unitCost,
                        type: MovementType.PURCHASE,
                        referenceId: po.id,
                        referenceType: 'PURCHASE_ORDER',
                        createdById: user?.userId,
                    },
                })
            }

            return po
        })

        return ok({ poNumber: result.poNumber, id: result.id, totalAmount, items: result.items.length })
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('Purchase error:', error)
        return err('เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ')
    }
}, ['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE'])
