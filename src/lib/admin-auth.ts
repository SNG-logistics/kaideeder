/**
 * src/lib/admin-auth.ts
 * Completely separate auth layer for AdminUser.
 * Uses cookie "admin_token" — never mixed with the store "token" cookie.
 */
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'admin-dev-secret'

export interface JWTAdminPayload {
    adminId: string
    role: string   // AdminRole enum value
    name: string
}

export function signAdminToken(payload: JWTAdminPayload): string {
    return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '12h' })
}

export function verifyAdminToken(token: string): JWTAdminPayload | null {
    try {
        return jwt.verify(token, ADMIN_JWT_SECRET) as JWTAdminPayload
    } catch {
        return null
    }
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
}

// ── Admin role hierarchy ───────────────────────────────────────────────────
const ROLE_WEIGHT: Record<string, number> = {
    SUPERADMIN: 4,
    ADMIN1: 3,
    ADMIN2: 2,
    ADMIN3: 1,
}

export interface AdminAuthContext {
    params?: Promise<Record<string, string>>
    admin: JWTAdminPayload
}

export type AdminApiHandler<T = any> = (
    req: NextRequest,
    context: AdminAuthContext
) => Promise<NextResponse<T>>

/**
 * withAdminAuth — verify admin_token and optionally require minimum role.
 * minRole: SUPERADMIN > ADMIN1 > ADMIN2 > ADMIN3
 */
export function withAdminAuth<T>(handler: AdminApiHandler<T>, minRole: string = 'ADMIN3') {
    return async (req: NextRequest, context: any) => {
        const cookieVal = req.cookies.get('admin_token')?.value
        const headerVal = req.headers.get('authorization')?.replace('Bearer ', '')
        const token = cookieVal || headerVal

        // DEBUG — remove after fix
        console.log('[withAdminAuth] path:', req.nextUrl.pathname)
        console.log('[withAdminAuth] cookie admin_token:', cookieVal ? `${cookieVal.slice(0, 20)}...` : 'MISSING')
        console.log('[withAdminAuth] all cookies:', [...req.cookies.getAll()].map(c => c.name).join(', '))

        if (!token) {
            return NextResponse.json({ error: 'Admin unauthorised — no token' }, { status: 401 })
        }

        const admin = verifyAdminToken(token)
        if (!admin) {
            console.log('[withAdminAuth] token verify FAILED, secret prefix:', ADMIN_JWT_SECRET.slice(0, 8))
            return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 })
        }

        if ((ROLE_WEIGHT[admin.role] ?? 0) < (ROLE_WEIGHT[minRole] ?? 0)) {
            return NextResponse.json({ error: 'Forbidden: insufficient admin role' }, { status: 403 })
        }

        return handler(req, { ...context, admin })
    }
}

/** Admin standard responses */
export function ok<T>(data: T, status = 200) {
    return NextResponse.json({ success: true, data }, { status })
}

export function err(message: string, status = 400) {
    return NextResponse.json({ success: false, error: message }, { status })
}
