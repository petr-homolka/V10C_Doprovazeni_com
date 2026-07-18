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

        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-inverse': 'var(--text-inverse)',

        border: {
          DEFAULT: 'var(--border-default)',
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
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Source Serif 4', 'Georgia', 'serif'],
      },
      transitionDuration: {
        150: '150ms',
        200: '200ms',
      },
    },
  },
  plugins: [],
}
