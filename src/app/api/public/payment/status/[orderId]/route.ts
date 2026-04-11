// @ts-nocheck
/**
 * GET /api/public/payment/status/[orderId]
 * เช็คสถานะการชำระเงินของออเดอร์ delivery
 * Public endpoint (ลูกค้าใช้ tracking page)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await params
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
        },
    })

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const info = await prisma.deliveryInfo.findUnique({
        where: { orderId },
        select: { isPrepaid: true, paymentRef: true, paymentSlipBase64: true, deliveryStatus: true },
    })
    const isPaid = info?.isPrepaid ?? false
    const hasSlip = !!info?.paymentSlipBase64

    return NextResponse.json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        payment: {
            status: isPaid ? 'PAID' : hasSlip ? 'SLIP_UPLOADED' : 'PENDING',
            isPaid,
            hasSlip,
            paymentRef: info?.paymentRef ?? null,
            // ไม่คืน paymentSlipBase64 ที่นี่ — เฉพาะ staff ดูได้
        },
        deliveryStatus: info?.deliveryStatus ?? 'RECEIVED',
    })
}
