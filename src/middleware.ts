import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Tenant code to use when accessed from delivery subdomain
// Maps delivery.kaideeder.com → /d/kaideeder
const DELIVERY_SUBDOMAIN = 'delivery'
const DEFAULT_TENANT_CODE = 'kaideeder'

export function middleware(request: NextRequest) {
    const { hostname, pathname } = request.nextUrl

    // ── Subdomain routing: delivery.kaideeder.com → /d/kaideeder ──────────────
    // Works both in production (delivery.kaideeder.com) and
    // if we ever run with custom hosts locally
    const isDeliverySubdomain =
        hostname.startsWith(`${DELIVERY_SUBDOMAIN}.`) &&
        !hostname.startsWith('localhost') &&
        !hostname.startsWith('127.')

    if (isDeliverySubdomain) {
        // Already on a /d/ path — let it through (avoid redirect loop)
        if (pathname.startsWith('/d/')) {
            return NextResponse.next()
        }
        // API calls from delivery pages — let through
        if (pathname.startsWith('/api/')) {
            return NextResponse.next()
        }
        // Everything else on delivery subdomain → redirect to /d/[tenantCode]
        const url = request.nextUrl.clone()
        url.hostname = hostname.replace(`${DELIVERY_SUBDOMAIN}.`, '')
        url.pathname = `/d/${DEFAULT_TENANT_CODE}${pathname === '/' ? '' : pathname}`
        return NextResponse.redirect(url, 301)
    }

    // ── Standard auth guard (existing logic) ──────────────────────────────────
    const token = request.cookies.get('token')?.value

    // If no token exists, redirect to login
    if (!token) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Protect all UI routes EXCEPT:
         * - api (API routes handle their own auth via withAuth)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - login (auth pages)
         * - q (QR scan for tables)
         * - m (QR menu for customers)
         * - d (Delivery public pages — QR scan)
         * - receipt (Receipt view)
         * - public images/assets ending in .png, .jpg, .svg, etc.
         */
        '/((?!api|_next/static|_next/image|favicon.ico|login|q|m|d|receipt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
