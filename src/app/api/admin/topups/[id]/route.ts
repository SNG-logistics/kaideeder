// @ts-nocheck
/**
 * PATCH /api/admin/topups/[id]
 * Body: { action: 'APPROVE' | 'REJECT', note?: string }
 *
 * APPROVE flow (inside a transaction):
 *   1. Update TopupRequest → APPROVED
 *   2. Credit Wallet.balanceLAK
 *   3. Append immutable WalletLedger row (TOPUP)
 *   4. Write AuditLog
 *
 * REJECT flow:
 *   1. Update TopupRequest → REJECTED + rejectedReason
 *   2. Write AuditLog
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth, ok, err } from '@/lib/admin-auth'
import { z } from 'zod'

const schema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('APPROVE'), note: z.string().optional() }),
    z.object({ action: z.literal('REJECT'), note: z.string().min(1, 'Reason required') }),
])

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
    const id = (await context.params)?.id
    if (!id) return err('Missing id', 400)

    let body: z.infer<typeof schema>
    try {
        body = schema.parse(await req.json())
    } catch {
        return err('Invalid request body', 400)
    }

    const topup = await prisma.topupRequest.findUnique({
        where: { id },
        include: { tenant: { include: { wallet: true } } },
    })

    if (!topup) return err('TopupRequest not found', 404)
    if (topup.status !== 'PENDING') return err(`Already ${topup.status}`, 409)

    const { tenant } = topup
    const wallet = tenant?.wallet

    if (body.action === 'APPROVE') {
        if (!wallet) return err('Tenant has no wallet', 500)

        await prisma.$transaction(async (tx) => {
            // 1. Mark topup approved
            await tx.topupRequest.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    reviewedAt: new Date(),
                    reviewedByAdminId: context.admin.adminId,
                },
            })

            // 2. Credit wallet balance (cached fast-read)
            const newBalance = wallet.balanceLAK + topup.amountLAK
            await tx.wallet.update({
                where: { id: wallet.id },
                data: { balanceLAK: newBalance },
            })

            // 3. Immutable ledger row — source of truth
            await tx.walletLedger.create({
                data: {
                    walletId: wallet.id,
                    tenantId: tenant.id,
                    type: 'TOPUP',
                    amountLAK: topup.amountLAK,
                    refType: 'TOPUP',
                    refId: id,
                    note: body.note ?? `Approved by ${context.admin.name}`,
                    createdByAdminId: context.admin.adminId,
                },
            })

            // 4. Audit
        })

        try {
            await prisma.auditLog.create({
                data: {
                    actorType: 'ADMIN',
                    adminId: context.admin.adminId,
                    tenantId: tenant.id,
                    action: 'APPROVE_TOPUP',
                    payload: {
                        topupId: id,
                        amountLAK: topup.amountLAK,
                        newBalanceLAK: wallet.balanceLAK + topup.amountLAK,
                        note: body.note,
                    },
                },
            })
        } catch (auditErr) {
            console.warn('[admin/topups] APPROVE auditLog skipped:', auditErr)
        }

        return ok({ message: 'Topup approved', amountLAK: topup.amountLAK })
    }

    // REJECT
    await prisma.topupRequest.update({
        where: { id },
        data: {
            status: 'REJECTED',
            reviewedAt: new Date(),
            reviewedByAdminId: context.admin.adminId,
        },
    })

    try {
        await prisma.auditLog.create({
            data: {
                actorType: 'ADMIN',
                adminId: context.admin.adminId,
                tenantId: tenant?.id,
                action: 'REJECT_TOPUP',
                payload: { topupId: id, amountLAK: topup.amountLAK, reason: body.note },
            },
        })
    } catch (auditErr) {
        console.warn('[admin/topups] REJECT auditLog skipped:', auditErr)
    }

    return ok({ message: 'Topup rejected' })
}, 'ADMIN1')
