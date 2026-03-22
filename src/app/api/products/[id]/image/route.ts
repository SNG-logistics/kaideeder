import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import sharp from 'sharp'

// POST /api/products/[id]/image — upload + compress product image
// Saves compressed WebP as Base64 in DB (imageBase64 field) — persistent across deploys
export const POST = withAuth(async (req: NextRequest, ctx) => {
    const params = await ctx.params
    const id = params?.id
    if (!id) return err('Missing product id')

    try {
        const formData = await req.formData()
        const file = formData.get('image') as File | null
        if (!file) return err('ไม่พบไฟล์รูปภาพ')

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/heic']
        if (!allowedTypes.includes(file.type)) {
            return err('รองรับเฉพาะ JPEG, PNG, WebP, GIF, HEIC')
        }
        // Limit raw upload to 20MB (will be compressed down)
        if (file.size > 20 * 1024 * 1024) {
            return err('ไฟล์ขนาดเกิน 20MB')
        }

        // Check product exists + belongs to this tenant
        const product = await prisma.product.findFirst({
            where: { id, tenantId: ctx.tenantId },
        })
        if (!product) return err('ไม่พบสินค้า', 404)

        // Compress + resize with Sharp → WebP (600x600)
        const inputBuffer = Buffer.from(await file.arrayBuffer())
        const compressed = await sharp(inputBuffer)
            .resize(600, 600, {
                fit: 'cover',
                position: 'center',
            })
            .webp({ quality: 80 })
            .toBuffer()

        const originalKB = Math.round(file.size / 1024)
        const compressedKB = Math.round(compressed.length / 1024)
        console.log(`[image upload] ${id}: ${originalKB}KB → ${compressedKB}KB (Base64 in DB)`)

        // Save Base64 to DB — imageUrl points to the public API route
        const base64 = compressed.toString('base64')
        const imageUrl = `/api/public/img/${id}`

        await prisma.product.update({
            where: { id },
            data: { imageBase64: base64, imageUrl },
        })

        return ok({ imageUrl, originalKB, compressedKB })
    } catch (error) {
        console.error('Image upload error:', error)
        return err('อัปโหลดรูปไม่สำเร็จ')
    }
}, ['OWNER', 'MANAGER'])
