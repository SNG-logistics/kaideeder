import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

// PUT /api/locations/[id] — update name/type
export const PUT = withAuth(async (req: NextRequest, context) => {
    const { tenantId } = context as any
    const id = (context as any).params?.id as string
    if (!id) return err('Missing id', 400)

    const body = await req.json()
    const { name, nameLao, type } = body
    if (!name?.trim()) return err('กรุณาระบุชื่อคลัง', 400)

    const loc = await prisma.location.findUnique({ where: { id } })
    if (!loc || (loc as any).tenantId !== tenantId) return err('ไม่พบคลัง', 404)

    const updated = await prisma.location.update({
        where: { id },
        data: {
            name: name.trim(),
            nameLao: nameLao?.trim() || null,
            ...(type && { type }),
        },
    })
    return ok(updated)
}, ['owner', 'manager'])

// DELETE /api/locations/[id] — soft-delete (isActive = false)
export const DELETE = withAuth(async (_req: NextRequest, context) => {
    const { tenantId } = context as any
    const id = (context as any).params?.id as string
    if (!id) return err('Missing id', 400)

    const loc = await prisma.location.findUnique({
        where: { id },
        include: { _count: { select: { inventory: true } } },
    })
    if (!loc || (loc as any).tenantId !== tenantId) return err('ไม่พบคลัง', 404)

    // Warn if inventory exists but still allow
    await prisma.location.update({ where: { id }, data: { isActive: false } })
    return ok({ deactivated: true })
}, ['owner', 'manager'])
