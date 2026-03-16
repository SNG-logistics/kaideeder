import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const bulkMoveSchema = z.object({
    productIds: z.array(z.string()).min(1, 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'),
    targetCategoryId: z.string().min(1, 'กรุณาเลือกหมวดหมู่ปลายทาง'),
})

// PUT /api/products/bulk-move — ย้ายหมวดหมู่สินค้าทีละหลายรายการ
export const PUT = withAuth<any>(async (req: NextRequest, context: any) => {
    try {
        const { tenantId } = context
        const body = await req.json()
        const { productIds, targetCategoryId } = bulkMoveSchema.parse(body)

        // ตรวจสอบว่า targetCategoryId มีอยู่จริงของ tenant นี้
        const category = await prisma.category.findUnique({
            where: { id: targetCategoryId, tenantId }
        })
        
        if (!category) {
            return err('ไม่พบหมวดหมู่ปลายทางที่เลือก')
        }

        // อัพเดต categoryId ให้กับ productIds ที่ส่งมา (เฉพาะของ tenant นี้เท่านั้น)
        const updateResult = await prisma.product.updateMany({
            where: {
                tenantId,
                id: { in: productIds }
            },
            data: {
                categoryId: targetCategoryId
            }
        })

        return ok({
            movedCount: updateResult.count,
            message: `ย้ายสินค้าสำเร็จ ${updateResult.count} รายการ`
        })

    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('Bulk move products error:', error)
        return err('เกิดข้อผิดพลาดในการย้ายหมวดหมู่สินค้า')
    }
}, ['OWNER', 'MANAGER'])
