// @ts-nocheck
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/billing/wallet?page=1&limit=30
export const GET = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '30'))
    const skip = (page - 1) * limit

    const wallet = await prisma.wallet.findUnique({
        where: { tenantId },
        include: {
            ledger: {
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            },
        },
    })

    if (!wallet) return err('Wallet not found', 404)

    const total = await prisma.walletLedger.count({ where: { tenantId } })

    return ok({
        balanceLAK: wallet.balanceLAK,
        ledger: wallet.ledger,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
    })
})
