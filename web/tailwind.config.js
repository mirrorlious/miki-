/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          canvas: 'var(--color-bg-canvas)',
          surface: 'var(--color-bg-surface)',
          subtle: 'var(--color-bg-subtle)',
          muted: 'var(--color-bg-muted)',
          'text-primary': 'var(--color-text-primary)',
          'text-secondary': 'var(--color-text-secondary)',
          'text-muted': 'var(--color-text-muted)',
          border: 'var(--color-border)',
          'accent-bg': 'var(--color-accent-bg)',
          'accent-text': 'var(--color-accent-text)',
          'success-bg': 'var(--color-success-bg)',
          'danger-bg': 'var(--color-danger-bg)',
          'warning-bg': 'var(--color-warning-bg)',
        },
      },
    },
  },
  plugins: [],
}
