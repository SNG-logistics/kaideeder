import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const createTableSchema = z.object({
    name: z.string().min(1, 'กรุณาระบุชื่อโต๊ะ'),
    zone: z.string().min(1, 'กรุณาระบุโซน'),
    seats: z.number().int().min(1).max(50).default(4),
})

const updateTableSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    zone: z.string().min(1).optional(),
    seats: z.number().int().min(1).max(50).optional(),
    isActive: z.boolean().optional(),
})

// GET /api/settings/tables — list all tables + zone summary (zones from active tables only)
export const GET = withAuth(async (_req, context) => {
    const { tenantId } = context as any
    const tables = await prisma.diningTable.findMany({
        where: { tenantId },
        orderBy: [{ zone: 'asc' }, { number: 'asc' }],
        include: {
            orders: {
                where: { status: 'OPEN' },
                select: { id: true },
                take: 1,
            },
        },
    })

    // Zones derived from ACTIVE tables only — so deleted zones disappear immediately
    const zoneSet = new Set<string>()
    tables.filter(t => t.isActive).forEach(t => zoneSet.add(t.zone))
    const zones = Array.from(zoneSet).sort()

    return ok({ tables, zones })
}, ['owner', 'manager'])


// POST /api/settings/tables — create a new table
export const POST = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const body = await req.json()

    const parsed = createTableSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors.map(e => e.message).join(', '))
    const { name, zone, seats } = parsed.data

    // Auto-assign number (next available)
    const last = await prisma.diningTable.findFirst({
        where: { tenantId },
        orderBy: { number: 'desc' },
        select: { number: true },
    })
    const number = (last?.number ?? 0) + 1

    const table = await prisma.diningTable.create({
        data: { tenantId, name, zone, seats, number },
    })
    return ok(table, 201)
}, ['owner', 'manager'])

// PUT /api/settings/tables — update a table
export const PUT = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const body = await req.json()

    const parsed = updateTableSchema.safeParse(body)
    if (!parsed.success) return err(parsed.error.errors.map(e => e.message).join(', '))
    const { id, ...data } = parsed.data

    const existing = await prisma.diningTable.findUnique({ where: { id } })
    if (!existing || (existing as any).tenantId !== tenantId) return err('ไม่พบโต๊ะ', 404)

    const table = await prisma.diningTable.update({ where: { id }, data })
    return ok(table)
}, ['owner', 'manager'])
