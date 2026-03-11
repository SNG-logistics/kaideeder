import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok } from '@/lib/api'

// GET /api/locations
export const GET = withAuth(async (_req, context) => {
    const { tenantId } = context as any
    const locations = await prisma.location.findMany({
        where: { tenantId, isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
            _count: { select: { inventory: true } },
        },
    })
    return ok(locations)
})

// POST /api/locations — create a new warehouse location
export const POST = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const body = await req.json()
    const { name, code, description } = body
    if (!name?.trim()) return NextResponse.json({ success: false, error: 'กรุณาระบุชื่อคลัง' }, { status: 400 })
    if (!code?.trim()) return NextResponse.json({ success: false, error: 'กรุณาระบุรหัสคลัง' }, { status: 400 })

    const existing = await prisma.location.findFirst({ where: { tenantId, code: code.trim().toUpperCase() } })
    if (existing) return NextResponse.json({ success: false, error: `รหัส "${code}" มีอยู่แล้ว` }, { status: 409 })

    const count = await prisma.location.count({ where: { tenantId } })
    const loc = await prisma.location.create({
        data: {
            tenantId,
            name: name.trim(),
            code: code.trim().toUpperCase(),
            description: description?.trim() || null,
            isActive: true,
            sortOrder: count,
        },
    })
    return NextResponse.json({ success: true, data: loc }, { status: 201 })
})
