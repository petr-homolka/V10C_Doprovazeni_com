/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        surface: 'var(--bg-surface)',
        'surface-soft': 'var(--bg-surface-soft)',
        field: 'var(--field-bg)',
        inset: 'var(--bg-inset)',
        void: 'var(--bg-void)',
        'overlay-active': 'var(--overlay-active)',
        'toggle-off': 'var(--toggle-off)',
        'toggle-thumb': 'var(--toggle-thumb)',
        accent: 'var(--accent)',

        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        /* `text-text-faint` se v appce používalo na 8 místech, ANIŽ BY TU
           barva existovala — Tailwind takovou třídu vůbec nevygeneroval,
           takže popisky, které měly být nejtišší (⌘K, jednotky, nadpisy
           skupin ve „Zobrazení"), dědily barvu rodiče a byly stejně silné
           jako obsah. Odhaleno 2026-07-25 při stavbě nového profilu. */
        'text-faint': 'var(--text-faint)',
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
        online: 'var(--online)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        raised: 'var(--shadow-raised)',
        md: 'var(--shadow-md)',
        overlay: 'var(--shadow-overlay)',
        xl: 'var(--shadow-xl)',
        focus: 'var(--focus-ring)',
      },
      /*
        TYPOGRAFICKÁ STUPNICE.

        Historie a proč je teď taková: nejdřív byla odečtená z Routine
        (13/19 základ), protože jsem chtěl jejich hustotu. Petr na to
        2026-07-25 řekl „pěkné, ale titěrné (malé prvky, malá velikost
        písma)" — a měl pravdu. Routine je nástroj pro osobní úkoly, kde
        člověk kouká na dvacet řádků naráz; tahle appka je spis, ve kterém
        se ČTE (zápisy, lhůty, jména) a ve kterém se rozhoduje. 13px je na
        čtení malé, obzvlášť na velkém monitoru z metru.

        Stupnice je proto o dva stupně výš (základ 15/23) a rozestupy s ní.
        Vzdušnost tím netrpí — vzdušnost dělá prázdné místo mezi věcmi, a to
        se zvětšilo taky (výška řádku 44 px, mezera mezi sekcemi 40 px).

        Přemapování stupnice posune CELOU appku (`text-sm` je v ní 515×,
        `text-xs` 127×) bez zásahu do komponent. Jinak by to byla změna na
        pět set místech a rozešlo by se to do týdne.
      */
      fontSize: {
        '2xs': ['11px', '16px'],
        xs: ['12px', '18px'],
        sm: ['14px', '21px'],
        base: ['15px', '23px'],
        lg: ['17px', '25px'],
        xl: ['21px', '30px'],
        '2xl': ['26px', '34px'],
        '3xl': ['34px', '42px'],
      },

      /*
        TUČNOST — tohle je ta nejdůležitější jediná změna.

        V jejich CSS je `font-weight:500` 329×, `400` 311×, ale `600` jen
        26× a `700` čtyřikrát. Hierarchii tam nedělá tučnost, dělá ji
        velikost a barva textu. Appka měla 53× `font-semibold` a 35×
        `font-bold`, takže všechno křičelo.

        Místo přepisování 88 míst přemapujeme význam tříd: `font-semibold`
        kreslí 500 a `font-bold` kreslí 600. Tučnější řez v appce prostě
        neexistuje — a nedá se omylem použít.
      */
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '500',
        bold: '600',
        extrabold: '600',
      },

      fontFamily: {
        sans: [
          'Inter', '-apple-system', 'system-ui', 'BlinkMacSystemFont',
          'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
        // Routine používá JEDEN font na všechno. Druhý řez pro nadpisy dělal
        // z každého titulku jiný hlas; `font-heading` teď kreslí Inter, takže
        // 13 míst, kde se používá, se srovnalo se zbytkem.
        heading: [
          'Inter', '-apple-system', 'system-ui', 'BlinkMacSystemFont',
          'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
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
        'day-in-forward': {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'day-in-backward': {
          from: { transform: 'translateX(-24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'mic-breathe': 'mic-breathe 1.4s ease-in-out infinite',
        'mic-ring': 'mic-ring 1.4s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        'day-in-forward': 'day-in-forward 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'day-in-backward': 'day-in-backward 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-right': 'slide-in-right 250ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      // `prose` (dokumenty, náhled editoru, moje dashboard) navázané na naše
      // tokeny, ne na natvrdo šedé odstíny Tailwind Typography — jinak by
      // nadpisy/tučné byly v tmavém režimu neviditelné (tokeny se přepínají
      // podle světla/tmy, viz index.css).
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--text-primary)',
            '--tw-prose-headings': 'var(--text-primary)',
            '--tw-prose-lead': 'var(--text-secondary)',
            '--tw-prose-links': 'var(--accent)',
            '--tw-prose-bold': 'var(--text-primary)',
            '--tw-prose-counters': 'var(--text-tertiary)',
            '--tw-prose-bullets': 'var(--text-tertiary)',
            '--tw-prose-hr': 'var(--border-default)',
            '--tw-prose-quotes': 'var(--text-secondary)',
            '--tw-prose-quote-borders': 'var(--border-default)',
            '--tw-prose-captions': 'var(--text-tertiary)',
            '--tw-prose-code': 'var(--text-primary)',
            '--tw-prose-pre-code': 'var(--text-primary)',
            '--tw-prose-pre-bg': 'var(--bg-inset)',
            '--tw-prose-th-borders': 'var(--border-strong)',
            '--tw-prose-td-borders': 'var(--border-subtle)',
          },
        },
      },
    },
  },
  plugins: [typography],
}
