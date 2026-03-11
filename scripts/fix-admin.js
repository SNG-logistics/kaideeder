/**
 * fix-admin.js
 * ตรวจสอบ AdminUser ใน DB ถ้าไม่มีหรือ ID ไม่ตรง ให้สร้างใหม่
 * รัน: node scripts/fix-admin.js
 */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
    console.log('=== AdminUser Checker ===\n')

    const admins = await prisma.adminUser.findMany({
        select: { id: true, email: true, name: true, role: true, isActive: true }
    })

    if (admins.length === 0) {
        console.log('⚠️  ไม่มี AdminUser ใน DB เลย — กำลังสร้างใหม่...')
        const hash = await bcrypt.hash('admin1234', 12)
        const admin = await prisma.adminUser.create({
            data: {
                email: 'admin@kaideeder.com',
                name: 'Super Admin',
                role: 'SUPERADMIN',
                passwordHash: hash,
                isActive: true,
            }
        })
        console.log('\n✅ สร้าง AdminUser สำเร็จ!')
        console.log('   Email   :', admin.email)
        console.log('   Password: admin1234')
        console.log('   ID      :', admin.id)
        console.log('   Role    :', admin.role)
    } else {
        console.log(`พบ ${admins.length} AdminUser ใน DB:`)
        admins.forEach(a => {
            console.log(`  [${a.id}]  ${a.email}  ${a.role}  active=${a.isActive}`)
        })
        console.log('\n✅ AdminUser มีอยู่แล้ว')
        console.log('   👉 กรุณา Logout แล้ว Login ใหม่ที่ /admin/login เพื่อ refresh JWT token ครับ')
    }
}

main()
    .catch(e => { console.error('❌ Error:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
