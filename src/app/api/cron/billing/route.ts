// @ts-nocheck
/**
 * GET /api/cron/billing
 * Protected by Authorization: Bearer ${CRON_SECRET}
 *
 * Railway cron schedule: 0 1 * * *  (01:00 LAT every day)
 *
 * State machine:
 *   ACTIVE + endAt < now  → PAST_DUE  (graceEndsAt = now + 5d)
 *   PAST_DUE + graceEndsAt < now → SUSPENDED
 *   ACTIVE + autoRenew + endAt TODAY → try wallet deduction → new Subscription
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CRON_SECRET = process.env.CRON_SECRET || ''

export async function GET(req: NextRequest) {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!CRON_SECRET || bearer !== CRON_SECRET) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const results: Record<string, number> = {
        past_due: 0,
        suspended: 0,
        renewed: 0,
        renewal_failed: 0,
    }

    // ── Step 1: ACTIVE → PAST_DUE ────────────────────────────────────────────
    const expiredSubs = await prisma.subscription.findMany({
        where: {
            status: 'ACTIVE',
            endAt: { lt: now },
        },
        include: { tenant: true, plan: true },
    })

    for (const sub of expiredSubs) {
        const graceEndsAt = new Date(now.getTime() + 5 * 86400_000)

        await prisma.$transaction(async (tx) => {
            await tx.subscription.update({
                where: { id: sub.id },
                data: { status: 'ENDED' },
            })

            await tx.tenant.update({
                where: { id: sub.tenantId },
                data: { status: 'PAST_DUE', graceEndsAt },
            })

            await tx.auditLog.create({
                data: {
                    actorType: 'ADMIN',
                    tenantId: sub.tenantId,
                    action: 'BILLING_PAST_DUE',
                    payload: {
                        subId: sub.id,
                        plan: sub.plan.code,
                        endAt: sub.endAt,
                        graceEndsAt,
                    },
                },
            })
        })

        results.past_due++
    }

    // ── Step 2: PAST_DUE + grace expired → SUSPENDED ─────────────────────────
    const gracedOut = await prisma.tenant.findMany({
        where: {
            status: 'PAST_DUE',
            graceEndsAt: { lt: now },
        },
    })

    for (const tenant of gracedOut) {
        await prisma.$transaction(async (tx) => {
            await tx.tenant.update({
                where: { id: tenant.id },
                data: { status: 'SUSPENDED' },
            })

            await tx.auditLog.create({
                data: {
                    actorType: 'ADMIN',
                    tenantId: tenant.id,
                    action: 'BILLING_SUSPENDED',
                    payload: { graceEndsAt: tenant.graceEndsAt },
                },
            })
        })

        results.suspended++
    }

    // ── Step 3: Auto-renew — deduct wallet, create new Subscription ───────────
    const tomorrow = new Date(now.getTime() + 86400_000)

    const autoRenewSubs = await prisma.subscription.findMany({
        where: {
            status: 'ACTIVE',
            autoRenew: true,
            endAt: { gte: now, lt: tomorrow },
        },
        include: {
            plan: true,
            tenant: { include: { wallet: true } },
        },
    })

    for (const sub of autoRenewSubs) {
        const wallet = sub.tenant?.wallet
        if (!wallet || wallet.balanceLAK < sub.plan.priceLAK) {
            // Insufficient funds — let it expire naturally (step 1 tomorrow)
            results.renewal_failed++
            continue
        }

        await prisma.$transaction(async (tx) => {
            const newBalance = wallet.balanceLAK - sub.plan.priceLAK
            const newStart = sub.endAt
            const newEnd = new Date(sub.endAt.getTime() + sub.plan.durationDays * 86400_000)

            // Deduct wallet
            await tx.wallet.update({
                where: { id: wallet.id },
                data: { balanceLAK: newBalance },
            })

            // Immutable ledger row
            await tx.walletLedger.create({
                data: {
                    walletId: wallet.id,
                    tenantId: sub.tenantId,
                    type: 'RENT_FEE',
                    amountLAK: -sub.plan.priceLAK,
                    refType: 'SUBSCRIPTION',
                    refId: sub.id,
                    note: `Auto-renew ${sub.plan.code}`,
                },
            })

            // New subscription period
            const newSub = await tx.subscription.create({
                data: {
                    tenantId: sub.tenantId,
                    planId: sub.planId,
                    startAt: newStart,
                    endAt: newEnd,
                    status: 'ACTIVE',
                    autoRenew: true,
                },
            })

            // Update tenant expiry
            await tx.tenant.update({
                where: { id: sub.tenantId },
                data: { status: 'ACTIVE', subEndsAt: newEnd, graceEndsAt: null },
            })

            await tx.auditLog.create({
                data: {
                    actorType: 'ADMIN',
                    tenantId: sub.tenantId,
                    action: 'BILLING_AUTO_RENEW',
                    payload: {
                        plan: sub.plan.code,
                        priceLAK: sub.plan.priceLAK,
                        newSubId: newSub.id,
                        newBalance,
                        periodEnd: newEnd,
                    },
                },
            })
        })

        results.renewed++
    }

    console.log(`[cron/billing] ${now.toISOString()}`, results)

    return NextResponse.json({
        success: true,
        timestamp: now.toISOString(),
        results,
    })
}
