import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const updateOrderSchema = z.object({
    items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
        note: z.string().optional(),
    })).optional(),
    discount: z.number().min(0).optional(),
    discountType: z.enum(['PERCENT', 'AMOUNT']).optional(),
    serviceCharge: z.number().min(0).optional(),
    vat: z.number().min(0).optional(),
    note: z.string().optional(),
    skipKitchen: z.boolean().optional().default(false),
})

// GET /api/pos/orders/[id] — get single order
export const GET = withAuth(async (_req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const id = params?.id
    if (!id) return err('Missing order id')

    const order = await prisma.order.findFirst({
        where: { id, tenantId },
        include: {
            table: true,
            items: { include: { product: { include: { category: true } } } },
            payments: true,
            createdBy: { select: { id: true, name: true } },
        },
    })
    if (!order) return err('ไม่พบออเดอร์', 404)
    return ok(order)
})

// PUT /api/pos/orders/[id] — add items / update order
export const PUT = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const id = params?.id
    if (!id) return err('Missing order id')

    try {
        const body = await req.json()
        const data = updateOrderSchema.parse(body)

        const order = await prisma.order.findFirst({ where: { id, tenantId } })
        if (!order) return err('ไม่พบออเดอร์', 404)
        if (order.status !== 'OPEN') return err('ออเดอร์ปิดแล้ว ไม่สามารถแก้ไข')

        // Add new items
        if (data.items && data.items.length > 0) {
            // Fetch products to determine station
            const productIds = data.items.map(i => i.productId)
            const products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                include: { category: true },
            })
            const productMap = Object.fromEntries(products.map(p => [p.id, p]))

            const BAR_CATS = ['BEER', 'BEER_DRAFT', 'WINE', 'COCKTAIL', 'DRINK', 'WATER']

            await prisma.orderItem.createMany({
                data: data.items.map(item => {
                    const prod = productMap[item.productId]
                    const catCode = prod?.category?.code || ''
                    const station = BAR_CATS.includes(catCode) ? 'BAR' : 'KITCHEN'
                    return {
                        orderId: id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        note: item.note || null,
                        stationId: data.skipKitchen ? 'SKIP' : station,
                        kitchenStatus: data.skipKitchen ? 'SERVED' : 'PENDING',
                    }
                }),
            })
        }

        // Recalculate subtotal from all non-cancelled items
        const allItems = await prisma.orderItem.findMany({
            where: { orderId: id, isCancelled: false },
        })
        const subtotal = allItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

        const discount = data.discount ?? order.discount
        const discountType = data.discountType ?? order.discountType
        const serviceCharge = data.serviceCharge ?? order.serviceCharge
        const vat = data.vat ?? order.vat

        // Calculate total
        let discountAmount = discount
        if (discountType === 'PERCENT') {
            discountAmount = subtotal * (discount / 100)
        }
        const afterDiscount = subtotal - discountAmount
        const totalAmount = afterDiscount + serviceCharge + vat

        const updated = await prisma.order.update({
            where: { id },
            data: {
                subtotal,
                discount,
                discountType,
                serviceCharge,
                vat,
                totalAmount,
                note: data.note ?? order.note,
            },
            include: {
                table: true,
                items: {
                    include: { product: true },
                },
                payments: true,
            },
        })

        return ok(updated)
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('Update order error:', error)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])
