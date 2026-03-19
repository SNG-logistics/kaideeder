import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const uomSchema = z.object({
    productId: z.string().min(1),
    fromUnit: z.string().min(1),
    toUnit: z.string().min(1),
    factor: z.number().positive('factor ต้องมากกว่า 0'),
    isDefault: z.boolean().optional(),
    note: z.string().optional(),
})

// GET /api/uom-conversion?productId=xxx
// ดึง conversion rules ของ product (ถ้าไม่ระบุ productId → ดึงทั้งหมด)
export const GET = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId')

    const where: any = { tenantId }
    if (productId) where.productId = productId

    const conversions = await prisma.uomConversion.findMany({
        where,
        include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
        },
        orderBy: [{ productId: 'asc' }, { fromUnit: 'asc' }],
    })
    return ok(conversions)
})

// POST /api/uom-conversion — สร้าง conversion ใหม่
export const POST = withAuth(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId } = ctx
        const body = await req.json()
        const data = uomSchema.parse(body)

        // ตรวจสอบว่า product เป็นของ tenant นี้จริง
        const product = await prisma.product.findFirst({
            where: { id: data.productId, tenantId },
            select: { id: true, name: true, unit: true },
        })
        if (!product) return err('ไม่พบวัตถุดิบ')

        // ถ้าตั้ง isDefault = true → ยกเลิก default เดิมก่อน
        if (data.isDefault) {
            await prisma.uomConversion.updateMany({
                where: { tenantId, productId: data.productId, isDefault: true },
                data: { isDefault: false },
            })
        }

        const conversion = await prisma.uomConversion.upsert({
            where: {
                tenantId_productId_fromUnit_toUnit: {
                    tenantId,
                    productId: data.productId,
                    fromUnit: data.fromUnit,
                    toUnit: data.toUnit,
                },
            },
            update: {
                factor: data.factor,
                isDefault: data.isDefault ?? false,
                note: data.note,
            },
            create: {
                tenantId,
                productId: data.productId,
                fromUnit: data.fromUnit,
                toUnit: data.toUnit,
                factor: data.factor,
                isDefault: data.isDefault ?? false,
                note: data.note,
            },
            include: {
                product: { select: { id: true, name: true, sku: true, unit: true } },
            },
        })
        return ok(conversion)
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('UomConversion create error:', error)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER'])
