/**
 * POST /api/public/payment/notify
 * Webhook endpoint สำหรับรับการแจ้งเตือนจาก Payment Gateway
 *
 * รองรับ:
 * - PromptPay callback (via KBank, SCB, BBL)
 * - GBPrimePay webhook
 * - Stripe webhook (future)
 * - Manual confirmation (สำหรับแอดมินยืนยันเอง)
 *
 * Body:
 * {
 *   provider: "promptpay" | "gbprimepay" | "stripe" | "manual"
 *   orderId: string
 *   amount: number
 *   ref: string         // reference number จาก bank
 *   signature?: string  // HMAC เพื่อ verify ว่าของจริง
 *   tenantCode: string  // ระบุร้านเพื่อ multi-tenant
 * }
 */
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { provider, orderId, amount, ref, tenantCode, signature } = body

        // ── Validate required fields ─────────────────────────────
        if (!orderId || !tenantCode) {
            return NextResponse.json({ error: 'Missing orderId or tenantCode' }, { status: 400 })
        }

        // ── Find tenant ──────────────────────────────────────────
        const tenant = await prisma.tenant.findUnique({
            where: { code: tenantCode },
            select: { id: true, paymentConfigJson: true },
        })
        if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

        // ── Parse payment config ─────────────────────────────────
        let config: Record<string, unknown> = {}
        if (tenant.paymentConfigJson) {
            try { config = JSON.parse(tenant.paymentConfigJson) } catch {}
        }

        // ── Signature verification (placeholder) ─────────────────
        // TODO: implement HMAC verification per provider
        // const webhookSecret = config.webhookSecret as string
        // if (webhookSecret && provider !== 'manual') {
        //     const isValid = verifySignature(signature, body, webhookSecret)
        //     if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        // }

        // ── Find order ───────────────────────────────────────────
        const order = await prisma.order.findFirst({
            where: { id: orderId, tenantId: tenant.id },
            include: { deliveryInfo: { select: { id: true, isPrepaid: true } } }
        })
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

        // ── Mark as paid ─────────────────────────────────────────
        if (order.deliveryInfo?.id) {
            await prisma.deliveryInfo.update({
                where: { id: order.deliveryInfo.id },
                data: {
                    isPrepaid: true,
                    paymentRef: ref ?? `${provider}-${Date.now()}`,
                },
            })

            // Log event for audit trail
            console.log(`[Payment Notify] Order ${orderId} marked PAID via ${provider} — ref: ${ref}, amount: ${amount}`)
        }

        return NextResponse.json({
            success: true,
            message: 'Payment confirmed',
            orderId,
            provider,
            ref,
        })
    } catch (e: any) {
        console.error('[Payment Notify Error]', e)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
