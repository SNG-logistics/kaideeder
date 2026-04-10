const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
    console.log('เริ่มเคลียร์ข้อมูล prep_recipe_lines...')
    await prisma.$executeRaw`DELETE FROM prep_recipe_lines`
    console.log('เคลียร์ prep_recipe_lines สำเร็จ')

    console.log('เริ่มเคลียร์ข้อมูล prep_recipes...')
    await prisma.$executeRaw`DELETE FROM prep_recipes`
    console.log('เคลียร์ prep_recipes สำเร็จ')

    console.log('✅ ล้างข้อมูลขยะเสร็จเรียบร้อย! ตอนนี้สามารถรัน Deploy / Prisma db push ได้แล้วครับ')
}

main()
    .catch(e => {
        console.error('เกิดข้อผิดพลาด:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
