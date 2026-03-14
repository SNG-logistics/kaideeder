import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

// ── Auth guard ────────────────────────────────────────────────────
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

// ── Valid models whitelist ────────────────────────────────────────
const ALLOWED: Record<string, any> = {
    tenant: (prisma as any).tenant,
    user: (prisma as any).user,
    category: (prisma as any).category,
    diningtable: (prisma as any).diningTable,
    product: (prisma as any).product,
    order: (prisma as any).order,
}

// Some models don't have createdAt — use appropriate fallback sort field
const ORDER_BY: Record<string, object> = {
    category:    { name: 'asc' as const },
    diningtable: { number: 'asc' as const },
}

function getOrderBy(model: string): object {
    return ORDER_BY[model] ?? { createdAt: 'desc' as const }
}

// GET /api/admin/db-list/[model] — list records
export async function GET(req: Request, { params }: { params: Promise<{ model: string }> }) {
    const { model } = await params
    if (!await checkAuth()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const delegate = ALLOWED[model]
    if (!delegate) {
        return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
    }

    try {
        const records = await delegate.findMany({
            take: 200,
            orderBy: getOrderBy(model),
        })
        return NextResponse.json({ records })
    } catch (e: any) {
        console.error(`[db-list] ${model}`, e)
        return NextResponse.json({ error: e.message || 'Query failed' }, { status: 500 })
    }
}
