/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'comic-bg': '#f5f0e8',
        'comic-ink': '#1a1a1a',
        'comic-line': '#333333',
        'comic-accent': '#c9a96e',
        'comic-panel': '#ffffff',
        'comic-shadow': '#e0d9cc',
      },
      fontFamily: {
        'comic': ['"Comic Neue"', 'cursive', 'sans-serif'],
      },
      boxShadow: {
        'panel': '2px 2px 0px #1a1a1a',
        'panel-hover': '4px 4px 0px #1a1a1a',
      },
    },
  },
  plugins: [],
}
