// @ts-nocheck
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'
import { hashPassword } from '@/lib/auth'

// GET /api/settings/users — list all users in this tenant (SETTINGS_MANAGE only)
export const GET = withAuth(async (_req: NextRequest, ctx) => {
    const users = await prisma.user.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
        },
    })
    return ok(users)
}, { permission: 'SETTINGS_MANAGE' })

// POST /api/settings/users — create a new user in this tenant (SETTINGS_MANAGE only)
const createSchema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscore only'),
    name: z.string().min(1).max(80),
    role: z.enum(['OWNER', 'MANAGER', 'PURCHASER', 'WAREHOUSE', 'KITCHEN', 'BAR', 'CASHIER', 'VIEWER']),
    password: z.string().min(6),
})

export const POST = withAuth(async (req: NextRequest, ctx) => {
    try {
        const body = createSchema.parse(await req.json())

        const exists = await prisma.user.findUnique({
            where: { tenantId_username: { tenantId: ctx.tenantId, username: body.username } },
        })
        if (exists) return err(`Username "${body.username}" already exists`)

        const user = await prisma.user.create({
            data: {
                tenantId: ctx.tenantId,
                username: body.username,
                name: body.name,
                role: body.role,
                passwordHash: await hashPassword(body.password),
                isActive: true,
            },
            select: { id: true, username: true, name: true, role: true, isActive: true },
        })
        return ok(user, 201)
    } catch (e: any) {
        if (e?.code === 'P2002') return err('Username already taken')
        if (e?.name === 'ZodError') return err(e.errors[0]?.message ?? 'Invalid data', 422)
        return err('Error creating user')
    }
}, { permission: 'SETTINGS_MANAGE' })
