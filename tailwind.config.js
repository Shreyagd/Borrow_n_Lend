/** @type {import('tailwindcss').Config} */
// Theme: airy light-grey canvas, white chrome, indigo primary, coral accent, tight bold headlines.
// Token names are kept from earlier versions (pine = primary, clay = secondary accent) so components restyle from here.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f7f7fa',
        card: '#ffffff',
        ink: { DEFAULT: '#12121c', soft: '#55556a', mute: '#74748a' },
        pine: { DEFAULT: '#5848d0', dark: '#4538b0', light: '#efedfb' },
        clay: { DEFAULT: '#ee8b73', dark: '#c4492f', light: '#fdeeea' },
        line: '#e7e7ef',
        butter: { DEFAULT: '#f6dc94', light: '#fdf3d8' },
        blush: { DEFAULT: '#f4b8a8', light: '#fdeeea' },
        mist: { DEFAULT: '#a9c8ee', light: '#e8f0fb' },
        sage: { DEFAULT: '#a7d4bb', light: '#e6f4ec' },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
