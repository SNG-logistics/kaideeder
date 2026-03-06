// @ts-nocheck
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'
import { hashPassword } from '@/lib/auth'

// PATCH /api/settings/users/[id] — change role / isActive / password
const patchSchema = z.object({
    role: z.enum(['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'KITCHEN', 'BAR', 'CASHIER', 'VIEWER']).optional(),
    isActive: z.boolean().optional(),
    name: z.string().min(1).optional(),
    password: z.string().min(6).optional(),
})

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
    const id = (await ctx.params)?.id
    if (!id) return err('Missing id', 400)

    const existing = await prisma.user.findFirst({
        where: { id, tenantId: ctx.tenantId },
    })
    if (!existing) return err('User not found', 404)

    // Prevent removing last owner
    if (existing.role === 'OWNER') {
        const body = patchSchema.parse(await req.clone().json())
        if (body.role && body.role !== 'OWNER') {
            const ownerCount = await prisma.user.count({
                where: { tenantId: ctx.tenantId, role: 'OWNER', isActive: true },
            })
            if (ownerCount <= 1) return err('Cannot demote the last OWNER', 400)
        }
    }

    try {
        const body = patchSchema.parse(await req.json())
        const updateData: any = {}
        if (body.role !== undefined) updateData.role = body.role
        if (body.isActive !== undefined) updateData.isActive = body.isActive
        if (body.name !== undefined) updateData.name = body.name
        if (body.password) updateData.passwordHash = await hashPassword(body.password)

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: { id: true, username: true, name: true, role: true, isActive: true },
        })
        return ok(user)
    } catch (e: any) {
        if (e?.name === 'ZodError') return err(e.errors[0]?.message ?? 'Invalid data', 422)
        return err('Error updating user')
    }
}, { permission: 'SETTINGS_MANAGE' })

// DELETE /api/settings/users/[id] — soft-delete (deactivate)
export const DELETE = withAuth(async (_req: NextRequest, ctx) => {
    const id = (await ctx.params)?.id
    if (!id) return err('Missing id', 400)

    const existing = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!existing) return err('User not found', 404)

    // Prevent deleting self
    if (id === ctx.user?.userId) return err('Cannot deactivate your own account', 400)

    // Prevent deleting last owner
    if (existing.role === 'OWNER') {
        const ownerCount = await prisma.user.count({
            where: { tenantId: ctx.tenantId, role: 'OWNER', isActive: true },
        })
        if (ownerCount <= 1) return err('Cannot deactivate the last OWNER', 400)
    }

    await prisma.user.update({
        where: { id },
        data: { isActive: false },
    })
    return ok({ deactivated: true })
}, { permission: 'SETTINGS_MANAGE' })
