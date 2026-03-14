import { NextAdmin } from '@premieroctet/next-admin'
import { getNextAdminProps } from '@premieroctet/next-admin/appRouter'
import { prisma } from '@/lib/prisma'
import { options } from '@/lib/next-admin-options'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { headers } from 'next/headers'

export default async function AdminDatabasePage(props: {
    params: Promise<{ nextadmin: string[] }>
    searchParams: Promise<any>
}) {
    const params = await props.params
    const searchParams = await props.searchParams
    // Auth Check manually for page
    const hdrs = await headers()
    const tokenStr = hdrs.get('authorization')
    let authorized = false
    try {
        if (tokenStr?.startsWith('Bearer ')) {
            const token = tokenStr.split(' ')[1]
            const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET!) as { role: string }
            if (decoded.role === 'SUPERADMIN') authorized = true
        }
    } catch { }

    if (!authorized) {
        return (
            <div className="w-full h-full bg-white rounded-lg shadow-xl overflow-hidden p-8 text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
                <p className="text-gray-600">You must be a SUPERADMIN to access the direct database management console.</p>
            </div>
        )
    }

    const nextAdminProps = await getNextAdminProps({
        params: params.nextadmin,
        searchParams: searchParams,
        apiBasePath: '/api/admin/database',
        basePath: '/admin/database',
        prisma,
        options,
    })

    return (
        <div className="w-full h-full bg-white rounded-lg shadow-xl overflow-hidden text-black p-4">
            <h1 className="text-xl font-bold mb-4">Direct Database Management</h1>
            <NextAdmin {...nextAdminProps} />
        </div>
    )
}
