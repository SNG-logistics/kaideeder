// Seed script: create Tenant for store 43 + admin user + default store users
// Run: node scripts/seed-local.mjs
import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding local database...')

    // ─── Create Tenant (Store 43) ──────────────────────────────
    let tenant = await prisma.tenant.findUnique({ where: { code: 'STORE43' } })
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                code: 'STORE43',
                name: '43 Garden Restaurant',
                displayName: 'ร้าน 43 Garden',
                status: 'ACTIVE',
            }
        })
        console.log('✅ Created tenant: STORE43')
    } else {
        console.log('ℹ️  Tenant STORE43 already exists')
    }

    // ─── Create Wallet for tenant ──────────────────────────────
    const walletExists = await prisma.wallet.findUnique({ where: { tenantId: tenant.id } })
    if (!walletExists) {
        await prisma.wallet.create({ data: { tenantId: tenant.id, balanceLAK: 0 } })
        console.log('✅ Created wallet for STORE43')
    }

    // ─── Create Store Users ────────────────────────────────────
    const storeUsers = [
        { username: 'owner', name: 'เจ้าของร้าน', password: 'owner1234', role: 'OWNER' },
        { username: 'manager', name: 'ผู้จัดการ', password: 'manager1234', role: 'MANAGER' },
        { username: 'kitchen', name: 'ครัว', password: 'staff1234', role: 'KITCHEN' },
        { username: 'cashier', name: 'แคชเชียร์', password: 'staff1234', role: 'CASHIER' },
    ]

    for (const u of storeUsers) {
        const hash = await bcryptjs.hash(u.password, 10)
        const existing = await prisma.user.findFirst({ where: { tenantId: tenant.id, username: u.username } })
        if (existing) {
            await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: hash, isActive: true } })
            console.log(`  ✅ reset: ${u.username} / ${u.password}`)
        } else {
            await prisma.user.create({
                data: { tenantId: tenant.id, username: u.username, name: u.name, passwordHash: hash, role: u.role, isActive: true }
            })
            console.log(`  ➕ created: ${u.username} / ${u.password}`)
        }
    }

    // ─── Create SuperAdmin for /admin portal ─────────────────
    const adminExists = await prisma.adminUser.findUnique({ where: { email: 'admin@kaideeder.com' } })
    if (!adminExists) {
        const adminHash = await bcryptjs.hash('admin1234', 10)
        await prisma.adminUser.create({
            data: {
                email: 'admin@kaideeder.com',
                passwordHash: adminHash,
                name: 'Super Admin',
                role: 'SUPERADMIN',
                isActive: true,
            }
        })
        console.log('\n✅ Admin Portal: admin@kaideeder.com / admin1234')
    } else {
        console.log('\nℹ️  Admin user already exists')
    }

    console.log('\n🎉 Done!')
    console.log('   POS Login : http://localhost:3000/login')
    console.log('   Username  : owner')
    console.log('   Password  : owner1234')
    console.log('   Admin     : http://localhost:3000/admin/login')
    console.log('   Email     : admin@kaideeder.com')
    console.log('   Password  : admin1234')
}

main()
    .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
    .finally(() => prisma.$disconnect())
