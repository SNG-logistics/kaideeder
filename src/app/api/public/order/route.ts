import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getEventEmitter } from '@/lib/events'

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

        // ── Table session ─────────────────────────────────────────────────────
        // ทุกโต๊ะเปิดให้สแกนสั่งได้ตลอดเวลา ไม่ต้องรอพนักงานมาเปิดโต๊ะก่อน
        //   • รอบแรกของโต๊ะ           → PENDING_CONFIRM ให้แคชเชียร์กรองหนึ่งชั้น
        //   • รอบถัดไป (มีออเดอร์ OPEN) → ต่อเข้าออเดอร์เดิมเลย ครัว/บาร์เห็นทันที
        const openOrder = await prisma.order.findFirst({
            where: { tenantId: tenant.id, tableId: table.id, status: 'OPEN' },
            orderBy: { openedAt: 'asc' },
        })

        // ── รายการอาหาร (ใช้ร่วมกันทั้งสองเส้นทาง) ────────────────────────────
        const productIds = data.items.map(i => i.productId)
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, tenantId: tenant.id },
            include: { category: true },
        })
        const productMap = Object.fromEntries(products.map(p => [p.id, p]))

        const buildItem = (item: (typeof data.items)[number]) => {
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
                stationId: isBar ? 'BAR' : 'KITCHEN',
                kitchenStatus: 'PENDING' as const,
            }
        }

        const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        const emitter = getEventEmitter()

        // ── รอบถัดไป: ต่อเข้าออเดอร์ที่เปิดอยู่ ส่งเข้าครัวทันที ─────────────────
        if (openOrder) {
            await prisma.$transaction(async (tx) => {
                await tx.orderItem.createMany({
                    data: data.items.map(item => ({ ...buildItem(item), orderId: openOrder.id })),
                })
                const liveItems = await tx.orderItem.findMany({
                    where: { orderId: openOrder.id, isCancelled: false },
                })
                const newSubtotal = liveItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
                const discountAmt = openOrder.discountType === 'PERCENT'
                    ? newSubtotal * openOrder.discount / 100
                    : openOrder.discount
                await tx.order.update({
                    where: { id: openOrder.id },
                    data: {
                        subtotal: newSubtotal,
                        totalAmount: newSubtotal - discountAmt + openOrder.serviceCharge + openOrder.vat,
                    },
                })
            })

            emitter.emit('ORDERS_UPDATED', tenant.id)

            return NextResponse.json({
                ok: true,
                orderNumber: openOrder.orderNumber,
                orderId: openOrder.id,
                isAddon: true,
                needsConfirm: false,
                tableNumber: table.number,
            })
        }

        // ── รอบแรกของโต๊ะ: กันยิงซ้ำระหว่างที่ยังรอแคชเชียร์ยืนยัน ───────────────
        const existingPending = await prisma.order.findFirst({
            where: { tenantId: tenant.id, tableId: table.id, status: 'PENDING_CONFIRM' },
        })
        if (existingPending) {
            return NextResponse.json({
                code: 'PENDING_CONFIRM_EXISTS',
                error: 'ออเดอร์แรกของโต๊ะยังรอพนักงานยืนยันอยู่ กรุณารอสักครู่แล้วลองใหม่',
                orderId: existingPending.id,
            }, { status: 409 })
        }

        let orderNumber = generateOrderNumber()
        for (let i = 0; i < 10; i++) {
            const exists = await prisma.order.findFirst({ where: { tenantId: tenant.id, orderNumber } })
            if (!exists) break
            orderNumber = generateOrderNumber()
        }

        const order = await prisma.order.create({
            data: {
                tenantId: tenant.id,
                orderNumber,
                tableId: table.id,
                status: 'PENDING_CONFIRM',
                subtotal,
                totalAmount: subtotal,
                note: data.customerNote || null,
                items: { create: data.items.map(buildItem) },
            },
            include: { table: true, items: true },
        })

        emitter.emit('ORDERS_UPDATED', tenant.id)

        return NextResponse.json({
            ok: true,
            orderNumber: order.orderNumber,
            orderId: order.id,
            isAddon: false,
            needsConfirm: true,
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
