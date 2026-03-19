import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/consume-fail?status=OPEN&page=1&limit=50
// ดึง Fail Queue — ผู้จัดการใช้ดูและเคลียร์
export const GET = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const { searchParams } = new URL(req.url)

    const status = searchParams.get('status') || 'OPEN'   // OPEN | RESOLVED | IGNORED | ALL
    const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit  = Math.min(100, parseInt(searchParams.get('limit') || '50'))
    const skip   = (page - 1) * limit

    const where: any = { tenantId }
    if (status !== 'ALL') where.status = status

    const [items, total] = await Promise.all([
        prisma.consumeFailLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                menu:       { select: { id: true, name: true, sku: true } },
                ingredient: { select: { id: true, name: true, sku: true, unit: true } },
            },
        }),
        prisma.consumeFailLog.count({ where }),
    ])

    // Summary count ตาม failReason สำหรับ dashboard badges
    const summary = await prisma.consumeFailLog.groupBy({
        by: ['failReason'],
        where: { tenantId, status: 'OPEN' },
        _count: { _all: true },
    })

    return ok({
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: summary.map(s => ({ reason: s.failReason, count: s._count._all })),
    })
})

// PATCH /api/consume-fail — bulk update status (resolve หรือ ignore หลายรายการ)
export const PATCH = withAuth(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId } = ctx
        const body = await req.json()
        const { ids, status, resolvedNote } = body

        if (!Array.isArray(ids) || ids.length === 0) return err('ต้องระบุ ids')
        if (!['RESOLVED', 'IGNORED'].includes(status)) return err('status ต้องเป็น RESOLVED หรือ IGNORED')

        // ตรวจสอบว่า ids ทั้งหมดเป็นของ tenant นี้
        const existing = await prisma.consumeFailLog.findMany({
            where: { id: { in: ids }, tenantId },
            select: { id: true },
        })
        const validIds = existing.map(e => e.id)
        if (validIds.length === 0) return err('ไม่พบรายการ')

        const result = await prisma.consumeFailLog.updateMany({
            where: { id: { in: validIds }, tenantId },
            data: {
                status,
                resolvedAt: new Date(),
                resolvedNote: resolvedNote || null,
            },
        })

        return ok({ updated: result.count })
    } catch (error) {
        console.error('Consume fail PATCH error:', error)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER'])
