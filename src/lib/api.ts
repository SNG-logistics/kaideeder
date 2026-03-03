import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, JWTPayload } from './auth'

// Fix the root of the problem: define a clear, extensible interface
export interface AuthContext {
  params?: Promise<Record<string, string>>;
  user?: JWTPayload | null;
}

export type ApiHandler<T = any> = (
  req: NextRequest,
  context: AuthContext
) => Promise<NextResponse<T>>

/** Middleware: ตรวจ JWT token */
export function withAuth<T>(handler: ApiHandler<T>, allowedRoles?: string[]) {
  return async (req: NextRequest, context: any) => {
    const token = req.cookies.get('token')?.value ||
      req.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
    }

    try {
      const user = verifyToken(token)
      if (!user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) as any
      }

      if (allowedRoles && !allowedRoles.some(r => r.toLowerCase() === user.role.toLowerCase())) {
        return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 }) as any
      }

      // Pass user into context safely
      const authContext: AuthContext = { ...context, user };
      return handler(req, authContext);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) as any
    }
  }
}

/** Standard success response */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status }) as any
}

/** Standard error response */
export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status }) as any
}
