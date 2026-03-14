import { createHandler } from '@premieroctet/next-admin/appHandler'
import { prisma } from '@/lib/prisma'
import { options } from '@/lib/next-admin-options'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

import { cookies } from 'next/headers'

const authGuard = async (req: Request) => {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('admin_token')?.value
        if (!token) return false
        
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as { role: string }
        
        return decoded.role === 'SUPERADMIN'
    } catch {
        return false
    }
}

const { run } = createHandler({
    apiBasePath: '/api/admin/database',
    prisma,
    options,
})

const withAuth = (handler: any) => async (req: Request, context: any) => {
    const isAuthorized = await authGuard(req)
    if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Pass context entirely unchanged so Next-Admin and next-connect can handle the Next.js 15 Promise naturally
    return handler(req, context)
}

export const GET = withAuth(run)
export const POST = withAuth(run)
export const DELETE = withAuth(run)
