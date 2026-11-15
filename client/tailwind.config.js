/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        quiz: {
          red: '#EF4444',
          blue: '#3B82F6',
          yellow: '#F59E0B',
          green: '#10B981',
          darkBg: '#0B0F19',
          darkCard: '#151D2F',
          darkBorder: '#232E48'
        }
      },
      animation: {
        'bounce-short': 'bounce 0.5s ease-in-out 1',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
