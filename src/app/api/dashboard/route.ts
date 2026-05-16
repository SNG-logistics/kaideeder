import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok } from '@/lib/api'
import { getBusinessDayRange, todayBusinessDate } from '@/lib/businessDate'

// GET /api/dashboard — Dashboard data
export const GET = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const url = new URL(req.url)

    // Read tenant closingHour for business day boundary
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { closingHour: true } as any,
    })
    const closingHour = (tenant as any)?.closingHour ?? 0
    const dateStr = url.searchParams.get('date') || todayBusinessDate(closingHour)

    const { start: startOfDay, end: endOfDay } = getBusinessDayRange(dateStr, closingHour)

    const [
        posOrders,
        salesImport,
        stockValue,
        purchaseToday,
        lowStockItems,
    ] = await Promise.all([
        // All CLOSED orders today (POS + QR mobile)
        prisma.order.findMany({
            where: {
                tenantId,
                status: 'CLOSED',
                closedAt: { gte: startOfDay, lte: endOfDay },
            },
            include: {
                items: { where: { isCancelled: false }, include: { product: true } },
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

    // === Payment Method Breakdown ===
    const paymentBreakdown: Record<string, number> = {}
    for (const order of posOrders) {
        for (const pay of order.payments) {
            const method = pay.method || 'OTHER'
            paymentBreakdown[method] = (paymentBreakdown[method] ?? 0) + pay.amount
        }
    }
    const cashTotal = paymentBreakdown['CASH'] ?? 0
    // TRANSFER + QRCODE both count as "โอน/สแกน"
    const transferTotal = (paymentBreakdown['TRANSFER'] ?? 0) + (paymentBreakdown['QRCODE'] ?? 0)
    const cardTotal = paymentBreakdown['CARD'] ?? 0
    const otherTotal = Object.entries(paymentBreakdown)
        .filter(([k]) => !['CASH', 'TRANSFER', 'QRCODE', 'CARD'].includes(k))
        .reduce((s, [, v]) => s + v, 0)

    // === Legacy SalesImport ===
    const importTotal = salesImport._sum.totalAmount || 0
    const importItems = salesImport._count.id || 0
    const importQty = salesImport._sum.quantity || 0

    // === Combined Sales ===
    const totalSales = posTotalSales + importTotal
    const totalItems = posItemCount + importItems
    const totalQty = posQtyCount + importQty

    // === Recent Orders (latest 20 bills) ===
    const recentOrders = posOrders.slice(0, 20).map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        table: o.table?.name || 'QR',
        total: o.totalAmount,
        paymentMethod: o.payments[0]?.method || '-',
        closedAt: o.closedAt?.toISOString() || '',
        itemCount: o.items.length,
    }))

    // === Hourly Sales ===
    const hourlySales: Record<string, number> = {}
    // Pre-fill business hours (e.g., 08:00 to 22:00)
    for (let i = 6; i <= 23; i++) {
        hourlySales[i.toString().padStart(2, '0') + ':00'] = 0
    }
    for (const o of posOrders) {
        if (o.closedAt) {
            const thTime = new Date(o.closedAt.getTime() + 7 * 3600 * 1000)
            const h = thTime.getUTCHours().toString().padStart(2, '0') + ':00'
            hourlySales[h] = (hourlySales[h] || 0) + o.totalAmount
        }
    }
    const hourlyChart = Object.entries(hourlySales)
        .map(([time, total]) => ({ time, total }))
        .sort((a, b) => a.time.localeCompare(b.time))

    // === Top Items ===
    const itemSales: Record<string, { qty: number, total: number }> = {}
    for (const o of posOrders) {
        for (const item of o.items) {
            const name = item.product.name
            const itemTotal = (item.unitPrice * item.quantity) + item.toppingsTotal
            if (!itemSales[name]) itemSales[name] = { qty: 0, total: 0 }
            itemSales[name].qty += item.quantity
            itemSales[name].total += itemTotal
        }
    }
    const topItems = Object.entries(itemSales)
        .map(([name, stats]) => ({ name, qty: stats.qty, total: stats.total }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5)

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
            byPayment: {
                cash: cashTotal,
                transfer: transferTotal,
                card: cardTotal,
                other: otherTotal,
            },
        },
        recentOrders,
        hourlyChart,
        topItems,
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
