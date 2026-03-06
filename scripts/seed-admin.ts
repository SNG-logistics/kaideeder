/**
 * scripts/seed-admin.ts
 * Creates the first SuperAdmin user for the admin portal (/admin/login).
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/seed-admin.ts
 *
 * Override defaults via env vars:
 *   ADMIN_EMAIL=admin@myshop.com ADMIN_PASSWORD=MySecret123 npx ts-node ...
 */
// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const EMAIL = process.env.ADMIN_EMAIL || 'superadmin@pos43.com'
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234'
const NAME = process.env.ADMIN_NAME || 'Super Admin'

async function main() {
    console.log('\n🔐  Seeding SuperAdmin...\n')

    const existing = await prisma.adminUser.findUnique({ where: { email: EMAIL } })
    if (existing) {
        console.log(`ℹ️  AdminUser already exists: ${EMAIL}`)
        console.log('    Use ADMIN_EMAIL / ADMIN_PASSWORD env vars to create a different one.')
        return
    }

    const passwordHash = await bcrypt.hash(PASSWORD, 12)

    const admin = await prisma.adminUser.create({
        data: {
            email: EMAIL,
            passwordHash,
            name: NAME,
            role: 'SUPERADMIN',
            isActive: true,
        },
    })

    console.log(`✅  SuperAdmin created!`)
    console.log(`    Email   : ${admin.email}`)
    console.log(`    Password: ${PASSWORD}`)
    console.log(`    Role    : ${admin.role}`)
    console.log(`    Login at: /admin/login\n`)
    console.log('⚠️  Change the password immediately after first login!\n')
}

main()
    .catch(e => { console.error('❌  Error:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
