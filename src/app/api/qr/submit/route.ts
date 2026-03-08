// @ts-nocheck  — legacy file (pre-multi-tenant); full refactor deferred
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MovementType } from '@prisma/client'
import jwt from 'jsonwebtoken'

const QR_SECRET = process.env.JWT_SECRET + '_qr'

interface QRPayload {
    productId: string
    locationId: string
    sku: string
    productName: string
    unit: string
    locationCode: string
    locationName: string
    currentQty: number
}

function ok<T>(data: T) {
    return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
    return NextResponse.json({ success: false, error: message }, { status })
}

/**
 * POST /api/qr/submit  (ไม่ต้อง login — ใช้ QR token แทน)
 * Body: { token, actualQty }
 */
export async function POST(req: NextRequest) {
    try {
        const { token, actualQty } = await req.json()
        if (!token) return err('ไม่พบ token')
        if (actualQty === undefined || actualQty === null) return err('กรุณาระบุจำนวน')
        if (typeof actualQty !== 'number' || actualQty < 0) return err('จำนวนไม่ถูกต้อง')

        // Verify QR token
        let payload: QRPayload
        try {
            payload = jwt.verify(token, QR_SECRET) as QRPayload
        } catch {
            return err('QR code หมดอายุหรือไม่ถูกต้อง กรุณาขอ Sheet ใหม่จาก Manager', 401)
        }

        const { productId, locationId, productName, locationCode } = payload

        // อ่านสต็อคปัจจุบัน
        const inv = await prisma.inventory.findFirst({
            where: { productId, locationId }
        })
        const systemQty = inv?.quantity || 0
        const diffQty = actualQty - systemQty

        // สร้าง adjustment
        const adjustment = await prisma.$transaction(async (tx) => {
            const adj = await tx.stockAdjustment.create({
                data: {
                    locationId,
                    status: 'APPROVED',
                    reason: 'QR Scan',
                    note: `[QR] ${productName} @ ${locationCode}: ${systemQty} → ${actualQty}`,
                }
            })

            await tx.adjustmentItem.create({
                data: {
                    adjustmentId: adj.id,
                    productId,
                    locationId,
                    systemQty,
                    actualQty,
                    diffQty,
                    unitCost: inv?.avgCost || 0,
                }
            })

            // อัปเดตสต็อค
            await tx.inventory.upsert({
                where: { tenantId_productId_locationId: { tenantId: inv?.tenantId || '', productId, locationId } },
                update: { quantity: actualQty },
                create: { productId, locationId, quantity: actualQty, avgCost: 0 }
            })

            // Movement ถ้ามีส่วนต่าง
            if (diffQty !== 0) {
                await tx.stockMovement.create({
                    data: {
                        productId,
                        ...(diffQty > 0
                            ? { toLocationId: locationId }
                            : { fromLocationId: locationId }),
                        quantity: Math.abs(diffQty),
                        unitCost: inv?.avgCost || 0,
                        totalCost: Math.abs(diffQty) * (inv?.avgCost || 0),
                        type: MovementType.ADJUSTMENT,
                        referenceId: adj.id,
                        referenceType: 'ADJUSTMENT',
                        note: `[QR Scan] ${systemQty} → ${actualQty}`,
                    }
                })
            }

            return adj
        })

        return ok({
            adjustmentId: adjustment.id,
            productName,
            systemQty,
            actualQty,
            diffQty,
        })
    } catch (e) {
        console.error('QR submit error:', e)
        return err('เกิดข้อผิดพลาด')
    }
}
