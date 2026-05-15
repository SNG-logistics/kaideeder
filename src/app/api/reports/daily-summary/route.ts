import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/reports/daily-summary?date=YYYY-MM-DD
export const GET = withAuth(async (req: NextRequest) => {
    const url = new URL(req.url)
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0]

    const start = new Date(date + 'T00:00:00+07:00')
    const end = new Date(date + 'T23:59:59+07:00')

    try {
        // ── Orders ────────────────────────────────────────────
        const orders = await prisma.order.findMany({
            where: { closedAt: { gte: start, lte: end }, status: 'CLOSED' },
            include: {
                payments: true,
                items: { include: { product: { include: { category: true } } } }
            }
        })

        let totalRevenue = 0, cashRevenue = 0, transferRevenue = 0
        for (const o of orders) {
            totalRevenue += o.totalAmount
            for (const p of o.payments) {
                if (p.method === 'CASH') cashRevenue += p.amount
                else if (p.method === 'TRANSFER') transferRevenue += p.amount
            }
        }

        // ── Top 5 Menus ───────────────────────────────────────
        const menuMap = new Map<string, { name: string; qty: number; revenue: number }>()
        for (const o of orders) {
            for (const item of o.items) {
                if (item.isCancelled) continue
                const key = item.productId
                const cur = menuMap.get(key) || { name: item.product.name, qty: 0, revenue: 0 }
                cur.qty += item.quantity
                cur.revenue += item.unitPrice * item.quantity
                menuMap.set(key, cur)
            }
        }
        const topMenus = [...menuMap.values()]
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5)

        const allSoldItems = [...menuMap.values()]
            .sort((a, b) => a.name.localeCompare(b.name))

        // ── Opening/Closing Stock Snapshot ────────────────────
        const lowStock = await prisma.inventory.findMany({
            where: {
                product: { isActive: true },
                quantity: { gt: -9999 }
            },
            include: {
                product: { select: { name: true, unit: true, minQty: true, sku: true } },
                location: { select: { code: true, name: true } }
            },
            orderBy: { quantity: 'asc' },
            take: 5
        })

        // ── Waste of the day ──────────────────────────────────
        const wasteItems = await prisma.stockMovement.findMany({
            where: { type: 'WASTE', createdAt: { gte: start, lte: end } },
            include: { product: { select: { name: true, unit: true, costPrice: true } } }
        })
        const wasteTotalValue = wasteItems.reduce((s, w) => s + w.totalCost, 0)

        // ── Purchase received today ───────────────────────────
        const purchased = await prisma.stockMovement.findMany({
            where: { type: 'PURCHASE', createdAt: { gte: start, lte: end } }
        })
        const purchaseTotalCost = purchased.reduce((s, p) => s + p.totalCost, 0)

        return ok({
            date,
            orders: {
                count: orders.length,
                totalRevenue,
                cashRevenue,
                transferRevenue,
                avgOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
            },
            topMenus,
            allSoldItems,
            stock: {
                lowItems: lowStock.filter(i => i.product.minQty > 0 && i.quantity <= i.product.minQty).map(i => ({
                    name: i.product.name,
                    quantity: i.quantity,
                    unit: i.product.unit,
                    minQty: i.product.minQty,
                    location: i.location.code
                }))
            },
            waste: {
                count: wasteItems.length,
                totalValue: wasteTotalValue
            },
            purchase: {
                count: purchased.length,
                totalCost: purchaseTotalCost
            }
        })
    } catch (error: any) {
        console.error('Daily summary error:', error)
        return err('Failed to generate daily summary')
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])
