/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        foreground: '#FFFFFF',
        accent: '#FF3B30',
        muted: '#808080',
        border: '#1A1A1A',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['7.5rem', { lineHeight: '0.9', letterSpacing: '-0.02em' }],
        'heading-l': ['2.5rem', { lineHeight: '1.1', letterSpacing: '0.05em' }],
        'caption-s': ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.1em' }],
      },
      transitionTimingFunction: {
        'circ-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
  plugins: [],
}
