import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok } from '@/lib/api'

/**
 * GET /api/alerts/low-stock
 *
 * คืน list products ที่ onHand (sum across all locations) < reorderPoint
 * ใช้ reorderPoint ถ้ามี (> 0) ไม่งั้น fallback ไป minQty
 *
 * Query params:
 *   locationId — filter เฉพาะคลังที่ระบุ
 *   count=1    — คืนแค่ { total: N } (สำหรับ sidebar badge)
 */
export const GET = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')
    const countOnly = searchParams.get('count') === '1'

    // Aggregate inventory per product (summing across locations or filtered)
    const inventoryGroups = await prisma.inventory.groupBy({
        by: ['productId'],
        where: {
            tenantId,
            ...(locationId ? { locationId } : {}),
        },
        _sum: { quantity: true },
    })

    if (inventoryGroups.length === 0) return ok(countOnly ? { total: 0 } : [])

    // Fetch products that have reorderPoint or minQty set
    const productIds = inventoryGroups.map(g => g.productId)
    const products = await prisma.product.findMany({
        where: {
            id: { in: productIds },
            tenantId,
            isActive: true,
            OR: [
                { reorderPoint: { gt: 0 } },
                { minQty: { gt: 0 } },
            ],
        },
        select: {
            id: true, name: true, sku: true, unit: true,
            reorderPoint: true, minQty: true,
            category: { select: { name: true, icon: true, color: true } },
        },
    })

    // Map: productId → onHand
    const onHandMap: Record<string, number> = {}
    for (const g of inventoryGroups) {
        onHandMap[g.productId] = g._sum.quantity ?? 0
    }

    // Per-location breakdown for detail view
    const locationDetails = locationId ? undefined : await prisma.inventory.findMany({
        where: { tenantId, productId: { in: productIds } },
        include: { location: { select: { code: true, name: true } } },
    })
    const locDetailMap: Record<string, { code: string; name: string; qty: number }[]> = {}
    if (locationDetails) {
        for (const inv of locationDetails) {
            if (!locDetailMap[inv.productId]) locDetailMap[inv.productId] = []
            locDetailMap[inv.productId].push({ code: inv.location.code, name: inv.location.name, qty: inv.quantity })
        }
    }

    // Filter: only low stock items
    const lowItems = products
        .map(p => {
            const threshold = p.reorderPoint > 0 ? p.reorderPoint : p.minQty
            const onHand = onHandMap[p.id] ?? 0
            const deficit = threshold - onHand
            return { product: p, onHand, threshold, deficit, locations: locDetailMap[p.id] ?? [] }
        })
        .filter(i => i.onHand < i.threshold)
        .sort((a, b) => (b.deficit / b.threshold) - (a.deficit / a.threshold)) // สต็อคขาดมากสุดก่อน

    if (countOnly) return ok({ total: lowItems.length })
    return ok(lowItems)
})
