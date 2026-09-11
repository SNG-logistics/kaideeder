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
                // สถานะครัวรายจาน — ลูกค้าใช้ดูว่าอาหารของตัวเองถึงไหนแล้ว
                kitchenStatus: i.kitchenStatus,
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

        // ── สถานะรวมของโต๊ะ — ใช้จานที่ "ช้าที่สุด" เป็นตัวแทน ────────────────
        // ตอบคำถามของลูกค้าว่า "ออเดอร์ของฉันเสร็จหรือยัง" ไม่ใช่ "มีจานไหนเสร็จบ้าง"
        const STAGE_ORDER = ['PENDING', 'ACCEPTED', 'COOKING', 'READY', 'SERVED'] as const
        type Stage = (typeof STAGE_ORDER)[number]

        const liveStatuses = rounds
            .flatMap(r => r.items.map(i => i.kitchenStatus))
            .filter((s): s is Stage => STAGE_ORDER.includes(s as Stage))

        const kitchenStage: Stage = liveStatuses.length === 0
            ? 'PENDING'
            : liveStatuses.reduce((slowest, s) =>
                STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(slowest) ? s : slowest, 'SERVED' as Stage)

        // รอแคชเชียร์ยืนยันอยู่ = ยังไม่ถึงมือครัว ให้แสดงเป็นขั้นแรกเสมอ
        const stage: 'AWAITING_CONFIRM' | Stage = (hasPending && !hasOpenRound)
            ? 'AWAITING_CONFIRM'
            : kitchenStage

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
            stage,
            allServed: liveStatuses.length > 0 && liveStatuses.every(s => s === 'SERVED'),
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
            // ต่อท้ายโน้ตเดิม ห้ามเขียนทับ — โน้ตสั่งอาหารของลูกค้า (เช่น "ไม่ใส่ผักชี")
            // ต้องอยู่ครบ ใช้รูปแบบทีละบรรทัดให้ตรงกับฝั่งยกเลิกคำขอใน pos/bill-requests
            const marker = `🧾 เรียกเช็คบิล ${time}`
            await prisma.$transaction(
                openOrders
                    .filter(o => !o.note?.includes('🧾 เรียกเช็คบิล'))
                    .map(o => prisma.order.update({
                        where: { id: o.id },
                        data: { note: o.note?.trim() ? `${o.note.trim()}\n${marker}` : marker },
                    }))
            )
        }

        return NextResponse.json({ ok: true, already, count: openOrders.length })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
