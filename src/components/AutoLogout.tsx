'use client'
import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function AutoLogout() {
    const router = useRouter()
    const pathname = usePathname()
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Set timeout duration: 1 hour = 3600000 ms
    const TIMEOUT_MS = 60 * 60 * 1000

    const resetTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current)

        // Only run timer if not on the login page
        if (pathname && !pathname.includes('login') && !pathname.includes('/q/')) {
            timerRef.current = setTimeout(async () => {
                try {
                    // Call the logout route (clear cookie)
                    await fetch('/api/auth/me', { method: 'DELETE' })
                } catch {
                    // Silent
                }
                // Redirect user back to login with a special hash or direct redirect
                window.location.href = '/login'
            }, TIMEOUT_MS)
        }
    }

    useEffect(() => {
        // Events to listen for activity
        const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart']

        const handleActivity = () => {
            resetTimer()
        }

        events.forEach(event => window.addEventListener(event, handleActivity))

        // Initial timer setup
        resetTimer()

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            events.forEach(event => window.removeEventListener(event, handleActivity))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]) // Re-run when pathname changes to ensure we do not timeout on login screen

    return null
}
