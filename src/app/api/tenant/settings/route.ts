import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'

// ── GET /api/tenant/settings ─────────────────────────────────────────────────
// คืน settings ของ tenant ปัจจุบัน (ทุก role ดูได้)
export const GET = withAuth<any>(async (_req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
            id: true, code: true, name: true, displayName: true,
            storeNameLao: true, logoUrl: true, status: true,
            currency: true, language: true, phone: true,
            address: true, taxId: true, receiptHeader: true, timezone: true,
        },
    })
    console.log('[DEBUG /api/tenant/settings] tenantId:', tenantId, 'found tenant?', !!tenant)
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    return NextResponse.json({ settings: tenant })
})

// ── PATCH /api/tenant/settings ────────────────────────────────────────────────
// อัปเดต settings ของ tenant — เฉพาะ OWNER/MANAGER
export const PATCH = withAuth<any>(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const role = (ctx.user?.role || '').toUpperCase()
    if (!['OWNER', 'MANAGER'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()

    // fields ที่อนุญาตให้แก้ไข
    const allowed = [
        'displayName', 'storeNameLao', 'currency', 'language',
        'phone', 'address', 'taxId', 'receiptHeader', 'timezone',
    ] as const

    const data: Record<string, unknown> = {}
    for (const key of allowed) {
        if (key in body) data[key] = body[key] ?? null
    }

    // Validate currency
    if (data.currency && !['LAK', 'THB'].includes(data.currency as string)) {
        return NextResponse.json({ error: 'Invalid currency. Use LAK or THB' }, { status: 400 })
    }
    // Validate language
    if (data.language && !['th', 'lo', 'both'].includes(data.language as string)) {
        return NextResponse.json({ error: 'Invalid language. Use th, lo, or both' }, { status: 400 })
    }

    const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data,
        select: {
            id: true, code: true, name: true, displayName: true,
            storeNameLao: true, logoUrl: true,
            currency: true, language: true, phone: true,
            address: true, taxId: true, receiptHeader: true, timezone: true,
        },
    })

    return NextResponse.json({ success: true, settings: updated })
})
