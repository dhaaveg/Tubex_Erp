/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary-600': '#4F46E5',
        'primary-700': '#4338CA',
        'primary-50': '#EEF2FF',
        'bg-app': 'var(--bg-app)',
        'bg-surface': 'var(--bg-surface)',
        'border-subtle': 'var(--border-subtle)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        'status-success': '#10B981',
        'status-warning': '#F59E0B',
        'status-danger': '#EF4444',
        slate: {
          750: '#293548',
          850: '#172033',
        },
        primary: {
          50: '#EEF2FF',
          600: '#4F46E5',
          700: '#4338CA',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
        corporate: {
          bg: '#F8FAFC',
          border: '#E2E8F0',
          navy: '#0F172A',
          blue: '#4F46E5',
          surface: '#FFFFFF',
          card: '#FFFFFF',
          text: '#0F172A',
          muted: '#64748B',
          accent: '#4338CA',
        },
        steel: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        industrial: {
          amber: '#f59e0b',
          blue: '#4f46e5',
          emerald: '#10b981',
          rose: '#ef4444',
          cyan: '#06b6d4',
          indigo: '#6366f1',
        },
      },
      backgroundColor: {
        app: 'var(--bg-app)',
        surface: 'var(--bg-surface)',
      },
      textColor: {
        main: 'var(--text-main)',
        muted: 'var(--text-muted)',
      },
      borderColor: {
        subtle: 'var(--border-subtle)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

