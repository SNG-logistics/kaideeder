import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

// POST /api/products/[id]/image — upload + compress product image
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

        // Check product exists
        const product = await prisma.product.findUnique({ where: { id } })
        if (!product) return err('ไม่พบสินค้า', 404)

        // Compress + resize with Sharp → WebP
        const inputBuffer = Buffer.from(await file.arrayBuffer())
        const compressed = await sharp(inputBuffer)
            .resize(600, 600, {
                fit: 'cover',        // crop to square
                position: 'center',
            })
            .webp({ quality: 80 })   // convert to WebP ~80% quality
            .toBuffer()

        // Save as .webp (replaces old file)
        const filename = `${id}.webp`
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products')
        await mkdir(uploadDir, { recursive: true })
        await writeFile(path.join(uploadDir, filename), compressed)

        const originalKB = Math.round(file.size / 1024)
        const compressedKB = Math.round(compressed.length / 1024)
        console.log(`[image upload] ${filename}: ${originalKB}KB → ${compressedKB}KB (${Math.round(compressedKB / originalKB * 100)}%)`)

        // Update product imageUrl
        const imageUrl = `/uploads/products/${filename}?t=${Date.now()}`
        await prisma.product.update({ where: { id }, data: { imageUrl } })

        return ok({ imageUrl, originalKB, compressedKB })
    } catch (error) {
        console.error('Image upload error:', error)
        return err('อัปโหลดรูปไม่สำเร็จ')
    }
}, ['OWNER', 'MANAGER'])
