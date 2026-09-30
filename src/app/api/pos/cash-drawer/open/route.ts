import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok } from '@/lib/api'

// POST /api/pos/cash-drawer/open — ขออนุญาตเปิดลิ้นชักเก็บเงินโดยไม่พิมพ์บิล
//
// ลิ้นชักเด้งจากแท็บเล็ตเอง (window.AndroidPOS.openCashDrawer) เซิร์ฟเวอร์สั่งเองไม่ได้
// route นี้จึงทำสองอย่างก่อนที่หน้าขายจะเรียก bridge:
//   1. บังคับสิทธิ์ฝั่งเซิร์ฟเวอร์ (CASH_DRAWER_OPEN — OWNER / MANAGER / CASHIER)
//   2. ลง AuditLog ว่าใครเปิดลิ้นชักโดยไม่มีการขาย เมื่อไหร่ ด้วยเหตุผลอะไร
// ถ้า route นี้ตอบไม่สำเร็จ หน้าขายจะไม่เรียก bridge
export const POST = withAuth(async (req: NextRequest, { user, tenantId }) => {
    let reason = ''
    try {
        const body = await req.json()
        if (typeof body?.reason === 'string') reason = body.reason.trim().slice(0, 120)
    } catch {
        // ไม่ส่ง body มาก็ได้
    }

    await prisma.auditLog.create({
        data: {
            actorType: 'TENANT_USER',
            userId: user?.userId,
            tenantId,
            action: 'CASH_DRAWER_OPEN',
            payload: { reason: reason || null, username: user?.username ?? null, role: user?.role ?? null },
            ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        },
    })

    return ok({ allowed: true })
}, { permission: 'CASH_DRAWER_OPEN' })
