// scripts/fix-store-users.mjs
// Run: node scripts/fix-store-users.mjs
import { PrismaClient } from '@prisma/client'
import bcryptjs from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🔍 Connecting to database...')

    const tenants = await prisma.tenant.findMany({
        select: { id: true, code: true, name: true, status: true },
        orderBy: { createdAt: 'asc' }
    })

    console.log('\n📋 All tenants:')
    tenants.forEach(t => console.log(`  [${t.code}] ${t.name} — ${t.status}`))

    const ownerHash = await bcryptjs.hash('owner1234', 12)
    const staffHash = await bcryptjs.hash('staff1234', 12)
    const managerHash = await bcryptjs.hash('manager1234', 12)

    for (const tenant of tenants) {
        console.log(`\n🏪 Processing [${tenant.code}] ${tenant.name}...`)
        const users = await prisma.user.findMany({ where: { tenantId: tenant.id }, select: { username: true, role: true, isActive: true } })
        console.log('  Current users:', users.map(u => u.username).join(', ') || 'none')

        const defaults = [
            { username: 'owner', name: 'เจ้าของร้าน', passwordHash: ownerHash, role: 'OWNER' },
            { username: 'manager', name: 'ผู้จัดการ', passwordHash: managerHash, role: 'MANAGER' },
            { username: 'kitchen', name: 'ครัว', passwordHash: staffHash, role: 'KITCHEN' },
        ]

        for (const u of defaults) {
            const existing = await prisma.user.findFirst({ where: { tenantId: tenant.id, username: u.username } })
            if (existing) {
                await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: u.passwordHash, isActive: true } })
                console.log(`  ✅ reset: ${u.username}`)
            } else {
                await prisma.user.create({ data: { tenantId: tenant.id, ...u, isActive: true } })
                console.log(`  ➕ created: ${u.username}`)
            }
        }
    }

    console.log('\n✅ Done! Login with: owner / owner1234')
}

main()
    .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
    .finally(() => prisma.$disconnect())
