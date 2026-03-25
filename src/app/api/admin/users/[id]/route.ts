import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth, ok, err } from '@/lib/admin-auth'
import { z } from 'zod'

const patchSchema = z.object({
    role: z.enum(['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'KITCHEN', 'BAR', 'CASHIER', 'VIEWER']).optional(),
    isActive: z.boolean().optional(),
}).refine(d => d.role !== undefined || d.isActive !== undefined, { message: 'Must provide role or isActive' })

// PATCH /api/admin/users/[id] — change role or toggle active
export const PATCH = withAdminAuth(async (req: NextRequest, context): Promise<NextResponse<any>> => {
    const id = (await context.params)?.id
    if (!id) return err('Missing id', 400)

    try {
        const body = patchSchema.parse(await req.json())

        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) return err('User not found', 404)

        const updated = await prisma.user.update({
            where: { id },
            data: {
                ...(body.role !== undefined && { role: body.role }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
            },
            select: { id: true, username: true, name: true, role: true, isActive: true }
        })

        // Audit log
        try {
            await prisma.auditLog.create({
                data: {
                    actorType: 'ADMIN',
                    adminId: context.admin.adminId,
                    tenantId: user.tenantId,
                    userId: user.id,
                    action: body.role ? 'CHANGE_USER_ROLE' : 'TOGGLE_USER_ACTIVE',
                    payload: {
                        ...(body.role && { role: body.role }),
                        ...(body.isActive !== undefined && { isActive: body.isActive }),
                    }
                }
            })
        } catch (auditErr) {
            console.warn('[admin/users] auditLog skipped:', auditErr)
        }

        return ok(updated)
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors[0].message, 400)
        return err('Internal server error', 500)
    }
}, 'SUPERADMIN')
