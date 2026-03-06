// @ts-nocheck
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const schema = z.object({
    amountLAK: z.number().int().min(10_000, 'Minimum 10,000 LAK'),
    channel: z.string().min(1),  // BCEL / transfer / cash
    proofUrl: z.string().url().optional(),
    note: z.string().optional(),
})

// POST /api/billing/topup — Owner submits topup request
export const POST = withAuth(async (req: NextRequest, context) => {
    try {
        const { tenantId } = context
        const userId = context.user!.userId
        const body = schema.parse(await req.json())

        // Prevent duplicate pending requests
        const pending = await prisma.topupRequest.findFirst({
            where: { tenantId, status: 'PENDING' },
        })
        if (pending) return err('คุณมีคำขอเติมเงินที่รอการอนุมัติอยู่แล้ว', 409)

        const topup = await prisma.topupRequest.create({
            data: {
                tenantId,
                userId,
                amountLAK: body.amountLAK,
                channel: body.channel,
                proofUrl: body.proofUrl,
            },
        })

        return ok(topup, 201)
    } catch (e: any) {
        if (e?.errors) return err(e.errors.map((x: any) => x.message).join(', '))
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER'])

// GET /api/billing/topup — Owner views their topup history
export const GET = withAuth(async (_req: NextRequest, context) => {
    const { tenantId } = context

    const topups = await prisma.topupRequest.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })

    return ok(topups)
})
