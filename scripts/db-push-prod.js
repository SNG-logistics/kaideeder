// Helper: prisma db push using .env.production (bypasses .env which may point to dev DB)
const { execSync } = require('child_process')
const fs = require('fs')

// Read DATABASE_URL from .env.production
let dbUrl = ''
try {
    const content = fs.readFileSync('.env.production', 'utf8')
    const match = content.match(/^DATABASE_URL=["']?([^"'\n\r]+)["']?/m)
    if (match) dbUrl = match[1].trim()
} catch {
    console.error('❌ ไม่พบไฟล์ .env.production')
    process.exit(1)
}

if (!dbUrl || dbUrl.includes('YOUR_PASSWORD')) {
    console.error('❌ กรุณาแก้ .env.production ให้ใส่ DATABASE_URL จริง (ไม่ใช่ YOUR_PASSWORD)')
    process.exit(1)
}

console.log('📦 DATABASE_URL:', dbUrl.replace(/:([^:@]+)@/, ':****@'))
console.log('🔄 Running: prisma db push...\n')

execSync('prisma db push', {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit'
})
