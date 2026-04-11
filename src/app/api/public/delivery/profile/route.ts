import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/public/delivery/profile?phone=xxx&tenant=yyy
// Returns the last delivery info for a phone number (no auth required)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const phone = searchParams.get('phone')?.trim()
        const tenantCode = searchParams.get('tenant')?.trim()

        if (!phone || phone.length < 6) {
            return NextResponse.json({ data: null })
        }

        // Resolve tenant
        const tenant = await prisma.tenant.findFirst({
            where: { code: tenantCode || '', status: 'ACTIVE' },
            select: { id: true },
        })
        if (!tenant) return NextResponse.json({ data: null })

        // Find the most recent delivery with this phone number
        const delivery = await prisma.deliveryInfo.findFirst({
            where: {
                tenantId: tenant.id,
                customerPhone: phone,
            },
            orderBy: { id: 'desc' },
        })

        if (!delivery) return NextResponse.json({ data: null })

        return NextResponse.json({
            data: {
                customerName: delivery.customerName,
                customerPhone: delivery.customerPhone,
                addressText: delivery.addressText,
                latitude: (delivery as any).latitude ?? null,
                longitude: (delivery as any).longitude ?? null,
            },
        })
    } catch (e) {
        console.error('[public/delivery/profile]', e)
        return NextResponse.json({ data: null })
    }
}
