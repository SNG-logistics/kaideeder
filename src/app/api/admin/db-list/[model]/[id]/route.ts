import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

async function checkAuth() {
    const cookieStore = await cookies()
    const token = cookieStore.get('admin_token')?.value
    if (!token) return false
    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as { role: string }
        return decoded.role === 'SUPERADMIN'
    } catch { return false }
}

const ALLOWED: Record<string, any> = {
    tenant: (prisma as any).tenant,
    user: (prisma as any).user,
    category: (prisma as any).category,
    diningtable: (prisma as any).diningTable,
    product: (prisma as any).product,
    order: (prisma as any).order,
}

type Ctx = { params: Promise<{ model: string; id: string }> }

// GET /api/admin/db-list/[model]/[id]
export async function GET(_req: Request, { params }: Ctx) {
    const { model, id } = await params
    if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const delegate = ALLOWED[model]
    if (!delegate) return NextResponse.json({ error: 'Unknown model' }, { status: 400 })
    try {
        const record = await delegate.findUnique({ where: { id } })
        if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json({ record })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// PATCH /api/admin/db-list/[model]/[id]  — update
export async function PATCH(req: Request, { params }: Ctx) {
    const { model, id } = await params
    if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const delegate = ALLOWED[model]
    if (!delegate) return NextResponse.json({ error: 'Unknown model' }, { status: 400 })

    const body = await req.json()
    // Strip read-only fields
    const { id: _id, createdAt, updatedAt, passwordHash, ...data } = body
    try {
        const record = await delegate.update({ where: { id }, data })
        return NextResponse.json({ record })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}

// DELETE /api/admin/db-list/[model]/[id]
export async function DELETE(_req: Request, { params }: Ctx) {
    const { model, id } = await params
    if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const delegate = ALLOWED[model]
    if (!delegate) return NextResponse.json({ error: 'Unknown model' }, { status: 400 })
    try {
        await delegate.delete({ where: { id } })
        return NextResponse.json({ ok: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
