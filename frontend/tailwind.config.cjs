/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#1a1b1e',
        surface: '#25262b',
        border: '#2c2e33',
        text: '#c1c2c5',
        primary: '#646cff',
        'primary-hover': '#535bf2',
      },
    },
  },
  plugins: [],
} 