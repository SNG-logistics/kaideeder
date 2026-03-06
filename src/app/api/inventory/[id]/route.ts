import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { MovementType } from '@prisma/client'

// PATCH /api/inventory/[id] — แก้ไข quantity และ/หรือ avgCost
export const PATCH = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await (ctx as any).params
    const { id } = params

    try {
        const body = await req.json()
        const { quantity, avgCost, note } = body

        if (quantity === undefined && avgCost === undefined) {
            return err('ต้องระบุจำนวนหรือต้นทุนอย่างน้อยหนึ่งค่า', 400)
        }

        // Fetch current record — ownership check via tenantId
        const current = await prisma.inventory.findFirst({
            where: { id, tenantId },
            include: { product: true, location: true },
        })
        if (!current) return err('ไม่พบ inventory record', 404)

        const newQty = quantity !== undefined ? parseFloat(quantity) : current.quantity
        const newCost = avgCost !== undefined ? parseFloat(avgCost) : current.avgCost

        const updated = await prisma.inventory.update({
            where: { id },
            data: { quantity: newQty, avgCost: newCost },
            include: {
                product: { include: { category: true } },
                location: true,
            }
        })

        // Log adjustment movement
        const diff = newQty - current.quantity
        if (diff !== 0) {
            await prisma.stockMovement.create({
                data: {
                    tenantId,
                    productId: current.productId,
                    fromLocationId: diff < 0 ? current.locationId : undefined,
                    toLocationId: diff > 0 ? current.locationId : undefined,
                    quantity: Math.abs(diff),
                    unitCost: newCost,
                    totalCost: Math.abs(diff) * newCost,
                    type: MovementType.ADJUSTMENT,
                    referenceType: 'MANUAL_EDIT',
                    note: note || `แก้ไขสต็อค: ${current.quantity} → ${newQty} ${current.product.unit}`,
                    createdById: ctx.user?.userId,
                }
            })
        }

        return ok(updated)
    } catch (error) {
        console.error('Inventory patch error:', error)
        return err('เกิดข้อผิดพลาด', 500)
    }
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])
