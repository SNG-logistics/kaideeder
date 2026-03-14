import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// GET /api/categories
export const GET = withAuth(async (_req, context) => {
    const { tenantId } = context as any
    const categories = await prisma.category.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
    })
    return ok(categories)
})

// POST /api/categories — create a new custom category
export const POST = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const body = await req.json()
    const { name, icon, color, type } = body
    if (!name?.trim()) return err('กรุณาระบุชื่อหมวด')

    // Generate code from name (slug-like, ASCII letters/digits/underscore)
    const prefix = type === 'MENU' ? 'CUSTOM_MENU_' : type === 'STOCK' ? 'CUSTOM_RAW_' : 'CUSTOM_'
    const code = prefix + name.trim().toUpperCase()
        .replace(/[^A-Z0-9ก-๙]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 30)

    // Ensure uniqueness within tenant
    const exists = await prisma.category.findFirst({ where: { tenantId, code } })
    if (exists) {
        // Return the existing one instead of failing
        return ok(exists, 200)
    }

    const category = await prisma.category.create({
        data: {
            tenantId,
            code,
            name: name.trim(),
            icon: icon || '🏷️',
            color: color || '#6B7280',
            isActive: true,
        },
    })
    return ok(category, 201)
}, ['owner', 'manager'])

