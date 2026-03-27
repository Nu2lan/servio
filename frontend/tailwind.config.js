/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#fef7ee',
                    100: '#fdedd3',
                    200: '#fad7a5',
                    300: '#f6ba6d',
                    400: '#f19433',
                    500: '#ee7a12',
                    600: '#df6008',
                    700: '#b9480a',
                    800: '#933a10',
                    900: '#773110',
                    950: '#401706',
                },
                surface: {
                    50: 'rgb(var(--surface-50) / <alpha-value>)',
                    100: 'rgb(var(--surface-100) / <alpha-value>)',
                    200: 'rgb(var(--surface-200) / <alpha-value>)',
                    300: 'rgb(var(--surface-300) / <alpha-value>)',
                    400: 'rgb(var(--surface-400) / <alpha-value>)',
                    500: 'rgb(var(--surface-500) / <alpha-value>)',
                    600: 'rgb(var(--surface-600) / <alpha-value>)',
                    700: 'rgb(var(--surface-700) / <alpha-value>)',
                    800: 'rgb(var(--surface-800) / <alpha-value>)',
                    900: 'rgb(var(--surface-900) / <alpha-value>)',
                    950: 'rgb(var(--surface-950) / <alpha-value>)',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-in': 'slideIn 0.3s ease-out',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
                'shake': 'shake 0.5s ease-in-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideIn: {
                    '0%': { opacity: '0', transform: 'translateX(-10px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
                shake: {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '20%': { transform: 'translateX(-8px)' },
                    '40%': { transform: 'translateX(8px)' },
                    '60%': { transform: 'translateX(-4px)' },
                    '80%': { transform: 'translateX(4px)' },
                },
            },
        },
    },
    plugins: [],
}
