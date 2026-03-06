import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok } from '@/lib/api'

// GET /api/dashboard — Dashboard data
export const GET = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const url = new URL(req.url)
    const dateStr = url.searchParams.get('date') || new Date().toISOString().split('T')[0]

    // B-04 Fix: parse as LAO time (UTC+7) — avoid off-by-one day when server=UTC
    // e.g. '2026-03-02' => 2026-03-02T00:00:00+07:00 in UTC = 2026-03-01T17:00:00Z
    const [y, m, d] = dateStr.split('-').map(Number)
    const startOfDay = new Date(Date.UTC(y, m - 1, d, 0 - 7, 0, 0, 0))   // midnight UTC+7
    const endOfDay = new Date(Date.UTC(y, m - 1, d, 23 - 7, 59, 59, 999)) // 23:59 UTC+7

    const [
        posOrders,
        salesImport,
        stockValue,
        purchaseToday,
        lowStockItems,
    ] = await Promise.all([
        // POS orders (CLOSED) today
        prisma.order.findMany({
            where: {
                tenantId,
                status: 'CLOSED',
                closedAt: { gte: startOfDay, lte: endOfDay },
            },
            include: {
                items: { where: { isCancelled: false } },
                payments: true,
                table: true,
            },
            orderBy: { closedAt: 'desc' },
        }),

        // SalesImport (legacy) today
        prisma.salesImportItem.aggregate({
            where: {
                import: { tenantId, saleDate: { gte: startOfDay, lte: endOfDay }, status: 'COMPLETED' }
            },
            _sum: { totalAmount: true, quantity: true },
            _count: { id: true },
        }),

        // Stock value
        prisma.inventory.findMany({
            where: { tenantId },
            include: { location: true, product: { select: { name: true } } },
        }),

        // Purchase today
        prisma.purchaseOrder.aggregate({
            where: {
                tenantId,
                purchaseDate: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' }
            },
            _sum: { totalAmount: true },
            _count: { id: true },
        }),

        // Low stock
        prisma.inventory.findMany({
            where: { tenantId, product: { isActive: true } },
            include: { product: true, location: true },
        }),
    ])

    // === POS Sales ===
    const posTotalSales = posOrders.reduce((sum, o) => sum + o.totalAmount, 0)
    const posItemCount = posOrders.reduce((sum, o) => sum + o.items.length, 0)
    const posQtyCount = posOrders.reduce((sum, o) =>
        sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)

    // === Legacy SalesImport ===
    const importTotal = salesImport._sum.totalAmount || 0
    const importItems = salesImport._count.id || 0
    const importQty = salesImport._sum.quantity || 0

    // === Combined Sales ===
    const totalSales = posTotalSales + importTotal
    const totalItems = posItemCount + importItems
    const totalQty = posQtyCount + importQty

    // === Recent Orders (for dashboard list) ===
    const recentOrders = posOrders.slice(0, 10).map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        table: o.table?.name || '-',
        total: o.totalAmount,
        paymentMethod: o.payments[0]?.method || '-',
        closedAt: o.closedAt?.toISOString() || '',
        itemCount: o.items.length,
    }))

    // === Stock value ===
    const totalStockValue = stockValue.reduce((sum, inv) => sum + inv.quantity * inv.avgCost, 0)
    const stockByLocation = stockValue.reduce((acc, inv) => {
        const key = inv.location.code
        if (!acc[key]) acc[key] = { name: inv.location.name, value: 0 }
        acc[key].value += inv.quantity * inv.avgCost
        return acc
    }, {} as Record<string, { name: string; value: number }>)

    // === Negative stock items ===
    const negativeStock = stockValue
        .filter(inv => inv.quantity < 0)
        .map(inv => ({
            productName: inv.product.name,
            locationName: inv.location.name,
            qty: inv.quantity,
        }))

    // === Low stock ===
    type LowItem = { productName: string; locationName: string; qty: number; minQty: number }
    const lowItems: LowItem[] = []
    for (const inv of lowStockItems) {
        if (inv.quantity <= inv.product.minQty && inv.product.minQty > 0) {
            lowItems.push({
                productName: inv.product.name,
                locationName: inv.location.name,
                qty: inv.quantity,
                minQty: inv.product.minQty,
            })
        }
    }

    return ok({
        date: dateStr,
        sales: {
            total: totalSales,
            items: totalItems,
            qty: totalQty,
            posTotal: posTotalSales,
            posOrders: posOrders.length,
            importTotal,
        },
        recentOrders,
        stock: {
            total: totalStockValue,
            byLocation: stockByLocation,
            negativeItems: negativeStock,
        },
        purchase: {
            total: purchaseToday._sum.totalAmount || 0,
            orders: purchaseToday._count.id || 0,
        },
        lowStock: {
            count: lowItems.length,
            items: lowItems.slice(0, 10),
        },
    })
})
