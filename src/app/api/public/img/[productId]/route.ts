import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/public/img/[productId]
 * Returns the product image as binary WebP (if base64 stored)
 * or redirects to external imageUrl.
 * Cached for 1 hour — client re-fetches only when URL changes.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ productId: string }> }
) {
    const { productId } = await params

    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { imageBase64: true, imageUrl: true },
        })

        if (!product) {
            return new NextResponse(null, { status: 404 })
        }

        // Serve binary WebP from base64 (most common case)
        if (product.imageBase64) {
            const buffer = Buffer.from(product.imageBase64, 'base64')
            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    'Content-Type': 'image/webp',
                    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
                    'Content-Length': String(buffer.length),
                },
            })
        }

        // Fallback: redirect to external URL
        if (product.imageUrl) {
            return NextResponse.redirect(product.imageUrl, {
                headers: { 'Cache-Control': 'public, max-age=3600' },
            })
        }

        return new NextResponse(null, { status: 404 })
    } catch (e: any) {
        return new NextResponse(null, { status: 500 })
    }
}
