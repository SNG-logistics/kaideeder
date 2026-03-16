import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { z } from 'zod'

async function checkAuth() {
    const cookieStore = await cookies()
    const token = cookieStore.get('admin_token')?.value
    if (!token) return false
    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as { role: string }
        return decoded.role === 'SUPERADMIN'
    } catch {
        return false
    }
}

const schema = z.object({
    productIds: z.array(z.string()).min(1),
    targetCategoryId: z.string().min(1),
})

// GET /api/admin/move-products?categoryId=xxx — list products for a category
export async function GET(req: NextRequest) {
    if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const categoryId = new URL(req.url).searchParams.get('categoryId')
    if (!categoryId) return NextResponse.json({ error: 'categoryId required' }, { status: 400 })
    const products = await prisma.product.findMany({
        where: { categoryId, isActive: true },
        select: { id: true, name: true, nameTh: true, sku: true, unit: true, categoryId: true, tenantId: true },
        orderBy: { name: 'asc' },
    })
    return NextResponse.json({ products })
}

// PUT /api/admin/move-products — bulk move products to a new category
export async function PUT(req: NextRequest) {
    if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    try {
        const body = await req.json()
        const { productIds, targetCategoryId } = schema.parse(body)

        const category = await prisma.category.findUnique({ where: { id: targetCategoryId } })
        if (!category) return NextResponse.json({ error: 'Target category not found' }, { status: 404 })

        const result = await prisma.product.updateMany({
            where: { id: { in: productIds } },
            data: { categoryId: targetCategoryId },
        })
        return NextResponse.json({ success: true, movedCount: result.count })
    } catch (e: any) {
        if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
        return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 })
    }
}
