import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/banner/[tenantCode]
// Returns the menu banner image directly with browser cache headers.
// This lets the browser cache the image for 24h — avoids re-fetching on every scan.
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ tenantCode: string }> }
) {
    const { tenantCode } = await params

    try {
        const tenant = await prisma.tenant.findFirst({
            where: { code: tenantCode, status: 'ACTIVE' },
            select: { menuBannerBase64: true },
        })

        if (!tenant?.menuBannerBase64) {
            return new NextResponse(null, { status: 204 })
        }

        const buffer = Buffer.from(tenant.menuBannerBase64, 'base64')

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'image/jpeg',
                // Browser caches for 24h, CDN/proxy for 1h
                'Cache-Control': 'public, max-age=86400, s-maxage=3600, stale-while-revalidate=3600',
                'Content-Length': buffer.length.toString(),
                // ETag based on first 16 chars of base64 for conditional requests
                'ETag': `"banner-${tenant.menuBannerBase64.substring(0, 16)}"`,
            },
        })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
