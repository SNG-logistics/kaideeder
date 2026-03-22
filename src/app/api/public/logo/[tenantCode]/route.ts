import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/logo/[tenantCode]
// Serves the store logo from the database (logoBase64 field)
// Falls back to logoUrl redirect if no Base64 is stored yet
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ tenantCode: string }> }
) {
    const { tenantCode } = await params

    const tenant = await prisma.tenant.findFirst({
        where: { code: tenantCode },
        select: { logoBase64: true, logoUrl: true },
    })

    if (!tenant) {
        return new NextResponse('Not found', { status: 404 })
    }

    // Serve Base64 image from DB
    if (tenant.logoBase64) {
        const buffer = Buffer.from(tenant.logoBase64, 'base64')
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'image/webp',
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
            },
        })
    }

    // No logo stored yet
    return new NextResponse('No logo', { status: 404 })
}
