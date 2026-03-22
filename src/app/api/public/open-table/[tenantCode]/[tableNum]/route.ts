import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

function generateOrderNumber(): string {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
    return `ORD-${yy}${mm}${dd}-${rand}`
}

// POST /api/public/open-table/[tenantCode]/[tableNum]
// Staff (logged-in) can open a table directly from the QR menu page
export const POST = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const { tenantCode, tableNum } = ctx.params ?? {}

    // Get tableNum from URL params
    const url = new URL(req.url)
    const parts = url.pathname.split('/')
    const tableNumFromUrl = parseInt(parts[parts.length - 1])
    const tableNumber = tableNumFromUrl || parseInt(tableNum)

    if (!tableNumber || isNaN(tableNumber)) return err('หมายเลขโต๊ะไม่ถูกต้อง')

    // Find table by tenantId + number
    const table = await prisma.diningTable.findFirst({
        where: { tenantId, number: tableNumber, isActive: true },
    })
    if (!table) return err(`ไม่พบโต๊ะ ${tableNumber} ในระบบ`)

    // Check if already open
    const existing = await prisma.order.findFirst({
        where: { tenantId, tableId: table.id, status: 'OPEN' },
    })
    if (existing) return err('โต๊ะนี้เปิดอยู่แล้ว')

    // Generate unique order number
    let orderNumber = generateOrderNumber()
    for (let i = 0; i < 10; i++) {
        const exists = await prisma.order.findFirst({ where: { tenantId, orderNumber } })
        if (!exists) break
        orderNumber = generateOrderNumber()
    }

    // Create OPEN order
    const order = await prisma.order.create({
        data: {
            tenantId,
            orderNumber,
            tableId: table.id,
            createdById: ctx.user?.userId,
            subtotal: 0,
            totalAmount: 0,
            status: 'OPEN',
        },
    })

    // Mark table OCCUPIED
    await prisma.diningTable.update({
        where: { id: table.id },
        data: { status: 'OCCUPIED' },
    })

    return ok({ orderId: order.id, orderNumber, tableNumber })
}, ['OWNER', 'MANAGER', 'CASHIER'])
