// ============================================================
// middleware/rbac.ts — Role-Based Access Control Middleware
// ============================================================
// Works in two modes:
//   1. Next.js App Router  → withRole(handler, allowedRoles)
//   2. Express             → requireRole(allowedRoles)  (req, res, next)
// ============================================================

import type { Role } from '@/lib/policy'

// ── Shared user type ─────────────────────────────────────────
export interface AuthUser {
    id: string
    email: string
    role: Role
    tenantId: string   // mandatory — every query MUST filter by this
    name?: string
}

// ── 1. Next.js App Router helper ────────────────────────────
import { NextRequest, NextResponse } from 'next/server'

type NextHandler = (req: NextRequest, user: AuthUser) => Promise<NextResponse>

/**
 * Wrap a Next.js route handler with role check.
 *
 * Usage:
 *   export const DELETE = withRole(handler, CAN_MANAGE_ZONE_TABLE)
 */
export function withRole(handler: NextHandler, allowedRoles: Role[]) {
    return async (req: NextRequest): Promise<NextResponse> => {
        // Get user from session / JWT (adjust to your auth mechanism)
        const { getServerSession } = await import('next-auth')
        const session = await getServerSession()
        const user = (session as any)?.user as AuthUser | undefined

        if (!user?.id || !user?.tenantId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        if (!allowedRoles.includes(user.role)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
        }

        return handler(req, user)
    }
}

// ── 2. Express-compatible middleware ─────────────────────────
import type { Request, Response, NextFunction } from 'express'

export interface AuthRequest extends Request {
    user: AuthUser
}

/**
 * Express middleware: authenticate + extract user.
 * Apply before requireRole().
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    // Extract from session or JWT — adapt to your setup
    const user: AuthUser | undefined = (req.session as any)?.user

    if (!user?.id || !user?.tenantId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    req.user = user
    next()
}

/**
 * Express middleware factory: check user role.
 *
 * Usage:
 *   router.delete('/zones/:id', requireRole(CAN_MANAGE_ZONE_TABLE), handler)
 */
export function requireRole(allowedRoles: Role[]) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' })
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Forbidden' })
        }

        next()
    }
}

/**
 * Helper: apply tenant isolation to any Prisma where clause.
 *
 * Usage:
 *   const where = tenantScope(req.user, { isActive: true })
 *   await prisma.zone.findMany({ where })
 */
export function tenantScope(user: AuthUser, extra: Record<string, unknown> = {}) {
    return { tenantId: user.tenantId, ...extra }
}
