import { withAuth, ok } from '@/lib/api'
import { getPermissions } from '@/lib/permissions'

/** GET /api/auth/me — returns the current logged-in user from JWT cookie */
export const GET = withAuth(async (_req, ctx) => {
    const role = ctx.user!.role
    return ok({
        userId: ctx.user!.userId,
        username: ctx.user!.username,
        role,
        name: ctx.user!.name,
        tenantId: (ctx as any).tenantId,
        permissions: getPermissions(role),
    })
})
