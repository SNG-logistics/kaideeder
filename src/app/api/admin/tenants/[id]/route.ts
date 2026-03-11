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
            users: {
                select: { id: true, username: true, name: true, role: true, isActive: true, createdAt: true },
                orderBy: { createdAt: 'desc' }
            }
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
            return t
        })

        try {
            await prisma.auditLog.create({
                data: {
                    actorType: 'ADMIN',
                    adminId: context.admin.adminId,
                    tenantId: id,
                    action: body.status ? `SET_TENANT_STATUS_${body.status}` : 'UPDATE_TENANT',
                    payload: { before: { status: tenant.status, name: tenant.name }, after: body, note: body.note },
                },
            })
        } catch (auditErr) {
            console.warn('[admin/tenants/[id]] auditLog skipped:', auditErr)
        }

        return ok(updated)
    } catch {
        return err('Invalid request')
    }
}, 'ADMIN1')

// DELETE /api/admin/tenants/[id] — permanently delete a SUSPENDED tenant (SUPERADMIN only)
export const DELETE = withAdminAuth(async (_req: NextRequest, context) => {
    const id = (await context.params)?.id
    if (!id) return err('Missing id', 400)

    const tenant = await prisma.tenant.findUnique({
        where: { id },
        include: { wallet: true },
    })
    if (!tenant) return err('Tenant not found', 404)
    if (tenant.status !== 'SUSPENDED') return err('Only SUSPENDED tenants can be deleted. Please suspend first.', 400)
    if ((tenant.wallet?.balanceLAK ?? 0) > 0) return err('Tenant has wallet balance. Please refund before deleting.', 400)

    try {
        await prisma.$transaction(async (tx) => {
            // Delete in FK-safe order
            await tx.auditLog.deleteMany({ where: { tenantId: id } })
            await tx.walletLedger.deleteMany({ where: { tenantId: id } })
            await tx.topupRequest.deleteMany({ where: { tenantId: id } })
            await tx.subscription.deleteMany({ where: { tenantId: id } })
            await tx.wallet.deleteMany({ where: { tenantId: id } })
            await tx.user.deleteMany({ where: { tenantId: id } })
            await tx.tenant.delete({ where: { id } })
        })
        return ok({ message: `Tenant "${tenant.name}" deleted permanently` })
    } catch (e: any) {
        console.error('[admin/tenants/[id] DELETE]', e)
        return err('Failed to delete tenant. Check for linked records.', 500)
    }
}, 'SUPERADMIN')
