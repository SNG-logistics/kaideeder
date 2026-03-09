// @ts-nocheck
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth, ok, err } from '@/lib/admin-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

// GET /api/admin/tenants — list all tenants with wallet + active sub
export const GET = withAdminAuth(async (_req: NextRequest) => {
    const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            wallet: { select: { balanceLAK: true } },
            subs: {
                where: { status: 'ACTIVE' },
                orderBy: { endAt: 'desc' },
                take: 1,
                include: { plan: { select: { code: true, name: true } } },
            },
        },
    })

    const result = tenants.map(t => ({
        id: t.id,
        code: t.code,
        name: t.name,
        status: t.status,
        subEndsAt: t.subEndsAt,
        graceEndsAt: t.graceEndsAt,
        walletLAK: t.wallet?.balanceLAK ?? 0,
        activePlan: t.subs[0]?.plan ?? null,
        activeSubEndAt: t.subs[0]?.endAt ?? null,
    }))

    return ok(result)
})

// POST /api/admin/tenants — create new tenant + wallet (SuperAdmin only)
const createSchema = z.object({
    code: z.string().min(2).max(30),
    name: z.string().min(1),
    planId: z.string().optional(),
    trialDays: z.number().int().min(0).default(14),
})

export const POST = withAdminAuth(async (req: NextRequest, context) => {
    try {
        const body = createSchema.parse(await req.json())

        const existing = await prisma.tenant.findUnique({ where: { code: body.code } })
        if (existing) return err(`Tenant code "${body.code}" already exists`)

        const now = new Date()
        const trialEnd = new Date(now.getTime() + body.trialDays * 86400_000)

        const tenant = await prisma.$transaction(async (tx) => {
            const t = await tx.tenant.create({
                data: {
                    code: body.code,
                    name: body.name,
                    status: 'ACTIVE',
                    subEndsAt: trialEnd,
                    graceEndsAt: new Date(trialEnd.getTime() + 5 * 86400_000),
                },
            })

            // Seed wallet
            await tx.wallet.create({ data: { tenantId: t.id, balanceLAK: 0 } })

            // Seed trial subscription if planId provided
            if (body.planId) {
                await tx.subscription.create({
                    data: {
                        tenantId: t.id,
                        planId: body.planId,
                        startAt: now,
                        endAt: trialEnd,
                        status: 'ACTIVE',
                        autoRenew: false,
                    },
                })
            }

            // AuditLog
            await tx.auditLog.create({
                data: {
                    actorType: 'ADMIN',
                    adminId: context.admin.adminId,
                    tenantId: t.id,
                    action: 'CREATE_TENANT',
                    payload: { code: body.code, name: body.name, trialDays: body.trialDays },
                },
            })

            // Seed default owner user
            const ownerHash = bcrypt.hashSync('owner1234', 12)
            await tx.user.create({
                data: {
                    tenantId: t.id,
                    username: 'owner',
                    name: 'เจ้าของร้าน',
                    passwordHash: ownerHash,
                    role: 'OWNER',
                    isActive: true,
                }
            })

            return t
        })

        return ok(tenant, 201)
    } catch (e: any) {
        if (e?.code === 'P2002') return err('Code already taken')
        return err('Error creating tenant')
    }
}, 'SUPERADMIN')
