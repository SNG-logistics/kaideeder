// @ts-nocheck
/**
 * GET  /api/settings/store — ดึงข้อมูลร้านของ tenant นี้
 * PATCH /api/settings/store — อัปเดต displayName หรือ logoUrl
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (_req: NextRequest, ctx) => {
    const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: {
            id: true,
            code: true,
            name: true,
            displayName: true,
            logoUrl: true,
            currency: true,
            timezone: true,
            phone: true,
            address: true,
            closingHour: true,
        },
    })
    
    if (!tenant) {
        return ok({
            id: ctx.tenantId,
            code: '',
            name: 'KAIDEEDER',
            displayName: 'KAIDEEDER',
            logoUrl: null,
        })
    }
    
    return ok(tenant)
})

const patchSchema = z.object({
    displayName: z.string().min(1).max(100).optional(),
    logoUrl: z.string().url().or(z.string().startsWith('/')).nullable().optional(),
    closingHour: z.number().int().min(0).max(12).optional(), // 0=midnight, 1-12 = business boundary hour
})

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
    try {
        const body = patchSchema.parse(await req.json())

        const updated = await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: {
                ...(body.displayName !== undefined && { displayName: body.displayName }),
                ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
                ...(body.closingHour !== undefined && { closingHour: body.closingHour }),
            },
            select: {
                id: true,
                code: true,
                name: true,
                displayName: true,
                logoUrl: true,
                currency: true,
                timezone: true,
                phone: true,
                address: true,
                closingHour: true,
            },
        })
        return ok(updated)
    } catch (e: any) {
        if (e?.name === 'ZodError') return err(e.errors[0]?.message ?? 'Invalid data', 422)
        return err('Error updating store settings')
    }
}, { permission: 'SETTINGS_MANAGE' })
