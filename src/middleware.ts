import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
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
         * - q (QR menu for customers)
         * - receipt (Receipt view)
         * - public images/assets ending in .png, .jpg, .svg, etc.
         */
        '/((?!api|_next/static|_next/image|favicon.ico|login|q|receipt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
