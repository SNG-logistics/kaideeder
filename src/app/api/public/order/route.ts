import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
    tenantCode: z.string().min(1),
    tableNumber: z.number().int().positive(),
    items: z.array(z.object({
        productId: z.string().min(1),
        name: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().min(0),
        note: z.string().optional(),
        toppingsJson: z.string().nullable().optional(),
        toppingsTotal: z.number().optional(),
    })).min(1, 'Please add at least one item'),
    customerNote: z.string().optional(),
})

function generateOrderNumber(): string {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    return `QR-${yy}${mm}${dd}-${rand}`
}

const BAR_CATS = ['BEER', 'BEER_DRAFT', 'WINE', 'COCKTAIL', 'DRINK', 'WATER', 'ENTERTAIN', 'PR']
const BAR_KEYWORDS = ['beer', 'drink', 'bev', 'bar', 'wine', 'cocktail', 'whisky', 'vodka', 'rum', 'เครื่องดื่ม', 'น้ำ', 'เบียร', 'เหล้า', 'แอลกอฮอล์']

// POST /api/public/order — customer self-order (no auth)
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const data = schema.parse(body)

        // Validate tenant
        const tenant = await prisma.tenant.findFirst({
            where: { code: data.tenantCode, status: 'ACTIVE' },
        })
        if (!tenant) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

        // Validate table
        const table = await prisma.diningTable.findFirst({
            where: { tenantId: tenant.id, number: data.tableNumber, isActive: true },
        })
        if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })

        // ── SESSION GUARD ──────────────────────────────────────────────────────
        const activeOrder = await prisma.order.findFirst({
            where: { tenantId: tenant.id, tableId: table.id, status: { in: ['OPEN', 'PENDING_CONFIRM'] } },
        })
        if (!activeOrder && table.status !== 'OCCUPIED') {
            return NextResponse.json({
                error: 'SESSION_EXPIRED',
                message: 'โต๊ะนี้ยังไม่ได้เปิดบริการ\nกรุณาแจ้งพนักงานเพื่อเปิดโต๊ะก่อนสั่งอาหาร',
            }, { status: 403 })
        }

        // Block if PENDING_CONFIRM already exists (anti-spam)
        const existingPending = await prisma.order.findFirst({
            where: { tenantId: tenant.id, tableId: table.id, status: 'PENDING_CONFIRM' },
        })
        if (existingPending) {
            return NextResponse.json({
                error: 'ออเดอร์ก่อนหน้ายังรอการยืนยันอยู่ กรุณารอสักครู่…',
                orderId: existingPending.id,
            }, { status: 409 })
        }

        // ── Always create PENDING_CONFIRM → cashier must confirm every QR order ──
        // Confirm endpoint handles: if OPEN order exists → merge; else → promote to OPEN.
        const productIds = data.items.map(i => i.productId)
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, tenantId: tenant.id },
            include: { category: true },
        })
        const productMap = Object.fromEntries(products.map(p => [p.id, p]))

        let orderNumber = generateOrderNumber()
        for (let i = 0; i < 10; i++) {
            const exists = await prisma.order.findFirst({ where: { tenantId: tenant.id, orderNumber } })
            if (!exists) break
            orderNumber = generateOrderNumber()
        }

        const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

        const order = await prisma.order.create({
            data: {
                tenantId: tenant.id,
                orderNumber,
                tableId: table.id,
                status: 'PENDING_CONFIRM',
                subtotal,
                totalAmount: subtotal,
                note: data.customerNote || null,
                items: {
                    create: data.items.map(item => {
                        const prod = productMap[item.productId]
                        const catCode = (prod?.category?.code || '').toUpperCase()
                        const catName = (prod?.category?.name || '').toLowerCase()
                        const isBar = BAR_CATS.some(c => catCode.includes(c)) ||
                            BAR_KEYWORDS.some(k => catName.includes(k))
                        return {
                            tenantId: tenant.id,
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            note: item.note || data.customerNote || null,
                            toppingsJson: item.toppingsJson || null,
                            toppingsTotal: item.toppingsTotal || 0,
                            stationId: isBar ? 'BAR' : 'KITCHEN',
                            kitchenStatus: 'PENDING',
                        }
                    }),
                },
            },
            include: { table: true, items: true },
        })

        return NextResponse.json({
            ok: true,
            orderNumber: order.orderNumber,
            orderId: order.id,
            isAddon: !!activeOrder,   // true if table already had an order
            tableNumber: table.number,
        })
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return NextResponse.json({ error: e.errors.map(x => x.message).join(', ') }, { status: 400 })
        }
        console.error('[public/order]', e)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 })
    }
}
