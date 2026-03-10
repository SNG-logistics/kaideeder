/**
 * scripts/check-fix-users.ts
 *
 * ตรวจสอบ tenants + users ทั้งหมด และ reset password OWNER เป็น owner1234
 *
 * รัน local:
 *   npx tsx scripts/check-fix-users.ts
 *
 * รัน บน Plesk (SSH):
 *   cd /var/www/kaideeder && npx tsx scripts/check-fix-users.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🔍 Connecting to database...')

    // List all tenants
    const tenants = await prisma.tenant.findMany({
        select: { id: true, code: true, name: true, status: true },
        orderBy: { createdAt: 'asc' }
    })

    console.log('\n📋 All tenants:')
    tenants.forEach(t => console.log(`  [${t.code}] ${t.name} — ${t.status}`))

    // For each tenant, list users
    for (const tenant of tenants) {
        const users = await prisma.user.findMany({
            where: { tenantId: tenant.id },
            select: { username: true, name: true, role: true, isActive: true }
        })
        console.log(`\n👥 Users in [${tenant.code}] ${tenant.name}:`)
        users.forEach(u => console.log(`  ${u.isActive ? '✅' : '❌'} ${u.username} (${u.role}) — ${u.name}`))
    }

    // Reset owner password for ALL tenants to owner1234
    const ownerHash = await bcrypt.hash('owner1234', 12)
    for (const tenant of tenants) {
        const owner = await prisma.user.findFirst({
            where: { tenantId: tenant.id, role: 'OWNER' }
        })
        if (owner) {
            await prisma.user.update({
                where: { id: owner.id },
                data: { passwordHash: ownerHash, isActive: true }
            })
            console.log(`\n🔑 Reset [${tenant.code}] owner: ${owner.username} / owner1234`)
        } else {
            // Create owner if not exists
            await prisma.user.create({
                data: {
                    tenantId: tenant.id,
                    username: 'owner',
                    name: 'เจ้าของร้าน',
                    passwordHash: ownerHash,
                    role: 'OWNER',
                    isActive: true
                }
            })
            console.log(`\n➕ Created owner for [${tenant.code}]: owner / owner1234`)
        }
    }

    console.log('\n✅ Done! Login with: owner / owner1234')
}

main()
    .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
    .finally(() => prisma.$disconnect())
