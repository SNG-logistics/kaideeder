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

        // Check no existing PENDING_CONFIRM or OPEN order on this table
        const existing = await prisma.order.findFirst({
            where: {
                tenantId: tenant.id,
                tableId: table.id,
                status: { in: ['PENDING_CONFIRM', 'OPEN'] },
            },
        })
        if (existing) {
            return NextResponse.json({
                error: 'โต๊ะนี้มีออเดอร์อยู่แล้ว กรุณาติดต่อพนักงาน',
                orderId: existing.id,
            }, { status: 409 })
        }

        // Generate unique order number
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
                status: 'PENDING_CONFIRM',    // ← awaiting cashier confirmation
                subtotal,
                totalAmount: subtotal,
                note: data.customerNote || null,
                items: {
                    create: data.items.map(item => ({
                        tenantId: tenant.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        note: item.note || null,
                        stationId: 'KITCHEN',
                        kitchenStatus: 'PENDING',  // will be processed after cashier confirms
                    })),
                },
            },
            include: { table: true, items: true },
        })

        return NextResponse.json({ ok: true, orderNumber: order.orderNumber, orderId: order.id })
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return NextResponse.json({ error: e.errors.map(x => x.message).join(', ') }, { status: 400 })
        }
        console.error('[public/order]', e)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 })
    }
}
