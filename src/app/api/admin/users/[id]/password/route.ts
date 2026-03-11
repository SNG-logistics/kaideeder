import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth, ok, err } from '@/lib/admin-auth'
import { z } from 'zod'
import bcryptjs from 'bcryptjs'

const resetSchema = z.object({
    newPassword: z.string().min(4, 'Password must be at least 4 characters')
})

// PATCH /api/admin/users/[id]/password 
// Allows a SuperAdmin (or Admin1) to force-reset a tenant user's password.
export const PATCH = withAdminAuth(async (req: NextRequest, context): Promise<NextResponse<any>> => {
    // Note: the Next constraint requires awaiting params
    const id = (await context.params)?.id
    if (!id) return err('Missing id', 400)

    try {
        const body = resetSchema.parse(await req.json())

        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) return err('User not found', 404)

        const passwordHash = await bcryptjs.hash(body.newPassword, 10)

        // Run in transaction to update password
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id },
                data: { passwordHash }
            })
        })

        // AuditLog — wrapped separately to avoid FK mismatch breaking the reset
        try {
            await prisma.auditLog.create({
                data: {
                    actorType: 'ADMIN',
                    adminId: context.admin.adminId,
                    tenantId: user.tenantId,
                    userId: user.id,
                    action: 'RESET_USER_PASSWORD',
                    payload: { note: 'Admin initiated password reset' }
                }
            })
        } catch (auditErr) {
            console.warn('[admin/users/password] auditLog skipped (adminId FK mismatch):', auditErr)
        }

        return ok({ message: 'Password reset successful' })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return err(error.errors[0].message, 400)
        }
        return err('Internal server error', 500)
    }
}, 'SUPERADMIN') // Enforce SuperAdmin only to prevent lower admins from resetting passwords.
