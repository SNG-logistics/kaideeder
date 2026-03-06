import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, JWTPayload } from './auth'
import { can, Permission } from './permissions'

// ─── Context ──────────────────────────────────────────────────────────────────
export interface AuthContext {
  params?: Promise<Record<string, string>>
  user?: JWTPayload | null
  /** Shorthand — always set when using withAuth/withTenant; throws if missing */
  tenantId: string
}

export type ApiHandler<T = any> = (
  req: NextRequest,
  context: AuthContext
) => Promise<NextResponse<T>>

// ─── Core middleware ───────────────────────────────────────────────────────────

export interface WithAuthOptions {
  /** Allowed roles (ANY match passes). Case-insensitive. */
  roles?: string[]
  /** Required permission (role must have this permission). */
  permission?: Permission
}

/**
 * withAuth — verifies JWT, optionally gates by role OR permission.
 * Supports two call styles (backward-compatible):
 *   withAuth(handler)                              — auth only
 *   withAuth(handler, ['owner', 'manager'])        — role list (legacy)
 *   withAuth(handler, { roles: [...] })            — role list (new)
 *   withAuth(handler, { permission: 'PRODUCT_EDIT' }) — permission check
 */
export function withAuth<T>(
  handler: ApiHandler<T>,
  guard?: string[] | WithAuthOptions
) {
  return async (req: NextRequest, context: any) => {
    const token =
      req.cookies.get('token')?.value ||
      req.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    }

    try {
      const user = verifyToken(token)
      if (!user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) as any
      }

      if (!user.tenantId) {
        return NextResponse.json({ error: 'Token missing tenantId' }, { status: 401 }) as any
      }

      // Normalise guard options
      const opts: WithAuthOptions = Array.isArray(guard)
        ? { roles: guard }
        : (guard ?? {})

      // Role check
      if (opts.roles && opts.roles.length > 0) {
        const userRoleUpper = user.role?.toUpperCase()
        const allowed = opts.roles.some(r => r.toUpperCase() === userRoleUpper)
        if (!allowed) {
          return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 }) as any
        }
      }

      // Permission check
      if (opts.permission) {
        if (!can(user.role, opts.permission)) {
          return NextResponse.json(
            { error: `Forbidden: requires permission ${opts.permission}` },
            { status: 403 }
          ) as any
        }
      }

      const authContext: AuthContext = { ...context, user, tenantId: user.tenantId }
      return handler(req, authContext)
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) as any
    }
  }
}

/**
 * getTenantId — extract tenantId from context, throw if absent.
 * Use this inside handlers to be explicit and get a clear stack trace.
 */
export function getTenantId(context: AuthContext): string {
  if (!context.tenantId) throw new Error('BUG: tenantId missing from AuthContext')
  return context.tenantId
}

// ─── Response helpers ──────────────────────────────────────────────────────────

/** Standard success response */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status }) as any
}

/** Standard error response */
export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status }) as any
}
