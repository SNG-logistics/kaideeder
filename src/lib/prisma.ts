import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

function makePrismaClient() {
    const client = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

    // Middleware: auto-reconnect on "Server has closed the connection"
    // Railway TCP proxy drops idle connections — this retries transparently.
    client.$use(async (params, next) => {
        const MAX_RETRIES = 3
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await next(params)
            } catch (e: any) {
                const isConnectionError =
                    e?.message?.includes('Server has closed the connection') ||
                    e?.message?.includes("Can't reach database server") ||
                    e?.message?.includes('Connection refused') ||
                    e?.code === 'P1001' || e?.code === 'P1002'

                if (isConnectionError && attempt < MAX_RETRIES) {
                    console.warn(`[Prisma] Connection lost — retrying (${attempt}/${MAX_RETRIES - 1})...`)
                    // Disconnect and reconnect
                    await client.$disconnect().catch(() => { })
                    await new Promise(r => setTimeout(r, 500 * attempt))
                    await client.$connect().catch(() => { })
                    continue
                }
                throw e
            }
        }
    })

    return client
}

export const prisma = globalForPrisma.prisma ?? makePrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
