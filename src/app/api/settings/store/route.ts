// @ts-nocheck
/**
 * GET  /api/settings/store — ดึงข้อมูลร้านของ tenant นี้
 * PATCH /api/settings/store — อัปเดต displayName หรือ logoUrl
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

export const GET = withAuth(async (_req: NextRequest, ctx) => {
    const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: {
            id: true,
            code: true,
            name: true,
            displayName: true,
            logoUrl: true,
        },
    })
    if (!tenant) return err('Tenant not found', 404)
    return ok(tenant)
})

const patchSchema = z.object({
    displayName: z.string().min(1).max(100).optional(),
    logoUrl: z.string().url().or(z.string().startsWith('/')).nullable().optional(),
})

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
    try {
        const body = patchSchema.parse(await req.json())

        const updated = await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: {
                ...(body.displayName !== undefined && { displayName: body.displayName }),
                ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
            },
            select: {
                id: true,
                code: true,
                name: true,
                displayName: true,
                logoUrl: true,
            },
        })
        return ok(updated)
    } catch (e: any) {
        if (e?.name === 'ZodError') return err(e.errors[0]?.message ?? 'Invalid data', 422)
        return err('Error updating store settings')
    }
}, { permission: 'SETTINGS_MANAGE' })
