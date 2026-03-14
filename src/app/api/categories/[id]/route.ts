import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// PUT /api/categories/[id]
export const PUT = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const params = (await context.params) || {}
    const id = params.id as string
    const body = await req.json()
    const { name, icon, color, type } = body

    if (!name?.trim()) return err('กรุณาระบุชื่อหมวด')

    // Find existing category to check if it's customized/system
    const existing = await prisma.category.findFirst({ where: { id, tenantId } })
    if (!existing) return err('ไม่พบหมวดหมู่นี้', 404)

    const isSystemCategory = !existing.code.startsWith('CUSTOM_')

    // If it's a completely newly provided type or rename for a custom category
    let newCode = existing.code
    if (!isSystemCategory) {
        // usually we shouldn't change system category code
    } else {
        // if user changed the name or type, we could optionally update the code, 
        // but it's safer to keep it unless we strictly want it changed
        const prefix = type === 'MENU' ? 'CUSTOM_MENU_' : type === 'STOCK' ? 'CUSTOM_RAW_' : 'CUSTOM_'
        newCode = prefix + name.trim().toUpperCase()
            .replace(/[^A-Z0-9ก-๙]/g, '_')
            .replace(/_+/g, '_')
            .slice(0, 30)
    }

    const updated = await prisma.category.update({
        where: { id },
        data: {
            name: name.trim(),
            icon: icon || existing.icon,
            color: color || existing.color,
            code: newCode
        }
    })

    return ok(updated)
}, ['owner', 'manager'])

// DELETE /api/categories/[id]
export const DELETE = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const params = (await context.params) || {}
    const id = params.id as string

    // Check if category exists
    const existing = await prisma.category.findFirst({ 
        where: { id, tenantId },
        include: { _count: { select: { products: true } } }
    })
    if (!existing) return err('ไม่พบหมวดหมู่นี้', 404)

    // Cannot delete if there are products inside
    if (existing._count.products > 0) {
        return err(`ไม่สามารถลบได้ เนื่องจากมีสินค้าอยู่ในหมวดหมู่นี้ (${existing._count.products} รายการ)`)
    }

    // System categories typically shouldn't be deleted, but if we allow it or restrict to CUSTOM_ only:
    if (!existing.code.startsWith('CUSTOM_')) {
        return err('ไม่สามารถลบหมวดหมู่ระบบพื้นฐานได้')
    }

    await prisma.category.delete({
        where: { id }
    })

    return ok({ deleted: true })
}, ['owner', 'manager'])
