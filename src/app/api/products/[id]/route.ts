import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/products/[id]
export const GET = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const raw = await prisma.product.findFirst({
        where: { id: params?.id, tenantId },
        include: {
            category: true,
            inventory: { include: { location: true } },
            bom: { include: { recipe: true } },
        },
    })
    if (!raw) return err('ไม่พบสินค้า', 404)
    const imageUrl = raw.imageBase64
        ? `data:image/webp;base64,${raw.imageBase64}`
        : raw.imageUrl || null
    const { imageBase64, ...rest } = raw
    return ok({ ...rest, imageUrl })
})

// PATCH /api/products/[id]
export const PATCH = withAuth(async (req: NextRequest, ctx) => {
    try {
        const { tenantId } = ctx as any
        const params = await ctx.params
        const body = await req.json()
        const existing = await prisma.product.findFirst({ where: { id: params?.id, tenantId } })
        if (!existing) return err('ไม่พบสินค้า', 404)
        const product = await prisma.product.update({
            where: { id: params?.id },
            data: body,
            include: { category: true },
        })
        return ok(product)
    } catch {
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])

// DELETE /api/products/[id] (soft delete)
export const DELETE = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const existing = await prisma.product.findFirst({ where: { id: params?.id, tenantId } })
    if (!existing) return err('ไม่พบสินค้า', 404)
    await prisma.product.update({
        where: { id: params?.id },
        data: { isActive: false },
    })
    return ok({ deleted: true })
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])
