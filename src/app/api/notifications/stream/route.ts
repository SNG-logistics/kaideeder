import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { NotificationInfo } from '../route'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['owner', 'manager', 'cashier', 'kitchen', 'bar']

async function fetchNotifs(tenantId: string): Promise<NotificationInfo[]> {
    const result: NotificationInfo[] = []

    const [pendingOrders, billRequests, newDeliveries] = await Promise.all([
        // ⚠️ note: { not: { contains } } silently excludes NULL — use OR to include null notes
        prisma.order.findMany({
            where: {
                tenantId,
                status: 'PENDING_CONFIRM',
                OR: [
                    { note: null },
                    { note: { not: { contains: 'เรียกเช็คบิล' } } },
                ],
            },
            include: { table: true, items: { include: { product: true } } },
            orderBy: { openedAt: 'asc' },
        }),
        prisma.order.findMany({
            where: { tenantId, status: { in: ['OPEN', 'PENDING_CONFIRM'] }, note: { contains: 'เรียกเช็คบิล' } },
            include: { table: true, items: { include: { product: true } } },
            orderBy: { openedAt: 'asc' },
        }),
        prisma.order.findMany({
            where: { tenantId, orderType: 'DELIVERY', deliveryInfo: { deliveryStatus: 'RECEIVED' } },
            include: { deliveryInfo: true },
            orderBy: { openedAt: 'asc' },
        }),
    ])

    pendingOrders.forEach(order => {
        result.push({
            id: `ORDER_NEW_${order.id}`,
            type: 'ORDER_NEW',
            priority: 'HIGH',
            title: 'ออเดอร์ใหม่จากลูกค้า',
            message: order.table ? `โต๊ะ ${order.table.name} — ${order.table.zone}` : 'ออเดอร์ใหม่',
            metadata: order,
            createdAt: order.openedAt.toISOString(),
        })
    })

    billRequests.forEach(bill => {
        result.push({
            id: `BILL_REQ_${bill.id}`,
            type: 'BILL_REQUEST',
            priority: 'HIGH',
            title: 'ลูกค้าเรียกเช็คบิล!',
            message: bill.table ? `โต๊ะ ${bill.table.name} — ${bill.table.zone}` : 'เรียกเช็คบิล',
            metadata: bill,
            createdAt: bill.openedAt.toISOString(),
        })
    })

    newDeliveries.forEach(d => {
        result.push({
            id: `DELIVERY_NEW_${d.id}`,
            type: 'DELIVERY_NEW',
            priority: 'HIGH',
            title: '🛵 ออเดอร์ Delivery ใหม่',
            message: `ลูกค้า: ${d.deliveryInfo?.customerName}`,
            metadata: d,
            createdAt: d.openedAt.toISOString(),
        })
    })

    return result
}

// GET /api/notifications/stream — SSE real-time push
export async function GET(req: NextRequest) {
    // Auth from cookie or Authorization header
    const token =
        req.cookies.get('token')?.value ||
        req.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let user: any
    try {
        user = verifyToken(token)
    } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    if (!user || !ALLOWED_ROLES.includes(user.role?.toLowerCase())) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tenantId = user.tenantId

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        async start(controller) {
            let closed = false

            function send(data: string) {
                if (!closed) {
                    try {
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                    } catch { closed = true }
                }
            }

            // Send initial snapshot immediately on connect
            try {
                const notifs = await fetchNotifs(tenantId)
                send(JSON.stringify({ type: 'notifications', data: notifs }))
            } catch (e) {
                console.error('[SSE] Initial fetch failed', e)
            }

            // Poll DB every 1.5s and push to client
            const iv = setInterval(async () => {
                if (closed) { clearInterval(iv); return }
                try {
                    const notifs = await fetchNotifs(tenantId)
                    send(JSON.stringify({ type: 'notifications', data: notifs }))
                } catch (e) {
                    console.error('[SSE] Poll failed', e)
                }
            }, 1500)

            // Keep-alive ping every 20s to prevent proxy/Nginx buffering timeouts
            const ping = setInterval(() => {
                if (closed) { clearInterval(ping); return }
                try {
                    controller.enqueue(encoder.encode(`: ping\n\n`))
                } catch { closed = true; clearInterval(ping); clearInterval(iv) }
            }, 20000)

            // Clean up on client disconnect
            req.signal.addEventListener('abort', () => {
                closed = true
                clearInterval(iv)
                clearInterval(ping)
                try { controller.close() } catch { }
            })
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',   // Nginx: disable response buffering for SSE
            'Connection': 'keep-alive',
        },
    })
}
