import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const itemSelect = {
    id: true, productId: true, locationId: true, systemQty: true, countedQty: true, difference: true, unit: true,
    product: { select: { id: true, name: true, sku: true, unit: true, category: { select: { name: true, icon: true, color: true } } } },
    location: { select: { id: true, code: true, name: true } },
}

// GET /api/stock-count  → list all counts (newest first)
export const GET = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const counts = await prisma.stockCount.findMany({
        where: {
            tenantId,
            ...(status ? { status: status as any } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
            location: { select: { code: true, name: true } },
            _count: { select: { items: true } },
        },
    })

    // Annotate with pending count (items not yet counted)
    const annotated = await Promise.all(counts.map(async c => {
        const pending = c.status === 'IN_PROGRESS'
            ? await prisma.stockCountItem.count({ where: { countId: c.id, countedQty: null } })
            : 0
        return { ...c, pendingCount: pending }
    }))

    return ok(annotated)
}, ['OWNER', 'MANAGER'])

// POST /api/stock-count  → create new sheet + auto-populate items
export const POST = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const body = await req.json()
    const { name, locationId, note } = z.object({
        name: z.string().min(1, 'ต้องระบุชื่อ'),
        locationId: z.string().optional().nullable(),
        note: z.string().optional(),
    }).parse(body)

    // Fetch current inventory to auto-populate items (snapshot preview)
    const inventory = await prisma.inventory.findMany({
        where: {
            tenantId,
            ...(locationId ? { locationId } : {}),
            product: { isActive: true },
        },
        include: {
            product: { select: { unit: true } },
            location: { select: { id: true } },
        },
        orderBy: [{ location: { code: 'asc' } }, { product: { name: 'asc' } }],
    })

    const count = await prisma.stockCount.create({
        data: {
            tenantId,
            name,
            locationId: locationId || null,
            note,
            status: 'DRAFT',
            items: {
                create: inventory.map(inv => ({
                    tenantId,
                    productId: inv.productId,
                    locationId: inv.locationId,
                    systemQty: inv.quantity, // preview only — will re-snapshot at START
                    unit: inv.product.unit,
                })),
            },
        },
        include: {
            items: { select: itemSelect },
            location: { select: { code: true, name: true } },
        },
    })

    return ok(count)
}, ['OWNER', 'MANAGER'])
