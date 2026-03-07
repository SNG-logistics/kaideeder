import type { Metadata } from 'next'
import { Noto_Sans_Thai, Noto_Sans_Lao } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const notoSansThai = Noto_Sans_Thai({
    subsets: ['thai'],
    weight: ['300', '400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-thai',
})

const notoSansLao = Noto_Sans_Lao({
    subsets: ['lao'],
    weight: ['300', '400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-lao',
})

export const metadata: Metadata = {
    title: 'KAIDEEDER.com — ระบบจัดการร้านอาหาร',
    description: 'KAIDEEDER.com — ระบบ POS จัดการร้านอาหาร สต็อค และจอครัว',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="th" suppressHydrationWarning>
            <body className={`${notoSansThai.variable} ${notoSansLao.variable}`}
                style={{ fontFamily: 'var(--font-lao), var(--font-thai), sans-serif' }}>
                {children}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            fontFamily: 'var(--font-lao), var(--font-thai), sans-serif',
                            background: '#1A1A1A',
                            color: '#F5F0E8',
                            border: '1px solid #2A2A2A',
                            borderRadius: 12,
                            fontSize: '0.875rem',
                        },
                        success: {
                            iconTheme: { primary: '#C9A84C', secondary: '#0A0A0A' },
                        },
                        error: {
                            iconTheme: { primary: '#f87171', secondary: '#0A0A0A' },
                        },
                    }}
                />
            </body>
        </html>
    )
}
