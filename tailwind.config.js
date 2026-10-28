/** @type {import('tailwindcss').Config} */
// "Paper Haven" (from borrowlend_marketplace_redesign.html): warm paper, forest green, terracotta, sand.
// Token names stay stable across redesigns: pine = forest green (primary), clay = terracotta (accent).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FBF9F5',
        card: '#FFFFFF',
        sand: '#F3EDE2',
        ink: { DEFAULT: '#2D3748', soft: '#4B5563', mute: '#6B7280' },
        pine: { DEFAULT: '#1B3B2B', dark: '#12291E', soft: '#2C5A43', light: '#E7EFEA' },
        clay: { DEFAULT: '#C04E2D', dark: '#A53E20', light: '#FBF0EC' },
        line: '#ECE5D8',
        butter: { DEFAULT: '#f6dc94', light: '#fdf3d8' },
        blush: { DEFAULT: '#f4b8a8', light: '#fbf0ec' },
        mist: { DEFAULT: '#a9c8ee', light: '#e8f0fb' },
        sage: { DEFAULT: '#a7d4bb', light: '#e6f4ec' },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 4px 12px -2px rgba(0, 0, 0, 0.02)',
        float: '0 20px 40px -10px rgba(27, 59, 43, 0.12)',
      },
    },
  },
  plugins: [],
}
