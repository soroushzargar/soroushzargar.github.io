import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          light: '#A3E635',
          DEFAULT: '#65A30D',
          dark: '#EA580C',
        },
      },
    },
  },
  plugins: [],
}

export default config
