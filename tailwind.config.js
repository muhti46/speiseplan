import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Nur ein Breakpoint wird genutzt; er ist als eigene Variante unten definiert.
    screens: {},
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
    },
  },
  plugins: [
    // `sm:` greift nicht, wenn index.html einen Handy im Chrome-"Desktop-Modus"
    // erkannt hat (html.force-mobile) - sonst würde dort das Desktop-Layout erscheinen.
    plugin(({ addVariant }) => {
      addVariant('sm', '@media (min-width: 640px) { html:not(.force-mobile) & }');
    }),
  ],
};
