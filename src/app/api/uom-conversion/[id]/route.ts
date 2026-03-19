import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const updateSchema = z.object({
    factor: z.number().positive().optional(),
    isDefault: z.boolean().optional(),
    note: z.string().optional(),
    fromUnit: z.string().min(1).optional(),
    toUnit: z.string().min(1).optional(),
})

// PATCH /api/uom-conversion/[id]
export const PATCH = withAuth(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId } = ctx
        const id = ctx.params?.id as string

        const existing = await prisma.uomConversion.findFirst({ where: { id, tenantId } })
        if (!existing) return err('ไม่พบรายการ', 404)

        const body = await req.json()
        const data = updateSchema.parse(body)

        // ถ้าตั้ง isDefault = true → ยกเลิก default เดิมก่อน
        if (data.isDefault) {
            await prisma.uomConversion.updateMany({
                where: { tenantId, productId: existing.productId, isDefault: true, NOT: { id } },
                data: { isDefault: false },
            })
        }

        const updated = await prisma.uomConversion.update({
            where: { id },
            data: {
                ...(data.factor !== undefined && { factor: data.factor }),
                ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
                ...(data.note !== undefined && { note: data.note }),
                ...(data.fromUnit !== undefined && { fromUnit: data.fromUnit }),
                ...(data.toUnit !== undefined && { toUnit: data.toUnit }),
            },
            include: {
                product: { select: { id: true, name: true, sku: true, unit: true } },
            },
        })
        return ok(updated)
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER'])

// DELETE /api/uom-conversion/[id]
export const DELETE = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const id = ctx.params?.id as string

    const existing = await prisma.uomConversion.findFirst({ where: { id, tenantId } })
    if (!existing) return err('ไม่พบรายการ', 404)

    await prisma.uomConversion.delete({ where: { id } })
    return ok({ deleted: true })
}, ['OWNER', 'MANAGER'])
