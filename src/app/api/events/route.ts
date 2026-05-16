import { NextRequest } from 'next/server'
import { getEventEmitter } from '@/lib/events'
import { verifyToken } from '@/lib/auth'

// Make this route dynamic so it streams correctly
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value || req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return new Response('Unauthorized', { status: 401 })
    
    const user = verifyToken(token)
    if (!user || !user.tenantId) return new Response('Unauthorized', { status: 401 })
    const tenantId = user.tenantId

    const emitter = getEventEmitter()

    const stream = new ReadableStream({
        start(controller) {
            // Encode function for SSE
            const encoder = new TextEncoder()
            const sendEvent = (event: string, data: any) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
            }

            // Initial connection success
            sendEvent('connected', { status: 'ok' })

            // Create listener
            const onOrdersUpdated = (eventTenantId: string) => {
                if (eventTenantId === tenantId) {
                    sendEvent('ORDERS_UPDATED', { timestamp: Date.now() })
                }
            }

            const onDeliveryUpdated = (eventTenantId: string) => {
                if (eventTenantId === tenantId) {
                    sendEvent('DELIVERY_UPDATED', { timestamp: Date.now() })
                }
            }

            // Subscribe
            emitter.on('ORDERS_UPDATED', onOrdersUpdated)
            emitter.on('DELIVERY_UPDATED', onDeliveryUpdated)

            // Keep connection alive
            const keepAlive = setInterval(() => {
                controller.enqueue(encoder.encode(': keepalive\n\n'))
            }, 30000)

            // Cleanup on disconnect
            req.signal.addEventListener('abort', () => {
                clearInterval(keepAlive)
                emitter.off('ORDERS_UPDATED', onOrdersUpdated)
                emitter.off('DELIVERY_UPDATED', onDeliveryUpdated)
                controller.close()
            })
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    })
}
