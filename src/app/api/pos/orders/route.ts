import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

// Generate order number: ORD-YYMMDD-XXXX
function generateOrderNumber(): string {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    return `ORD-${yy}${mm}${dd}-${rand}`
}

const createOrderSchema = z.object({
    tableId: z.string().min(1),
    skipKitchen: z.boolean().optional().default(false),
    items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
        note: z.string().optional(),
    })).optional(),
})

// GET /api/pos/orders — list open orders
export const GET = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'OPEN'

    const orders = await prisma.order.findMany({
        where: { tenantId, status: status as any },
        orderBy: { openedAt: 'desc' },
        include: {
            table: true,
            items: { include: { product: true } },
            payments: true,
            createdBy: { select: { id: true, name: true } },
        },
    })
    return ok(orders)
})

// POST /api/pos/orders — create new order
export const POST = withAuth(async (req: NextRequest, ctx) => {
    try {
        const { tenantId }: any = ctx
        const body = await req.json()
        const data = createOrderSchema.parse(body)

        const existingOrder = await prisma.order.findFirst({
            where: { tenantId, tableId: data.tableId, status: 'OPEN' },
        })
        if (existingOrder) {
            return err('โต๊ะนี้มีออเดอร์เปิดอยู่แล้ว')
        }

        // Generate unique order number (scoped to tenant)
        let orderNumber = generateOrderNumber()
        let attempts = 0
        while (attempts < 10) {
            const exists = await prisma.order.findFirst({ where: { tenantId, orderNumber } })
            if (!exists) break
            orderNumber = generateOrderNumber()
            attempts++
        }

        const subtotal = data.items
            ? data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
            : 0

        const BAR_CODES = ['BEER', 'BEER_DRAFT', 'WINE', 'COCKTAIL', 'DRINK', 'WATER', 'ENTERTAIN', 'PR']
        const BAR_KEYWORDS = ['beer', 'drink', 'bev', 'bar', 'wine', 'cocktail', 'whisky', 'vodka', 'rum', 'เครื่องดื่ม', 'น้ำ', 'เบียร', 'เหล้า', 'แอลกอฮอล์']

        // Ensure items is defined before we proceed
        let itemsToCreate: typeof data.items = data.items || []
        let productMap: Record<string, { category: { code: string; name: string } | null }> = {}

        if (itemsToCreate.length > 0) {
            const productIds = itemsToCreate.map(i => i.productId)
            const products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                include: { category: true },
            })
            productMap = Object.fromEntries(products.map(p => [p.id, p]))
        }

        const order = await prisma.order.create({
            data: {
                tenantId,
                orderNumber,
                tableId: data.tableId,
                createdById: ctx.user?.userId,
                subtotal,
                totalAmount: subtotal,
                items: itemsToCreate.length > 0 ? {
                    create: itemsToCreate.map(item => {
                        const prod = productMap[item.productId]
                        const catCode = (prod?.category?.code || '').toUpperCase()
                        const catName = (prod?.category?.name || '').toLowerCase()
                        const isBar = BAR_CODES.some(c => catCode.includes(c)) || BAR_KEYWORDS.some(k => catName.includes(k))
                        return {
                            tenantId,
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            note: item.note || null,
                            stationId: data.skipKitchen ? 'SKIP' : (isBar ? 'BAR' : 'KITCHEN'),
                            kitchenStatus: data.skipKitchen ? 'SERVED' : 'PENDING',
                        }
                    }),
                } : undefined,
            },
            include: {
                table: true,
                items: { include: { product: true } },
            },
        })

        // Update table status
        await prisma.diningTable.update({
            where: { id: data.tableId },
            data: { status: 'OCCUPIED' },
        })

        return ok(order)
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('Create order error:', error)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])
