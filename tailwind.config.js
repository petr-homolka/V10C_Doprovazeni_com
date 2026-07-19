/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        surface: 'var(--bg-surface)',
        'surface-soft': 'var(--bg-surface-soft)',
        inset: 'var(--bg-inset)',
        void: 'var(--bg-void)',
        'overlay-active': 'var(--overlay-active)',
        'toggle-off': 'var(--toggle-off)',
        'toggle-thumb': 'var(--toggle-thumb)',
        accent: 'var(--accent)',

        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-inverse': 'var(--text-inverse)',

        border: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          medium: 'var(--border-medium)',
          strong: 'var(--border-strong)',
        },

        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          foreground: 'var(--primary-foreground)',
          soft: 'var(--primary-soft)',
          'soft-hover': 'var(--primary-soft-hover)',
        },
        ring: 'var(--ring)',

        subject: {
          foster: 'var(--subject-foster)',
          'foster-bg': 'var(--subject-foster-bg)',
          ospod: 'var(--subject-ospod)',
          'ospod-bg': 'var(--subject-ospod-bg)',
          court: 'var(--subject-court)',
          'court-bg': 'var(--subject-court-bg)',
          bio: 'var(--subject-bio)',
          'bio-bg': 'var(--subject-bio-bg)',
        },
        crisis: {
          DEFAULT: 'var(--crisis)',
          bg: 'var(--crisis-bg)',
        },
        success: {
          DEFAULT: 'var(--success)',
          bg: 'var(--success-bg)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          bg: 'var(--warning-bg)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          bg: 'var(--danger-bg)',
          solid: 'var(--danger-solid)',
        },
        tier: {
          DEFAULT: 'var(--tier-accent)',
          bg: 'var(--tier-accent-bg)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        raised: 'var(--shadow-raised)',
        overlay: 'var(--shadow-overlay)',
      },
      fontFamily: {
        sans: ['Geist Sans', 'system-ui', 'sans-serif'],
        mono: [
          'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas',
          '"Liberation Mono"', '"Courier New"', 'monospace',
        ],
      },
      transitionDuration: {
        150: '150ms',
        200: '200ms',
      },
      keyframes: {
        'mic-breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
        },
        'mic-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.45' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'mic-breathe': 'mic-breathe 1.4s ease-in-out infinite',
        'mic-ring': 'mic-ring 1.4s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        'slide-in-right': 'slide-in-right 250ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
