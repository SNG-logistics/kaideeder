import { withAuth, ok } from '@/lib/api'

/** GET /api/auth/me — returns the current logged-in user from JWT cookie */
export const GET = withAuth(async (_req, ctx) => {
    return ok({
        userId: ctx.user!.userId,
        username: ctx.user!.username,
        role: ctx.user!.role,
        name: ctx.user!.name,
    })
})
