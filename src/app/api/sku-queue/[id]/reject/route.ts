import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'

/** POST /api/sku-queue/[id]/reject */
export const POST = withAuth<any>(async (req: NextRequest, ctx: any) => {
    const { tenantId, userId } = ctx
    const id = ctx.params?.id as string
    const body = await req.json().catch(() => ({}))

    const suggestion = await prisma.skuSuggestion.findFirst({ where: { id, tenantId } })
    if (!suggestion) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
    if (suggestion.status !== 'PENDING') return NextResponse.json({ error: 'รายการนี้ถูกจัดการแล้ว' }, { status: 409 })

    await prisma.skuSuggestion.update({
        where: { id },
        data: { status: 'REJECTED', resolvedById: userId, resolvedAt: new Date(), note: body.note || null },
    })
    await prisma.auditLog.create({
        data: {
            actorType: 'TENANT_USER', userId, tenantId,
            action: 'SKU_REJECT',
            payload: { suggestionId: id, rawName: suggestion.rawName, note: body.note } as any,
        },
    }).catch(() => { })

    return NextResponse.json({ success: true, id })
}, ['OWNER', 'MANAGER'])
