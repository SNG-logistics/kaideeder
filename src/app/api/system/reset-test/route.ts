import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'

// POST /api/system/reset-test — เฉพาะ OWNER
export const POST = withAuth<any>(async (_req, { user }) => {
    if (user?.role !== 'OWNER') {
        return NextResponse.json({ success: false, error: 'เฉพาะ Owner เท่านั้น' }, { status: 403 })
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // ลำดับต้องถูก (foreign key)

            // 1. Stock movements (purchase, usage, adjust, transfer, waste)
            const movements = await tx.stockMovement.deleteMany({})

            // 2. POS orders
            const orderItems = await tx.orderItem.deleteMany({})
            const payments = await tx.payment.deleteMany({})
            const orders = await tx.order.deleteMany({})

            // 3. Reset inventory quantity → 0 (เก็บ record แต่เคลียร์ยอด)
            const invReset = await tx.inventory.updateMany({
                data: { quantity: 0, avgCost: 0 },
            })

            return {
                movements: movements.count,
                orders: orders.count,
                orderItems: orderItems.count,
                payments: payments.count,
                inventoryReset: invReset.count,
            }
        }, { timeout: 30000 })

        return NextResponse.json({
            success: true,
            message: 'รีเซ็ตข้อมูลทดสอบสำเร็จ',
            data: result,
        })
    } catch (e: any) {
        console.error('[reset-test]', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}, ['OWNER'])
