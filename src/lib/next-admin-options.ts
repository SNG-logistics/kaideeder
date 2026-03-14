import { prisma } from '@/lib/prisma'
import { NextAdminOptions } from '@premieroctet/next-admin'

export const options: NextAdminOptions = {
    title: 'KAIDEEDER Database',
    model: {
        Tenant: {
            title: 'Tenants',
        },
        User: {
            title: 'Store Users',
        },
        Product: {
            title: 'Products / Menu'
        },
        Order: {
            title: 'Orders'
        }
    },
}
