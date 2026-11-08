/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: { colors: {
    app: 'var(--bg)', card: 'var(--card)', ink: 'var(--ink)', mute: 'var(--mute)', line: 'var(--line)',
    inc: '#34d399', exp: '#fb7185', inv: '#818cf8', sav: '#fbbf24' } } },
  plugins: [],
};
