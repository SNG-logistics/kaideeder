import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/bill/[tenantCode]/[tableNum]
// Returns ALL active orders for the table (OPEN + PENDING_CONFIRM) as one unified bill
// Customers see every round they ordered in this session
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

        // Fetch ALL active orders for this table (could be multiple rounds)
        const orders = await prisma.order.findMany({
            where: {
                tenantId: tenant.id,
                tableId: table.id,
                status: { in: ['OPEN', 'PENDING_CONFIRM'] },
            },
            orderBy: { openedAt: 'asc' },  // oldest first = round 1, 2, 3…
            include: {
                items: {
                    where: { isCancelled: false },
                    include: { product: { select: { name: true } } },
                },
            },
        })

        if (orders.length === 0) {
            return NextResponse.json({ hasOrder: false, currency: tenant.currency })
        }

        // Build per-round summary
        const rounds = orders.map((order, idx) => {
            const items = order.items.map(i => ({
                name: i.product?.name ?? 'รายการ',
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                note: i.note,
            }))
            const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
            return {
                round: idx + 1,
                orderId: order.id,
                orderNumber: order.orderNumber,
                status: order.status,   // 'OPEN' or 'PENDING_CONFIRM'
                openedAt: order.openedAt,
                items,
                subtotal,
            }
        })

        const grandTotal = rounds.reduce((s, r) => s + r.subtotal, 0)
        const billRequested = orders.some(o => o.note?.includes('🧾 เรียกเช็คบิล'))
        const hasOpenRound = orders.some(o => o.status === 'OPEN')
        const hasPending = orders.some(o => o.status === 'PENDING_CONFIRM')

        return NextResponse.json({
            hasOrder: true,
            tableNumber,
            tableName: table.name,
            tableZone: table.zone,
            currency: tenant.currency,
            storeName: tenant.displayName || tenant.name,
            totalRounds: rounds.length,
            hasOpenRound,
            hasPending,
            billRequested,
            rounds,
            grandTotal,
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// POST /api/public/bill/[tenantCode]/[tableNum]
// Customer taps "เรียกเช็คบิล" — marks ALL OPEN orders for the table
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

        // Get all OPEN orders for this table
        const openOrders = await prisma.order.findMany({
            where: { tenantId: tenant.id, tableId: table.id, status: 'OPEN' },
        })
        if (openOrders.length === 0) {
            return NextResponse.json({ error: 'ไม่พบออเดอร์ที่เปิดอยู่ กรุณารอพนักงานยืนยันออเดอร์ก่อน' }, { status: 404 })
        }

        const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        const already = openOrders.every(o => o.note?.includes('🧾 เรียกเช็คบิล'))

        if (!already) {
            // Mark ALL open orders, not just one
            await prisma.order.updateMany({
                where: {
                    id: { in: openOrders.map(o => o.id) },
                },
                data: { note: `🧾 เรียกเช็คบิล ${time}` },
            })
        }

        return NextResponse.json({ ok: true, already, count: openOrders.length })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
