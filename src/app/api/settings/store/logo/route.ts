// @ts-nocheck
/**
 * POST /api/settings/store/logo — upload store logo image
 * Saves to /public/uploads/logos/<tenantCode>.<ext>
 * Returns { success: true, data: { logoUrl: '/uploads/logos/...' } }
 */
import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export const POST = withAuth(async (req: NextRequest, ctx) => {
    try {
        const formData = await req.formData()
        const file = formData.get('logo') as File | null
        if (!file) return err('ไม่พบไฟล์ logo', 400)
        if (!ALLOWED_TYPES.includes(file.type)) return err('รองรับเฉพาะ JPG, PNG, WEBP, GIF, SVG', 400)
        if (file.size > MAX_SIZE) return err('ไฟล์ต้องมีขนาดไม่เกิน 5MB', 400)

        // Get tenant code for filename
        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { code: true },
        })
        if (!tenant) return err('Tenant not found', 404)

        const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
        const filename = `${tenant.code}.${ext}`
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
        await mkdir(uploadDir, { recursive: true })

        const buffer = Buffer.from(await file.arrayBuffer())
        const filePath = path.join(uploadDir, filename)
        await writeFile(filePath, buffer)

        const logoUrl = `/uploads/logos/${filename}`

        // Save logoUrl to Tenant
        await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: { logoUrl },
        })

        return ok({ logoUrl })
    } catch (e: any) {
        console.error('[store/logo] upload error:', e)
        return err('เกิดข้อผิดพลาดในการอัปโหลด')
    }
}, { permission: 'SETTINGS_MANAGE' })
