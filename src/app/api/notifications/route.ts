import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

export type NotificationInfo = {
    id: string;
    type: 'ORDER_NEW' | 'BILL_REQUEST' | 'INVENTORY_LOW' | 'DELIVERY_NEW';
    priority: 'HIGH' | 'NORMAL' | 'LOW';
    title: string;
    message: string;
    metadata: any;
    createdAt: string;
}

// GET /api/notifications
// Unified polling endpoint for topbar/dashboard alerts
export const GET = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    try {
        const result: NotificationInfo[] = []

        // 1. Fetch pending orders (Order NEW)
        const pendingOrders = await prisma.order.findMany({
            where: { tenantId, status: 'PENDING_CONFIRM', note: { not: { contains: 'เรียกเช็คบิล' } } },
            include: { table: true, items: { include: { product: true } } },
            orderBy: { openedAt: 'asc' },
        })

        pendingOrders.forEach(order => {
            result.push({
                id: `ORDER_NEW_${order.id}`,
                type: 'ORDER_NEW',
                priority: 'HIGH',
                title: 'ออเดอร์ใหม่จากลูกค้า',
                message: order.table ? `โต๊ะ ${order.table.name} — ${order.table.zone}` : 'ออเดอร์ใหม่ ไม่ระบุโต๊ะ',
                metadata: order,
                createdAt: order.openedAt.toISOString()
            })
        })

        // 2. Fetch bill requests
        const billRequests = await prisma.order.findMany({
            where: {
                tenantId,
                status: { in: ['OPEN', 'PENDING_CONFIRM'] },
                note: { contains: 'เรียกเช็คบิล' }
            },
            include: { table: true, items: { include: { product: true } } },
            orderBy: { openedAt: 'asc' },
        })

        billRequests.forEach(bill => {
            result.push({
                id: `BILL_REQ_${bill.id}`,
                type: 'BILL_REQUEST',
                priority: 'HIGH',
                title: 'ลูกค้าเรียกเช็คบิล!',
                message: bill.table ? `โต๊ะ ${bill.table.name} — ${bill.table.zone}` : 'เรียกเช็คบิล ไม่ระบุโต๊ะ',
                metadata: bill,
                createdAt: bill.openedAt.toISOString() // Or extract from note string if needed
            })
        })

        // 3. Fetch Delivery Orders that are PENDING/RECEIVED
        const newDeliveries = await prisma.order.findMany({
            where: {
                tenantId,
                orderType: 'DELIVERY',
                deliveryInfo: { deliveryStatus: 'RECEIVED' }
            },
            include: { deliveryInfo: true },
            orderBy: { openedAt: 'asc' },
        })

        newDeliveries.forEach(delivery => {
            result.push({
                id: `DELIVERY_NEW_${delivery.id}`,
                type: 'DELIVERY_NEW',
                priority: 'HIGH',
                title: '🛵 ออเดอร์ Delivery ใหม่',
                message: `ลูกค้า: ${delivery.deliveryInfo?.customerName} ${delivery.deliveryInfo?.isPrepaid ? '(โอนเงินแล้ว)' : ''}`,
                metadata: delivery,
                createdAt: delivery.openedAt.toISOString()
            })
        })

        // 4. Fetch Low Stock -> future

        return ok(result)
    } catch (e: any) {
        console.error('Notification API err:', e)
        return err(e.message)
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])
