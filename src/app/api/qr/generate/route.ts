import { NextRequest } from 'next/server'
import { withAuth, ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

const QR_SECRET = process.env.JWT_SECRET + '_qr'
const QR_EXPIRES = '8h'

/**
 * POST /api/qr/generate
 * Body: { locationId }
 * Returns: array of { sku, productName, token, qrUrl }
 */
export const POST = withAuth(async (req: NextRequest, context) => {
    try {
        const { tenantId } = context
        const { locationId } = await req.json()
        if (!locationId) return err('กรุณาระบุ locationId')

        const location = await prisma.location.findFirst({
            where: { id: locationId, tenantId },
            select: { id: true, code: true, name: true }
        })
        if (!location) return err('ไม่พบ location')

        // หาสินค้าทั้งหมดใน location นี้
        const inventories = await prisma.inventory.findMany({
            where: { tenantId, locationId },
            include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
            orderBy: { product: { name: 'asc' } }
        })

        if (inventories.length === 0) return err('ไม่มีสินค้าใน location นี้')

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

        const tokens = inventories.map(inv => {
            const payload = {
                tenantId,
                productId: inv.productId,
                locationId: inv.locationId,
                sku: inv.product.sku,
                productName: inv.product.name,
                unit: inv.product.unit,
                locationCode: location.code,
                locationName: location.name,
                currentQty: inv.quantity,
            }
            const token = jwt.sign(payload, QR_SECRET, { expiresIn: QR_EXPIRES })
            const qrUrl = `${baseUrl}/q/${token}`
            return {
                sku: inv.product.sku,
                productName: inv.product.name,
                unit: inv.product.unit,
                currentQty: inv.quantity,
                token,
                qrUrl,
            }
        })

        return ok({ location, tokens, expiresIn: QR_EXPIRES })
    } catch (e) {
        console.error('QR generate error:', e)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])
