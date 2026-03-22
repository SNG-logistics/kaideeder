// @ts-nocheck
/**
 * POST /api/settings/store/logo — upload store logo image
 * Saves compressed WebP as Base64 in DB (logoBase64 field) — persistent across deploys
 * Sets logoUrl to /api/public/logo/<tenantCode> for serving
 */
import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/heic']
const MAX_SIZE = 20 * 1024 * 1024 // 20MB raw (will be compressed)

export const POST = withAuth(async (req: NextRequest, ctx) => {
    try {
        const formData = await req.formData()
        const file = formData.get('logo') as File | null
        if (!file) return err('ไม่พบไฟล์ logo', 400)
        if (!ALLOWED_TYPES.includes(file.type)) return err('รองรับเฉพาะ JPG, PNG, WEBP, GIF, SVG', 400)
        if (file.size > MAX_SIZE) return err('ไฟล์ต้องมีขนาดไม่เกิน 20MB', 400)

        // Get tenant code for the logoUrl path
        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { code: true },
        })
        if (!tenant) return err('Tenant not found', 404)

        const inputBuffer = Buffer.from(await file.arrayBuffer())

        let base64: string
        let logoUrl: string

        if (file.type === 'image/svg+xml') {
            // SVG: store as-is (base64 encoded)
            base64 = inputBuffer.toString('base64')
            // For SVG we store a data URL directly (small files)
            logoUrl = `/api/public/logo/${tenant.code}`
        } else {
            // Raster: compress and resize to 400x400 WebP
            const compressed = await sharp(inputBuffer)
                .resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 85 })
                .toBuffer()
            base64 = compressed.toString('base64')
            const originalKB = Math.round(file.size / 1024)
            const compressedKB = Math.round(compressed.length / 1024)
            console.log(`[logo upload] ${tenant.code}: ${originalKB}KB → ${compressedKB}KB (Base64 in DB)`)
            logoUrl = `/api/public/logo/${tenant.code}?t=${Date.now()}`
        }

        // Save Base64 to DB (persistent across deploys)
        await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: { logoBase64: base64, logoUrl },
        })

        return ok({ logoUrl })
    } catch (e: any) {
        console.error('[store/logo] upload error:', e)
        return err('เกิดข้อผิดพลาดในการอัปโหลด')
    }
}, { permission: 'SETTINGS_MANAGE' })
