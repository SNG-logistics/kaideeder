import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
    tenantCode: z.string().min(1),
    customerName: z.string().min(1, 'กรุณาระบุชื่อ'),
    customerPhone: z.string().min(1, 'กรุณาระบุเบอร์โทร'),
    addressText: z.string().min(1, 'กรุณาระบุที่อยู่จัดส่ง'),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().min(0),
        note: z.string().optional(),
    })).min(1, 'กรุณาเลือกอาหารอย่างน้อย 1 รายการ'),
    deliveryFee: z.number().min(0).default(0),
    customerNote: z.string().optional(),
    paymentSlipBase64: z.string().optional(),
})

function generateOrderNumber(): string {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    return `DL-${yy}${mm}${dd}-${rand}`
}

const BAR_CATS = ['BEER', 'BEER_DRAFT', 'WINE', 'COCKTAIL', 'DRINK', 'WATER', 'ENTERTAIN', 'PR']
const BAR_KEYWORDS = ['beer', 'drink', 'bev', 'bar', 'wine', 'cocktail', 'เครื่องดื่ม', 'น้ำ', 'เบียร', 'เหล้า']

// POST /api/public/delivery/orders — customer self-order via QR (no auth)
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const data = schema.parse(body)

        // Validate tenant
        const tenant = await prisma.tenant.findFirst({
            where: { code: data.tenantCode, status: 'ACTIVE' },
            select: { id: true, code: true, currency: true },
        })
        if (!tenant) return NextResponse.json({ error: 'ไม่พบร้าน' }, { status: 404 })

        // Validate products belong to this tenant
        const productIds = data.items.map(i => i.productId)
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, tenantId: tenant.id, isActive: true },
            include: { category: true },
        })
        const productMap = Object.fromEntries(products.map(p => [p.id, p]))

        // Generate unique order number
        let orderNumber = generateOrderNumber()
        for (let i = 0; i < 10; i++) {
            const exists = await prisma.order.findFirst({ where: { tenantId: tenant.id, orderNumber } })
            if (!exists) break
            orderNumber = generateOrderNumber()
        }

        const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        const totalAmount = subtotal + data.deliveryFee

        // Create order directly as OPEN (delivery orders don't need cashier confirm)
        const order = await prisma.order.create({
            data: {
                tenantId: tenant.id,
                orderNumber,
                orderType: 'DELIVERY',
                status: 'OPEN',
                subtotal,
                totalAmount,
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
                            note: item.note || null,
                            stationId: isBar ? 'BAR' : 'KITCHEN',
                            kitchenStatus: 'PENDING',
                        }
                    }),
                },
            },
        })

        // Create delivery info
        await prisma.deliveryInfo.create({
            data: {
                tenantId: tenant.id,
                orderId: order.id,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                addressText: data.addressText,
                latitude: data.latitude,
                longitude: data.longitude,
                channel: 'WEBSITE',   // QR scan = WEBSITE channel
                deliveryFee: data.deliveryFee,
                deliveryStatus: 'RECEIVED',
                paymentSlipBase64: data.paymentSlipBase64 || null,
                isPrepaid: !!data.paymentSlipBase64,
            },
        })

        return NextResponse.json({
            success: true,
            orderId: order.id,
            orderNumber: order.orderNumber,
            trackUrl: `/d/${data.tenantCode}/track/${order.id}`,
        })
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return NextResponse.json({ error: e.errors.map(x => x.message).join(', ') }, { status: 400 })
        }
        console.error('[public/delivery/orders]', e)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 })
    }
}
