import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/reports/sales?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export const GET = withAuth(async (req: NextRequest, context) => {
  const { tenantId } = context as any
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')

  if (!startDate || !endDate) return err('Missing startDate or endDate', 400)

  const start = new Date(startDate + 'T00:00:00+07:00')
  const end = new Date(endDate + 'T23:59:59+07:00')

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return err('Invalid date format', 400)

  try {
    const orders = await prisma.order.findMany({
      where: { tenantId, closedAt: { gte: start, lte: end }, status: 'CLOSED' },
      include: {
        payments: true,
        items: {
          include: { product: { include: { category: true } } }
        },
        table: true,
      },
      orderBy: { closedAt: 'asc' }
    })

    // ── Summary ──────────────────────────────────────────
    let totalSales = 0, cashSales = 0, transferSales = 0
    for (const o of orders) {
      totalSales += o.totalAmount
      for (const p of o.payments) {
        if (p.method === 'CASH') cashSales += p.amount
        else if (p.method === 'TRANSFER') transferSales += p.amount
      }
    }

    // ── Top Menus ─────────────────────────────────────────
    const menuMap = new Map<string, { name: string; qty: number; revenue: number; category: string }>()
    for (const o of orders) {
      for (const item of o.items) {
        if (item.isCancelled) continue
        const key = item.productId
        const cur = menuMap.get(key) || { name: item.product.name, qty: 0, revenue: 0, category: item.product?.category?.name || '-' }
        cur.qty += item.quantity
        cur.revenue += item.unitPrice * item.quantity
        menuMap.set(key, cur)
      }
    }
    const topMenus = [...menuMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // ── By Category ───────────────────────────────────────
    const catMap = new Map<string, { name: string; revenue: number; qty: number }>()
    for (const o of orders) {
      for (const item of o.items) {
        if (item.isCancelled) continue
        const cat = item.product?.category?.name || 'อื่นๆ'
        const cur = catMap.get(cat) || { name: cat, revenue: 0, qty: 0 }
        cur.revenue += item.unitPrice * item.quantity
        cur.qty += item.quantity
        catMap.set(cat, cur)
      }
    }
    const byCategory = [...catMap.values()].sort((a, b) => b.revenue - a.revenue)

    // ── Daily Breakdown ───────────────────────────────────
    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>()
    for (const o of orders) {
      const d = o.closedAt!.toISOString().split('T')[0]
      const cur = dailyMap.get(d) || { date: d, revenue: 0, orders: 0 }
      cur.revenue += o.totalAmount
      cur.orders++
      dailyMap.set(d, cur)
    }
    const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date))

    return ok({
      startDate, endDate,
      summary: {
        totalSales, cashSales, transferSales,
        orderCount: orders.length,
        avgOrderValue: orders.length > 0 ? Math.round(totalSales / orders.length) : 0,
      },
      topMenus,
      byCategory,
      daily,
    })
  } catch (error: any) {
    console.error('Sales report error:', error)
    return err('Failed to fetch sales report')
  }
}, ['OWNER', 'MANAGER', 'CASHIER'])
