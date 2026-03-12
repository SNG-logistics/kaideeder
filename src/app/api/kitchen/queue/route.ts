import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/kitchen/queue — Kitchen queue view
export const GET = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const url = new URL(req.url)
    const station = url.searchParams.get('station') || ''
    const statusParam = url.searchParams.get('status') || 'PENDING,ACCEPTED,COOKING,READY'
    const statuses = statusParam.split(',').map(s => s.trim())

    const where: Record<string, unknown> = {
        kitchenStatus: { in: statuses },
        isCancelled: false,
        order: { tenantId, status: 'OPEN' },   // ← tenant scoped here
    }
    if (station === 'BAR') {
        where.stationId = 'BAR'
    } else if (station === 'KITCHEN') {
        where.OR = [{ stationId: 'KITCHEN' }, { stationId: null }]
    }

    const items = await prisma.orderItem.findMany({
        where,
        include: {
            product: { select: { id: true, sku: true, name: true, category: true, imageUrl: true, imageBase64: true } },
            order: {
                select: {
                    id: true, orderNumber: true, openedAt: true, note: true,
                    table: { select: { id: true, name: true, zone: true } },
                },
            },
            statusChangedBy: { select: { id: true, name: true } },
        },
        orderBy: [
            { kitchenStatus: 'asc' }, // PENDING first
            { order: { openedAt: 'asc' } }, // oldest first
        ],
    })

    // Resolve imageUrl from base64 (production-safe)
    const itemsWithImages = items.map(item => ({
        ...item,
        product: {
            ...item.product,
            imageUrl: item.product.imageBase64
                ? `data:image/webp;base64,${item.product.imageBase64}`
                : item.product.imageUrl || null,
            imageBase64: undefined,
        }
    }))

    // Group by order for display
    const grouped: Record<string, {
        orderId: string; orderNumber: string; tableName: string; zone: string;
        openedAt: Date; orderNote: string | null;
        items: typeof itemsWithImages;
    }> = {}

    for (const item of itemsWithImages) {
        const key = item.orderId
        if (!grouped[key]) {
            grouped[key] = {
                orderId: item.order.id,
                orderNumber: item.order.orderNumber,
                tableName: item.order.table?.name || '-',
                zone: item.order.table?.zone || '-',
                openedAt: item.order.openedAt,
                orderNote: item.order.note,
                items: [],
            }
        }
        grouped[key].items.push(item)
    }

    return ok({
        queue: Object.values(grouped),
        totalItems: items.length,
        byStatus: {
            PENDING: items.filter(i => i.kitchenStatus === 'PENDING').length,
            ACCEPTED: items.filter(i => i.kitchenStatus === 'ACCEPTED').length,
            COOKING: items.filter(i => i.kitchenStatus === 'COOKING').length,
            READY: items.filter(i => i.kitchenStatus === 'READY').length,
        },
    })
}, ['OWNER', 'MANAGER', 'KITCHEN', 'BAR', 'CASHIER'])
