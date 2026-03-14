import { createHandler } from '@premieroctet/next-admin/appHandler'
import { prisma } from '@/lib/prisma'
import { options } from '@/lib/next-admin-options'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const authGuard = async (req: Request) => {
    try {
        const authHeader = req.headers.get('authorization')
        if (!authHeader?.startsWith('Bearer ')) return false
        
        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as { role: string }
        
        return decoded.role === 'SUPER_ADMIN'
    } catch {
        return false
    }
}

const { run } = createHandler({
    apiBasePath: '/api/admin/database',
    prisma,
    options,
})

const withAuth = (handler: any) => async (req: Request, ...args: any[]) => {
    const isAuthorized = await authGuard(req)
    if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return handler(req, ...args)
}

export const GET = withAuth(run)
export const POST = withAuth(run)
export const DELETE = withAuth(run)
