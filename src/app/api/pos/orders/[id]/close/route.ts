import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const closeOrderSchema = z.object({
    paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'QRCODE']),
    receivedAmount: z.number().min(0),
    reference: z.string().optional(),
    discount: z.number().min(0).optional(),
    discountType: z.enum(['PERCENT', 'AMOUNT']).optional(),
    serviceCharge: z.number().min(0).optional(),
    vat: z.number().min(0).optional(),
})

// POST /api/pos/orders/[id]/close — close bill & deduct stock
export const POST = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const id = params?.id
    if (!id) return err('Missing order id')

    try {
        const body = await req.json()
        const data = closeOrderSchema.parse(body)

        // Fetch order with items (tenant-scoped)
        const order = await prisma.order.findFirst({
            where: { id, tenantId },
            include: {
                items: {
                    where: { isCancelled: false },
                    include: { product: { include: { category: true } } },
                },
                table: true,
            },
        })

        if (!order) return err('ไม่พบออเดอร์', 404)
        if (order.status !== 'OPEN') return err('ออเดอร์นี้ปิดแล้ว')

        // Recalculate totals
        const subtotal = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        const discount = data.discount ?? order.discount
        const discountType = data.discountType ?? order.discountType
        const serviceCharge = data.serviceCharge ?? order.serviceCharge
        const vat = data.vat ?? order.vat

        let discountAmount = discount
        if (discountType === 'PERCENT') {
            discountAmount = subtotal * (discount / 100)
        }
        const afterDiscount = subtotal - discountAmount
        const totalAmount = afterDiscount + serviceCharge + vat

        const changeAmount = data.paymentMethod === 'CASH'
            ? Math.max(0, data.receivedAmount - totalAmount)
            : 0

        // === STOCK DEDUCTION ===
        const stockErrors: string[] = []

        // Get all locations for fallback logic
        const locations = await prisma.location.findMany({ where: { tenantId, isActive: true } })
        const locationMap = Object.fromEntries(locations.map(l => [l.code, l.id]))

        for (const item of order.items) {
            if (item.product.productType === 'ENTERTAIN') continue // skip entertain items

            // Find recipe for this product
            const recipes = await prisma.recipeBOM.findMany({
                where: { menuId: item.productId },
                include: { product: true },
            })

            if (recipes.length > 0) {
                // Has BOM — deduct each ingredient
                for (const bom of recipes) {
                    const deductQty = item.quantity * bom.quantity
                    await deductInventory(
                        bom.productId,
                        bom.locationId,
                        deductQty,
                        bom.product.costPrice,
                        id,
                        ctx.user?.userId || null,
                        stockErrors,
                        tenantId,
                    )
                }
            } else {
                // No recipe — deduct the product directly
                const defaultLocationId = getDefaultLocation(item.product.category?.code, locationMap)
                await deductInventory(
                    item.productId,
                    defaultLocationId,
                    item.quantity,
                    item.product.costPrice,
                    id,
                    ctx.user?.userId || null,
                    stockErrors,
                    tenantId,
                )
            }
        }

        // Update order
        const closedOrder = await prisma.order.update({
            where: { id },
            data: {
                status: 'CLOSED',
                subtotal,
                discount,
                discountType,
                serviceCharge,
                vat,
                totalAmount,
                closedAt: new Date(),
            },
            include: {
                table: true,
                items: { include: { product: true } },
                payments: true,
            },
        })

        // Create payment record
        await prisma.payment.create({
            data: {
                orderId: id,
                method: data.paymentMethod,
                amount: totalAmount,
                receivedAmount: data.receivedAmount,
                changeAmount,
                reference: data.reference || null,
            },
        })

        // Release table
        if (order.tableId) {
            await prisma.diningTable.update({
                where: { id: order.tableId },
                data: { status: 'AVAILABLE' },
            })
        }

        // === CREATE SALES EVENT ===
        await prisma.salesEvent.create({
            data: {
                orderId: id,
                occurredAt: new Date(),
                payload: {
                    orderId: id,
                    orderNumber: order.orderNumber,
                    tableId: order.tableId,
                    tableName: order.table?.name || null,
                    closedAt: new Date().toISOString(),
                    subtotal,
                    discount: discountAmount,
                    totalAmount,
                    paymentMethod: data.paymentMethod,
                    items: order.items.map(item => ({
                        orderItemId: item.id,
                        productId: item.productId,
                        productName: item.product.name,
                        productSku: item.product.sku,
                        categoryCode: item.product.category?.code || null,
                        stationId: item.stationId || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.quantity * item.unitPrice,
                        kitchenStatus: item.kitchenStatus,
                    })),
                },
            },
        })

        return ok({
            order: closedOrder,
            changeAmount,
            stockWarnings: stockErrors.length > 0 ? stockErrors : undefined,
        })
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('Close order error:', error)
        return err('เกิดข้อผิดพลาดในการปิดบิล')
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])

// Deduct inventory helper
async function deductInventory(
    productId: string,
    locationId: string,
    quantity: number,
    unitCost: number,
    orderId: string,
    userId: string | null,
    errors: string[],
    tenantId?: string,
) {
    try {
        let inventory = await prisma.inventory.findUnique({
            where: { productId_locationId: { productId, locationId } },
        })

        if (!inventory) {
            inventory = await prisma.inventory.create({
                data: {
                    ...(tenantId ? { tenantId } : {}),
                    productId,
                    locationId,
                    quantity: 0,
                    avgCost: unitCost,
                },
            })
        }

        // Allow negative stock (just warn)
        if (inventory.quantity < quantity) {
            const product = await prisma.product.findUnique({ where: { id: productId } })
            errors.push(`⚠️ ${product?.name || productId}: สต็อคไม่พอ (มี ${inventory.quantity}, ต้องการ ${quantity})`)
        }

        // Deduct
        await prisma.inventory.update({
            where: { productId_locationId: { productId, locationId } },
            data: {
                quantity: { decrement: quantity },
            },
        })

        // Create stock movement
        await prisma.stockMovement.create({
            data: {
                ...(tenantId ? { tenantId } : {}),
                productId,
                fromLocationId: locationId,
                quantity,
                unitCost,
                totalCost: quantity * unitCost,
                type: 'SALE',
                referenceId: orderId,
                referenceType: 'POS_ORDER',
                note: `POS ตัดสต็อคอัตโนมัติ`,
                createdById: userId,
            },
        })
    } catch (e) {
        console.error(`Stock deduction error for product ${productId}:`, e)
        errors.push(`❌ ตัดสต็อคไม่สำเร็จ: ${productId}`)
    }
}

// Get default location based on category
function getDefaultLocation(categoryCode: string | undefined, locationMap: Record<string, string>): string {
    if (!categoryCode) return locationMap['WH_MAIN'] || ''

    const barCategories = ['BEER', 'BEER_DRAFT', 'WINE', 'COCKTAIL', 'DRINK', 'WATER']
    const kitchenCategories = ['FOOD_GRILL', 'FOOD_FRY', 'FOOD_SEA', 'FOOD_VEG', 'FOOD_LAAB', 'FOOD_RICE', 'FOOD_NOODLE']

    if (barCategories.includes(categoryCode)) {
        return locationMap['BAR_STOCK'] || locationMap['FR_FREEZER'] || locationMap['WH_MAIN'] || ''
    }
    if (kitchenCategories.includes(categoryCode)) {
        return locationMap['KIT_STOCK'] || locationMap['WH_MAIN'] || ''
    }
    // Default
    return locationMap['FR_FREEZER'] || locationMap['WH_MAIN'] || ''
}
