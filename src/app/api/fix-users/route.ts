import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
    try {
        // ต้องมี Tenant ก่อน — ใช้ tenant แรกในระบบ
        const tenant = await prisma.tenant.findFirst()
        if (!tenant) return NextResponse.json({ success: false, error: 'ไม่พบ Tenant ในระบบ กรุณาสร้าง Tenant ก่อน' }, { status: 404 })
        const tenantId = tenant.id

        const ownerHash = bcrypt.hashSync('owner1234', 12)
        const staffHash = bcrypt.hashSync('staff1234', 12)
        const managerHash = bcrypt.hashSync('manager1234', 12)

        const defaultUsers = [
            { username: 'owner', name: 'เจ้าของร้าน', passwordHash: ownerHash, role: 'OWNER' as const },
            { username: 'kitchen', name: 'ครัว', passwordHash: staffHash, role: 'KITCHEN' as const },
            { username: 'manager', name: 'ผู้จัดการ', passwordHash: managerHash, role: 'MANAGER' as const },
        ]

        for (const u of defaultUsers) {
            const existing = await prisma.user.findFirst({ where: { tenantId, username: u.username } })
            if (existing) {
                await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: u.passwordHash, isActive: true } })
            } else {
                await prisma.user.create({ data: { tenantId, username: u.username, name: u.name, passwordHash: u.passwordHash, role: u.role, isActive: true } })
            }
        }

        return NextResponse.json({ success: true, message: '🎉 รีเซ็ตรหัสผ่านผู้ใช้งานสำเร็จ! ปิดหน้านี้แล้วล็อกอินได้เลย' })
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
