// Check DB state and fix admin user
// Run: node scripts/check-db.mjs
import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('\n📋 Tenants:')
    const tenants = await prisma.tenant.findMany({ select: { id: true, code: true, name: true, status: true } })
    console.table(tenants)

    console.log('\n👥 Store Users:')
    const users = await prisma.user.findMany({ select: { username: true, name: true, role: true, isActive: true } })
    console.table(users)

    console.log('\n🔑 Admin Users:')
    const admins = await prisma.adminUser.findMany({ select: { email: true, name: true, role: true, isActive: true } })
    console.table(admins)

    // Ensure admin exists with correct password
    const adminHash = await bcryptjs.hash('admin1234', 10)
    const existing = await prisma.adminUser.findUnique({ where: { email: 'admin@kaideeder.com' } })
    if (existing) {
        await prisma.adminUser.update({
            where: { email: 'admin@kaideeder.com' },
            data: { passwordHash: adminHash, isActive: true }
        })
        console.log('\n✅ Admin password reset: admin@kaideeder.com / admin1234')
    } else {
        await prisma.adminUser.create({
            data: { email: 'admin@kaideeder.com', passwordHash: adminHash, name: 'Super Admin', role: 'SUPERADMIN', isActive: true }
        })
        console.log('\n✅ Admin created: admin@kaideeder.com / admin1234')
    }
}

main()
    .catch(e => { console.error('❌', e.message); process.exit(1) })
    .finally(() => prisma.$disconnect())
