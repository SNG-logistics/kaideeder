import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok } from '@/lib/api'

// GET /api/prep-recipes/[id]/productions — production history
export const GET = withAuth(async (req: NextRequest, ctx: any) => {
    const { tenantId, params } = ctx
    const id = params?.id
    const { searchParams } = new URL(req.url)
    const take = Math.min(Number(searchParams.get('take') || 50), 100)

    const productions = await prisma.prepProduction.findMany({
        where: { tenantId, prepRecipeId: id },
        orderBy: { producedAt: 'desc' },
        take,
        include: {
            location: { select: { id: true, code: true, name: true } },
            prepRecipe: { select: { name: true, yieldUnit: true } },
        },
    })
    return ok(productions)
}, ['OWNER', 'MANAGER'])
