import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/delivery/[orderId]/track — poll delivery status (no auth)
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await params

    try {
        const order = await prisma.order.findFirst({
            where: { id: orderId, orderType: 'DELIVERY' },
            include: {
                deliveryInfo: true,
                items: {
                    where: { isCancelled: false },
                    include: { product: { select: { name: true } } },
                },
                tenant: { select: { name: true, displayName: true, storeNameLao: true, language: true, currency: true, logoUrl: true } },
            },
        })

        if (!order || !order.deliveryInfo) {
            return NextResponse.json({ error: 'ไม่พบออเดอร์' }, { status: 404 })
        }

        const info = order.deliveryInfo

        return NextResponse.json({
            success: true,
            orderId: order.id,
            orderNumber: order.orderNumber,
            storeName: order.tenant.displayName || order.tenant.name,
            storeNameLao: order.tenant.storeNameLao,
            language: order.tenant.language,
            currency: order.tenant.currency,
            logoUrl: order.tenant.logoUrl,

            // Delivery status
            deliveryStatus: info.deliveryStatus,
            estimatedAt: info.estimatedAt,
            deliveredAt: info.deliveredAt,

            // Customer info
            customerName: info.customerName,
            customerPhone: info.customerPhone,
            addressText: info.addressText,
            driverNote: info.driverNote,

            // Financials
            subtotal: order.subtotal,
            deliveryFee: info.deliveryFee,
            totalAmount: order.totalAmount,
            isPrepaid: info.isPrepaid,

            // Items
            items: order.items.map(i => ({
                name: i.product.name,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                total: i.quantity * i.unitPrice,
            })),

            openedAt: order.openedAt,
        })
    } catch (e: any) {
        console.error('[public/delivery/track]', e)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
    }
}
