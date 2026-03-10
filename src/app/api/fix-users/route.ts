import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const tenantCode = searchParams.get('tenantCode')

        // If no tenantCode given → list all tenants so user can pick
        if (!tenantCode) {
            const tenants = await prisma.tenant.findMany({
                select: { id: true, code: true, name: true, status: true },
                orderBy: { createdAt: 'asc' }
            })
            return NextResponse.json({
                message: 'ใส่ ?tenantCode=XX เพื่อ reset password ร้านนั้น',
                tenants,
            })
        }

        const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode } })
        if (!tenant) {
            return NextResponse.json({ success: false, error: `ไม่พบ tenant รหัส "${tenantCode}"` }, { status: 404 })
        }
        const tenantId = tenant.id

        const ownerHash = bcrypt.hashSync('owner1234', 12)
        const staffHash = bcrypt.hashSync('staff1234', 12)
        const managerHash = bcrypt.hashSync('manager1234', 12)

        const defaultUsers = [
            { username: 'owner', name: 'เจ้าของร้าน', passwordHash: ownerHash, role: 'OWNER' as const },
            { username: 'kitchen', name: 'ครัว', passwordHash: staffHash, role: 'KITCHEN' as const },
            { username: 'manager', name: 'ผู้จัดการ', passwordHash: managerHash, role: 'MANAGER' as const },
        ]

        const results: string[] = []
        for (const u of defaultUsers) {
            const existing = await prisma.user.findFirst({ where: { tenantId, username: u.username } })
            if (existing) {
                await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: u.passwordHash, isActive: true } })
                results.push(`✅ reset: ${u.username}`)
            } else {
                await prisma.user.create({ data: { tenantId, username: u.username, name: u.name, passwordHash: u.passwordHash, role: u.role, isActive: true } })
                results.push(`✅ created: ${u.username}`)
            }
        }

        return NextResponse.json({
            success: true,
            tenant: tenant.name,
            results,
            message: `รีเซ็ตสำเร็จ! ล็อกอินด้วย owner / owner1234 ได้เลย`,
        })
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}

