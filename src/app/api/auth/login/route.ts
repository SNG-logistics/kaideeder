import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, verifyPassword } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    // Optional: client may send tenantCode to disambiguate cross-tenant usernames
    tenantCode: z.string().optional(),
})

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { username, password, tenantCode } = loginSchema.parse(body)

        // Must scope by tenantCode when provided; otherwise fall back to first match
        // (single-tenant mode). Once all shops are onboarded, tenantCode becomes mandatory.
        const where = tenantCode
            ? { username, tenant: { code: tenantCode } }
            : { username }

        const user = await prisma.user.findFirst({
            where,
            select: {
                id: true,
                tenantId: true,
                username: true,
                passwordHash: true,
                name: true,
                role: true,
                isActive: true,
            },
        })

        if (!user || !user.isActive) {
            return NextResponse.json({ success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
        }

        if (!user.tenantId) {
            // Should never happen after migration, but fail clearly
            return NextResponse.json({ success: false, error: 'บัญชีนี้ยังไม่ผูก tenant' }, { status: 403 })
        }

        const valid = await verifyPassword(password, user.passwordHash)
        if (!valid) {
            return NextResponse.json({ success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
        }

        const token = signToken({
            userId: user.id,
            tenantId: user.tenantId,   // ← tenant scope baked into JWT
            username: user.username,
            role: user.role,
            name: user.name,
        })

        const res = NextResponse.json({
            success: true,
            data: { name: user.name, role: user.role, username: user.username },
        })
        res.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 30,
            path: '/',
            sameSite: 'lax',
        })
        return res
    } catch (err) {
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }
}

export async function DELETE() {
    const res = NextResponse.json({ success: true })
    res.cookies.delete('token')
    return res
}
