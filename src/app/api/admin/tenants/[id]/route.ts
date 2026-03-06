// @ts-nocheck
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth, ok, err } from '@/lib/admin-auth'
import { z } from 'zod'

// GET /api/admin/tenants/[id]
export const GET = withAdminAuth(async (_req: NextRequest, context) => {
    const id = (await context.params)?.id
    if (!id) return err('Missing id', 400)

    const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: {
            wallet: { include: { ledger: { orderBy: { createdAt: 'desc' }, take: 50 } } },
            subs: { include: { plan: true }, orderBy: { startAt: 'desc' } },
            topups: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
    })

    if (!tenant) return err('Tenant not found', 404)
    return ok(tenant)
})

// PATCH /api/admin/tenants/[id] — suspend / activate / change plan
const patchSchema = z.object({
    status: z.enum(['ACTIVE', 'PAST_DUE', 'SUSPENDED']).optional(),
    name: z.string().optional(),
    subEndsAt: z.string().datetime().optional(),
    graceEndsAt: z.string().datetime().optional(),
    note: z.string().optional(),
})

export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
    const id = (await context.params)?.id
    if (!id) return err('Missing id', 400)

    try {
        const body = patchSchema.parse(await req.json())

        const tenant = await prisma.tenant.findUnique({ where: { id } })
        if (!tenant) return err('Tenant not found', 404)

        const updated = await prisma.$transaction(async (tx) => {
            const t = await tx.tenant.update({
                where: { id },
                data: {
                    ...(body.status && { status: body.status }),
                    ...(body.name && { name: body.name }),
                    ...(body.subEndsAt && { subEndsAt: new Date(body.subEndsAt) }),
                    ...(body.graceEndsAt && { graceEndsAt: new Date(body.graceEndsAt) }),
                },
            })

            await tx.auditLog.create({
                data: {
                    actorType: 'ADMIN',
                    adminId: context.admin.adminId,
                    tenantId: id,
                    action: body.status ? `SET_TENANT_STATUS_${body.status}` : 'UPDATE_TENANT',
                    payload: { before: { status: tenant.status, name: tenant.name }, after: body, note: body.note },
                },
            })

            return t
        })

        return ok(updated)
    } catch {
        return err('Invalid request')
    }
}, 'ADMIN1')
