import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

const lineSchema = z.object({
    productId: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().min(1),
})

const createSchema = z.object({
    name: z.string().min(1, 'ต้องระบุชื่อสูตร'),
    outputProductId: z.string().min(1, 'ต้องเลือกสินค้าผลผลิต'),
    yieldQty: z.number().positive('yieldQty ต้องมากกว่า 0'),
    yieldUnit: z.string().min(1, 'ต้องระบุหน่วย'),
    note: z.string().optional(),
    lines: z.array(lineSchema).min(1, 'ต้องมีวัตถุดิบอย่างน้อย 1 รายการ'),
})

const include = {
    outputProduct: { select: { id: true, name: true, sku: true, unit: true } },
    lines: {
        include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
        },
    },
    productions: {
        orderBy: { producedAt: 'desc' as const },
        take: 5,
        include: {
            location: { select: { id: true, code: true, name: true } },
        },
    },
}

// GET /api/prep-recipes
export const GET = withAuth(async (_req: NextRequest, ctx: any) => {
    const { tenantId } = ctx
    const recipes = await prisma.prepRecipe.findMany({
        where: { tenantId, isActive: true },
        include,
        orderBy: { createdAt: 'desc' },
    })

    // Attach current stock for output product
    const productIds = recipes.map(r => r.outputProductId)
    const inventories = await prisma.inventory.findMany({
        where: { tenantId, productId: { in: productIds } },
        include: { location: { select: { code: true, name: true } } },
    })
    const stockMap: Record<string, { qty: number; location: string }[]> = {}
    for (const inv of inventories) {
        if (!stockMap[inv.productId]) stockMap[inv.productId] = []
        if (inv.quantity !== 0) stockMap[inv.productId].push({ qty: inv.quantity, location: inv.location.code })
    }

    const result = recipes.map(r => ({
        ...r,
        currentStock: stockMap[r.outputProductId] || [],
    }))

    return ok(result)
}, ['OWNER', 'MANAGER'])

// POST /api/prep-recipes
export const POST = withAuth(async (req: NextRequest, ctx: any) => {
    try {
        const { tenantId } = ctx
        const body = await req.json()
        const data = createSchema.parse(body)

        const outProduct = await prisma.product.findFirst({ where: { id: data.outputProductId, tenantId } })
        if (!outProduct) return err('ไม่พบสินค้าผลผลิต')

        const recipe = await prisma.prepRecipe.create({
            data: {
                tenantId,
                name: data.name,
                outputProductId: data.outputProductId,
                yieldQty: data.yieldQty,
                yieldUnit: data.yieldUnit,
                note: data.note,
                lines: {
                    create: data.lines.map(l => ({
                        tenantId,
                        productId: l.productId,
                        quantity: l.quantity,
                        unit: l.unit,
                    })),
                },
            },
            include,
        })
        return ok(recipe)
    } catch (e: any) {
        if (e?.name === 'ZodError') return err(e.errors.map((x: any) => x.message).join(', '))
        console.error('PrepRecipe create error:', e)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER'])
