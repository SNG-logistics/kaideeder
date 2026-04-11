/**
 * GET  /api/tenant/payment/config  — ดึง payment config ของร้าน
 * PATCH /api/tenant/payment/config — อัปเดต payment config (OWNER/MANAGER เท่านั้น)
 *
 * paymentConfigJson structure:
 * {
 *   provider: "manual" | "promptpay" | "stripe" | "gbprimepay" | "omise"
 *   accountName: string       // ชื่อบัญชี / PromptPay alias
 *   accountNumber: string     // เลขบัญชี / PromptPay ID
 *   promptpayId: string       // เลขโทรศัพท์ / เลขประชาชน
 *   merchantId: string        // สำหรับ gateway เช่น Stripe / GBPrimePay
 *   secretKey: string         // API Secret (encrypted ในอนาคต)
 *   webhookSecret: string     // สำหรับ verify webhook
 *   isActive: boolean         // เปิด/ปิด payment ออนไลน์
 *   acceptedMethods: string[] // ["PROMPTPAY", "BANK_TRANSFER", "CARD", "QR"]
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const paymentConfigSchema = z.object({
    provider: z.enum(['manual', 'promptpay', 'stripe', 'gbprimepay', 'omise']).optional(),
    accountName: z.string().max(200).optional(),
    accountNumber: z.string().max(50).optional(),
    promptpayId: z.string().max(20).optional(),
    merchantId: z.string().max(200).optional(),
    secretKey: z.string().max(500).optional(),
    webhookSecret: z.string().max(200).optional(),
    isActive: z.boolean().optional(),
    acceptedMethods: z.array(z.enum(['PROMPTPAY', 'BANK_TRANSFER', 'CARD', 'QR'])).optional(),
})

// ── GET ─────────────────────────────────────────────────────────────
export const GET = withAuth<any>(async (_req: NextRequest, ctx: any) => {
    const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { paymentConfigJson: true, qrBankingBase64: true },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    let config: Record<string, unknown> = {
        provider: 'manual',
        accountName: '',
        accountNumber: '',
        promptpayId: '',
        isActive: false,
        acceptedMethods: ['BANK_TRANSFER', 'QR'],
    }
    if (tenant.paymentConfigJson) {
        try { config = JSON.parse(tenant.paymentConfigJson) } catch {}
    }

    // Strip secretKey from response — never expose to frontend via GET
    const { secretKey: _, ...safeConfig } = config as any
    return NextResponse.json({
        success: true,
        config: safeConfig,
        hasQrBanking: !!tenant.qrBankingBase64,
    })
})

// ── PATCH ────────────────────────────────────────────────────────────
export const PATCH = withAuth<any>(async (req: NextRequest, ctx: any) => {
    const role = (ctx.user?.role || '').toUpperCase()
    if (!['OWNER', 'MANAGER'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()

    // Parse existing config first to merge
    const existing = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { paymentConfigJson: true },
    })
    let oldConfig: Record<string, unknown> = {}
    if (existing?.paymentConfigJson) {
        try { oldConfig = JSON.parse(existing.paymentConfigJson) } catch {}
    }

    const parsed = paymentConfigSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid data' }, { status: 422 })
    }

    const merged = { ...oldConfig, ...parsed.data }
    await prisma.tenant.update({
        where: { id: ctx.tenantId },
        data: { paymentConfigJson: JSON.stringify(merged) },
    })

    // Strip secretKey from response
    const { secretKey: _, ...safeConfig } = merged as any
    return NextResponse.json({ success: true, config: safeConfig })
})
