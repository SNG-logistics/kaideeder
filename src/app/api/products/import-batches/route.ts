import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'

/**
 * GET  /api/products/import-batches
 *   → รายการ import batch ล่าสุด (30 batches)
 *
 * DELETE /api/products/import-batches?batchId=import-1710000000000
 *   → ลบทุก product ในชุด batch นั้น (rollback)
 */

// ── GET: list recent batches ──────────────────────────────────────────────────
export const GET = withAuth<any>(async (_req: NextRequest, ctx: any) => {
    const { tenantId } = ctx

    // ดึง products ที่มี note: [BATCH:...]
    const products = await prisma.product.findMany({
        where: {
            tenantId,
            note: { startsWith: '[BATCH:' },
        },
        select: { sku: true, name: true, note: true, createdAt: true, category: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
    })

    // Group by batchId
    const batchMap = new Map<string, {
        batchId: string
        count: number
        createdAt: Date
        samples: string[]
    }>()

    for (const p of products) {
        const match = p.note?.match(/^\[BATCH:([\w-]+)\]/)
        if (!match) continue
        const batchId = match[1]
        if (!batchMap.has(batchId)) {
            batchMap.set(batchId, { batchId, count: 0, createdAt: p.createdAt, samples: [] })
        }
        const entry = batchMap.get(batchId)!
        entry.count++
        if (entry.samples.length < 3) entry.samples.push(p.name)
        if (p.createdAt < entry.createdAt) entry.createdAt = p.createdAt
    }

    const batches = [...batchMap.values()]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 30)

    return NextResponse.json({ success: true, data: batches })

}, ['OWNER', 'MANAGER'])


// ── DELETE: rollback a batch ──────────────────────────────────────────────────
export const DELETE = withAuth<any>(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const url = new URL(req.url)
    const batchId = url.searchParams.get('batchId')

    if (!batchId) {
        return NextResponse.json({ success: false, error: 'ต้องระบุ batchId' }, { status: 400 })
    }

    // ตรวจสอบความเป็นเจ้าของก่อนลบ
    const products = await prisma.product.findMany({
        where: {
            tenantId,
            note: { startsWith: `[BATCH:${batchId}]` },
        },
        select: { id: true, name: true, sku: true },
    })

    if (products.length === 0) {
        return NextResponse.json({ success: false, error: `ไม่พบ batch "${batchId}" หรืออาจถูกลบไปแล้ว` }, { status: 404 })
    }

    const ids = products.map(p => p.id)

    // ลบ inventory ที่เกี่ยวข้องก่อน (เพื่อไม่ให้ FK constraint error)
    await prisma.inventory.deleteMany({ where: { tenantId, productId: { in: ids } } })
    await prisma.productAlias.deleteMany({ where: { tenantId, productId: { in: ids } } })
    await prisma.skuSuggestion.deleteMany({ where: { tenantId, suggestedSku: { in: products.map(p => p.sku) } } })

    // ลบ products
    const deleted = await prisma.product.deleteMany({
        where: { tenantId, id: { in: ids } }
    })

    return NextResponse.json({
        success: true,
        batchId,
        deleted: deleted.count,
        names: products.map(p => p.name).slice(0, 10),
    })

}, ['OWNER', 'MANAGER'])
