// @ts-nocheck
/**
 * POST /api/settings/store/logo — upload store logo image
 * Saves to /public/uploads/logos/<tenantCode>.webp (compressed)
 * Returns { success: true, data: { logoUrl: '/uploads/logos/...' } }
 */
import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
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

        // Get tenant code for filename
        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { code: true },
        })
        if (!tenant) return err('Tenant not found', 404)

        const inputBuffer = Buffer.from(await file.arrayBuffer())

        let finalBuffer: Buffer
        let filename: string

        if (file.type === 'image/svg+xml') {
            // SVG: save as-is (vector, not supported by Sharp)
            finalBuffer = inputBuffer
            filename = `${tenant.code}.svg`
        } else {
            // Raster: compress and resize to 400x400 WebP (logo is smaller than product)
            finalBuffer = await sharp(inputBuffer)
                .resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 85 })
                .toBuffer()
            filename = `${tenant.code}.webp`
            const originalKB = Math.round(file.size / 1024)
            const compressedKB = Math.round(finalBuffer.length / 1024)
            console.log(`[logo upload] ${filename}: ${originalKB}KB → ${compressedKB}KB`)
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
        await mkdir(uploadDir, { recursive: true })
        await writeFile(path.join(uploadDir, filename), finalBuffer)

        const logoUrl = `/uploads/logos/${filename}?t=${Date.now()}`

        // Save logoUrl to Tenant
        await prisma.tenant.update({ where: { id: ctx.tenantId }, data: { logoUrl } })

        return ok({ logoUrl })
    } catch (e: any) {
        console.error('[store/logo] upload error:', e)
        return err('เกิดข้อผิดพลาดในการอัปโหลด')
    }
}, { permission: 'SETTINGS_MANAGE' })
