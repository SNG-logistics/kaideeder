import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAdminAuth, ok, err } from '@/lib/admin-auth'

// ─── GET (Publicly accessible for the login page) ───────────────
export async function GET() {
    try {
        const configs = await prisma.platformConfig.findMany()

        // Convert array of {key, value} into a simple key-value object
        const settings = configs.reduce((acc, curr) => {
            acc[curr.key] = curr.value
            return acc
        }, {} as Record<string, string>)

        return Response.json({ success: true, data: settings })
    } catch (e) {
        return Response.json({ success: false, error: 'Failed to fetch platform config' })
    }
}

// ─── PATCH (Protected, SuperAdmin only) ─────────────────────────
export const PATCH = withAdminAuth(async (req: NextRequest, context) => {
    try {
        const body = await req.json()

        // Expected body: { REGISTER_URL: "...", CONTACT_URL: "..." }
        // We will upsert each key provided in the body
        const updates = []
        for (const [key, value] of Object.entries(body)) {
            if (typeof value === 'string') {
                updates.push(
                    prisma.platformConfig.upsert({
                        where: { key },
                        update: { value, updatedBy: context.admin.adminId },
                        create: { key, value, updatedBy: context.admin.adminId }
                    })
                )
            }
        }

        await prisma.$transaction(updates)

        return ok({ message: 'Platform settings updated' })
    } catch (e: any) {
        return err(e.message || 'Failed to update platform settings')
    }
}, 'SUPERADMIN')
