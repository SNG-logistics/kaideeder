/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@premieroctet/next-admin/dist/**/*.{js,ts,jsx,tsx}'
    ],
    theme: {
        extend: {
            colors: {
                gold: {
                    DEFAULT: '#C9A84C',
                    light: '#E2C472',
                    dark: '#9A7A2E',
                    50: '#FDF8EC',
                    100: '#F7EDCC',
                    200: '#EDD88A',
                    300: '#E2C472',
                    400: '#D4A84C',
                    500: '#C9A84C',
                    600: '#9A7A2E',
                    700: '#735C22',
                    800: '#4D3D17',
                    900: '#261E0B',
                },
                crimson: {
                    DEFAULT: '#8B0000',
                    mid: '#A50000',
                    bright: '#C0392B',
                    50: '#FFF0F0',
                    100: '#FFD6D6',
                    200: '#FF9999',
                    300: '#FF5555',
                    400: '#CC1111',
                    500: '#A50000',
                    600: '#8B0000',
                    700: '#660000',
                    800: '#440000',
                    900: '#220000',
                },
                luxury: {
                    bg: '#0D0D0D',
                    card: '#111111',
                    hover: '#1A1A1A',
                    border: '#2A2A2A',
                    text: '#F5F0E8',
                    muted: '#9A8E7A',
                    dim: '#6B6050',
                },
            },
            fontFamily: {
                sans: ['Noto Sans Thai', 'Inter', 'sans-serif'],
                serif: ['Cinzel', 'serif'],
            },
            boxShadow: {
                gold: '0 4px 20px rgba(201,168,76,0.35)',
                crimson: '0 4px 20px rgba(139,0,0,0.4)',
                luxury: '0 8px 32px rgba(0,0,0,0.6)',
            },
            backgroundImage: {
                'gold-gradient': 'linear-gradient(135deg, #9A7A2E, #C9A84C, #E2C472)',
                'crimson-gradient': 'linear-gradient(135deg, #8B0000, #A50000)',
                'dark-gradient': 'linear-gradient(180deg, #0A0A0A 0%, #111111 100%)',
            },
            animation: {
                'glow-gold': 'glowGold 2s ease-in-out infinite alternate',
            },
            keyframes: {
                glowGold: {
                    '0%': { boxShadow: '0 0 5px rgba(201,168,76,0.3)' },
                    '100%': { boxShadow: '0 0 20px rgba(201,168,76,0.7)' },
                },
            },
        },
    },
    plugins: [],
}
