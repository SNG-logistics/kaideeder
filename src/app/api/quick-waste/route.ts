import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { MovementType } from '@prisma/client'

// POST /api/quick-waste
export const POST = withAuth<any>(async (req: NextRequest, context) => {
    try {
        const { tenantId } = context
        const body = await req.json()
        const { locationCode, productName, quantity, unit, reason } = body

        if (!locationCode || !productName || !quantity || quantity <= 0) {
            return err('ข้อมูลไม่ครบถ้วน', 400)
        }

        const location = await prisma.location.findFirst({ where: { tenantId, code: locationCode } })
        if (!location) return err(`ไม่พบคลัง: ${locationCode}`, 404)

        // Find product by name/sku
        const product = await prisma.product.findFirst({
            where: { tenantId, isActive: true, OR: [{ name: { contains: productName } }, { sku: { contains: productName } }] }
        })

        if (!product) return err(`ไม่พบสินค้า: ${productName}`, 404)

        // Decrement inventory
        await prisma.inventory.upsert({
            where: { productId_locationId: { productId: product.id, locationId: location.id } },
            update: { quantity: { decrement: quantity } },
            create: { tenantId, productId: product.id, locationId: location.id, quantity: -quantity, avgCost: 0 }
        })

        // Log movement
        await prisma.stockMovement.create({
            data: {
                tenantId,
                productId: product.id,
                fromLocationId: location.id,
                quantity,
                unitCost: product.costPrice,
                totalCost: quantity * product.costPrice,
                type: MovementType.WASTE,
                referenceType: 'QUICK_WASTE',
                note: reason ? `Waste: ${reason}` : `Quick Waste: ${product.name}`,
                createdById: context.user?.userId,
            }
        })

        return ok({ productName: product.name, quantity, unit: product.unit, locationCode })

    } catch (error) {
        console.error('Quick waste error:', error)
        return err('เกิดข้อผิดพลาดภายในระบบ', 500)
    }
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])
