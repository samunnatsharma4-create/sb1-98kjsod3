/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'nl-pulse-soft': 'nl-fade-slide 0.55s ease-out both',
      },
    },
  },
  plugins: [],
};
