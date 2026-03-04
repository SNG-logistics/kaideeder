// ============================================================
// routes/zones.ts — ตัวอย่างการใช้ rbac + tenantScope
// Express router
// ============================================================

import { Router } from 'express'
import { requireAuth, requireRole, tenantScope, AuthRequest } from '@/lib/middleware/rbac'
import { CAN_MANAGE_ZONE_TABLE, CAN_VIEW_ZONE_TABLE } from '@/lib/policy'
import { prisma } from '@/lib/prisma'

const router = Router()

// ── Apply requireAuth ให้ทุก route ──────────────────────────
router.use(requireAuth as any)

// ── GET /api/zones — ดูโซน (ทุก role ที่ได้รับอนุญาต) ─────
router.get('/', requireRole(CAN_VIEW_ZONE_TABLE) as any, async (req, res) => {
    const user = (req as AuthRequest).user
    try {
        const zones = await prisma.zone.findMany({
            where: tenantScope(user),       // ← tenant isolation: ใช้ tenantId จาก user
            orderBy: { sortOrder: 'asc' },
        })
        res.json({ success: true, data: zones })
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// ── POST /api/zones — สร้างโซนใหม่ (OWNER/MANAGER เท่านั้น) ─
router.post('/', requireRole(CAN_MANAGE_ZONE_TABLE) as any, async (req, res) => {
    const user = (req as AuthRequest).user
    const { name, color } = req.body
    try {
        const zone = await prisma.zone.create({
            data: { ...tenantScope(user), name, color },
        })
        res.status(201).json({ success: true, data: zone })
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message })
    }
})

// ── DELETE /api/zones/:id — ลบโซน (OWNER/MANAGER เท่านั้น) ─
router.delete('/:id', requireRole(CAN_MANAGE_ZONE_TABLE) as any, async (req, res) => {
    const user = (req as AuthRequest).user
    try {
        // tenant isolation: ตรวจสอบว่า zone นั้นเป็นของ tenant นี้
        const zone = await prisma.zone.findFirst({
            where: { id: req.params.id, ...tenantScope(user) },
        })
        if (!zone) return res.status(404).json({ success: false, error: 'Not found' })
        await prisma.zone.delete({ where: { id: zone.id } })
        res.json({ success: true })
    } catch (e: any) {
        res.status(500).json({ success: false, error: e.message })
    }
})

export default router

// ============================================================
// ตัวอย่างที่ 2: Next.js App Router
// src/app/api/zones/route.ts
// ============================================================
/*
import { withRole } from '@/lib/middleware/rbac'
import { tenantScope } from '@/lib/middleware/rbac'
import { CAN_MANAGE_ZONE_TABLE, CAN_VIEW_ZONE_TABLE } from '@/lib/policy'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export const GET = withRole(async (req, user) => {
    const zones = await prisma.zone.findMany({
        where: tenantScope(user),
    })
    return NextResponse.json({ success: true, data: zones })
}, CAN_VIEW_ZONE_TABLE)

export const POST = withRole(async (req, user) => {
    const body = await req.json()
    const zone = await prisma.zone.create({
        data: { ...tenantScope(user), ...body },
    })
    return NextResponse.json({ success: true, data: zone }, { status: 201 })
}, CAN_MANAGE_ZONE_TABLE)
*/
