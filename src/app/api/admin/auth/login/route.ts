// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, signAdminToken } from '@/lib/admin-auth'
import { z } from 'zod'

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
})

export async function POST(req: NextRequest) {
    try {
        const { email, password } = schema.parse(await req.json())

        const admin = await prisma.adminUser.findUnique({ where: { email } })
        if (!admin || !admin.isActive) {
            return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
        }

        const valid = await verifyPassword(password, admin.passwordHash)
        if (!valid) {
            return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 })
        }

        const token = signAdminToken({ adminId: admin.id, role: admin.role, name: admin.name })

        const res = NextResponse.json({
            success: true,
            token, // ← ส่ง token กลับไปให้ client เก็บใน localStorage
            data: { name: admin.name, role: admin.role },
        })
        // Set cookie ด้วย (backup)
        res.cookies.set('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 12,
            path: '/',
            sameSite: 'lax',
        })
        console.log('[admin login] token issued for:', admin.email, 'cookie path: /')
        return res
    } catch (e) {
        console.log('[admin login] error:', e)
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }
}

export async function DELETE() {
    const res = NextResponse.json({ success: true })
    res.cookies.delete('admin_token')
    return res
}
