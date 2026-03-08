import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const recipeSchema = z.object({
    menuName: z.string().min(1),
    posMenuCode: z.string().optional(),
    note: z.string().optional(),
    bom: z.array(z.object({
        productId: z.string().min(1),
        locationId: z.string().min(1),
        quantity: z.number().positive(),
        unit: z.string().min(1),
    })).min(1),
})

// GET /api/recipes
export const GET = withAuth<any>(async (req: NextRequest, context: any) => {
    const { tenantId } = context
    const recipes = await prisma.recipe.findMany({
        where: { tenantId, isActive: true },
        orderBy: { menuName: 'asc' },
        include: { bom: { include: { product: true } } },
    })
    return ok(recipes)
})

// POST /api/recipes
export const POST = withAuth<any>(async (req: NextRequest, context: any) => {
    try {
        const { tenantId } = context
        const body = await req.json()
        const data = recipeSchema.parse(body)

        const existing = await prisma.recipe.findFirst({
            where: { tenantId, menuName: { equals: data.menuName }, isActive: true },
        })
        if (existing) {
            return err(`Recipe "${data.menuName}" มีอยู่แล้วในระบบ (ID: ${existing.id}) — กรุณาแก้ไข Recipe เดิม หรือใช้ชื่อใหม่`)
        }

        const recipe = await prisma.recipe.create({
            data: {
                tenantId,
                menuName: data.menuName,
                posMenuCode: data.posMenuCode,
                note: data.note,
                bom: {
                    create: data.bom.map(item => ({
                        tenantId,
                        productId: item.productId,
                        locationId: item.locationId,
                        quantity: item.quantity,
                        unit: item.unit,
                    })),
                },
            },
            include: { bom: { include: { product: true } } },
        })
        return ok(recipe)
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER'])
