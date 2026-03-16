import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/bill/[tenantCode]/[tableNum]
// Returns the current OPEN order for a table (for customers to view their own bill)
// POST — customer requests bill check (appends a note to the open order)
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ tenantCode: string; tableNum: string }> }
) {
    const { tenantCode, tableNum } = await params
    const tableNumber = Number(tableNum)
    if (!tenantCode || isNaN(tableNumber)) {
        return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }

    try {
        const tenant = await prisma.tenant.findFirst({
            where: { code: tenantCode, status: 'ACTIVE' },
            select: { id: true, currency: true, displayName: true, name: true },
        })
        if (!tenant) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

        const table = await prisma.diningTable.findFirst({
            where: { tenantId: tenant.id, number: tableNumber, isActive: true },
        })
        if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })

        const order = await prisma.order.findFirst({
            where: { tenantId: tenant.id, tableId: table.id, status: { in: ['OPEN', 'PENDING_CONFIRM'] } },
            orderBy: { openedAt: 'desc' },
            include: {
                items: {
                    where: { isCancelled: false },
                    include: { product: { select: { name: true } } },
                },
            },
        })

        if (!order) {
            return NextResponse.json({ hasOrder: false, currency: tenant.currency })
        }

        const items = order.items.map(i => ({
            name: i.product?.name ?? 'รายการ',
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            note: i.note,
            kitchenStatus: i.kitchenStatus,
        }))

        const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

        return NextResponse.json({
            hasOrder: true,
            status: order.status,
            orderNumber: order.orderNumber,
            orderId: order.id,
            tableNumber,
            currency: tenant.currency,
            storeName: tenant.displayName || tenant.name,
            billRequested: order.note?.includes('🧾 เรียกเช็คบิล') ?? false,
            items,
            subtotal,
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// POST /api/public/bill/[tenantCode]/[tableNum]
// Customer taps "เรียกเช็คบิล" — appends a note to the OPEN order
export async function POST(
    _req: Request,
    { params }: { params: Promise<{ tenantCode: string; tableNum: string }> }
) {
    const { tenantCode, tableNum } = await params
    const tableNumber = Number(tableNum)

    try {
        const tenant = await prisma.tenant.findFirst({
            where: { code: tenantCode, status: 'ACTIVE' },
            select: { id: true },
        })
        if (!tenant) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

        const table = await prisma.diningTable.findFirst({
            where: { tenantId: tenant.id, number: tableNumber, isActive: true },
        })
        if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })

        const order = await prisma.order.findFirst({
            where: { tenantId: tenant.id, tableId: table.id, status: 'OPEN' },
        })
        if (!order) return NextResponse.json({ error: 'ไม่พบออเดอร์ที่เปิดอยู่' }, { status: 404 })

        const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        const existing = order.note || ''
        const already = existing.includes('🧾 เรียกเช็คบิล')
        if (!already) {
            await prisma.order.update({
                where: { id: order.id },
                data: { note: `${existing ? existing + ' | ' : ''}🧾 เรียกเช็คบิล ${time}`.trim() },
            })
        }

        return NextResponse.json({ ok: true, already })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
