// @ts-nocheck
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth, ok, err } from '@/lib/admin-auth'
import { z } from 'zod'

// GET /api/admin/plans
export const GET = withAdminAuth(async () => {
    const plans = await prisma.plan.findMany({ orderBy: { priceLAK: 'asc' } })
    return ok(plans)
})

// POST /api/admin/plans
const planSchema = z.object({
    code: z.string().min(2).toUpperCase(),
    name: z.string().min(1),
    priceLAK: z.number().int().min(0),
    durationDays: z.number().int().min(1),
    features: z.record(z.any()).optional(),
    isActive: z.boolean().default(true),
})

export const POST = withAdminAuth(async (req: NextRequest, context) => {
    try {
        const data = planSchema.parse(await req.json())

        const plan = await prisma.$transaction(async (tx) => {
            const p = await tx.plan.create({ data })
            return p
        })

        try {
            await prisma.auditLog.create({
                data: {
                    actorType: 'ADMIN',
                    adminId: context.admin.adminId,
                    action: 'CREATE_PLAN',
                    payload: data,
                },
            })
        } catch (auditErr) {
            console.warn('[admin/plans] auditLog skipped:', auditErr)
        }

        return ok(plan, 201)
    } catch (e: any) {
        if (e?.code === 'P2002') return err('Plan code already exists')
        return err('Error creating plan')
    }
}, 'SUPERADMIN')
