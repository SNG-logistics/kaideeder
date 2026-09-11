import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { getEventEmitter } from '@/lib/events'

// POST /api/pos/orders/[orderId]/reject — แคชเชียร์ปฏิเสธออเดอร์ QR ที่รอยืนยัน
//
// จำเป็นเมื่อเปิดให้ทุกโต๊ะสแกนสั่งได้เอง เพราะจะมีออเดอร์ป่วน สั่งผิดโต๊ะ
// หรือสั่งของที่หมดแล้วเข้ามา ก่อนหน้านี้ไม่มีทางลบออเดอร์แบบนี้ได้เลย
// (DELETE /api/pos/orders/[id] รับเฉพาะออเดอร์ OPEN ที่ไม่มีรายการสินค้า
//  ซึ่งออเดอร์ QR ผิดเงื่อนไขทั้งสองข้อเสมอ) ทำให้ออเดอร์ค้างในรายการแจ้งเตือน
// และเสียงเตือนร้องซ้ำไม่หยุด
export const POST = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId }: any = ctx
    const { id: orderId } = await (ctx as any).params

    if (!orderId) return err('Missing orderId')

    let reason = ''
    try {
        const body = await req.json()
        if (typeof body?.reason === 'string') reason = body.reason.trim().slice(0, 200)
    } catch {
        // ไม่ส่ง body มาก็ได้ — ถือว่าไม่ระบุเหตุผล
    }

    const pendingOrder = await prisma.order.findFirst({
        where: { id: orderId, tenantId, status: 'PENDING_CONFIRM' },
        select: { id: true, tableId: true, note: true },
    })
    if (!pendingOrder) return err('ไม่พบออเดอร์ที่รอยืนยัน หรือถูกจัดการไปแล้ว', 404)

    const stamp = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    const rejectNote = reason
        ? `❌ ปฏิเสธออเดอร์ ${stamp} — ${reason}`
        : `❌ ปฏิเสธออเดอร์ ${stamp}`

    await prisma.$transaction(async (tx) => {
        // ยกเลิกรายการอาหารทั้งหมด เพื่อให้หลุดจากคิวครัวและไม่ไปโผล่ในรายงานยอดขาย
        await tx.orderItem.updateMany({
            where: { orderId: pendingOrder.id },
            data: { isCancelled: true, kitchenStatus: 'CANCELLED', cancelReason: reason || 'ปฏิเสธโดยแคชเชียร์' },
        })
        await tx.order.update({
            where: { id: pendingOrder.id },
            data: {
                status: 'CANCELLED',
                // ต่อท้ายโน้ตเดิมไว้ เผื่อต้องย้อนดูว่าลูกค้าสั่งอะไรมา
                note: pendingOrder.note?.trim()
                    ? `${pendingOrder.note.trim()}\n${rejectNote}`
                    : rejectNote,
            },
        })
    })

    // คืนโต๊ะให้ว่าง ถ้าไม่มีออเดอร์อื่นค้างอยู่แล้ว
    if (pendingOrder.tableId) {
        const stillActive = await prisma.order.findFirst({
            where: {
                tenantId,
                tableId: pendingOrder.tableId,
                status: { in: ['OPEN', 'PENDING_CONFIRM'] },
            },
            select: { id: true },
        })
        if (!stillActive) {
            await prisma.diningTable.update({
                where: { id: pendingOrder.tableId },
                data: { status: 'AVAILABLE' },
            })
        }
    }

    getEventEmitter().emit('ORDERS_UPDATED', tenantId)

    return ok({ rejected: true, orderId: pendingOrder.id })
}, ['OWNER', 'MANAGER', 'CASHIER'])
