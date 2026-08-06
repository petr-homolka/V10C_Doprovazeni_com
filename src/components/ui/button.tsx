import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Loader2 } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

/**
 * TLAČÍTKO — JEDINÁ definice tlačítka v celé platformě.
 *
 * Petr 2026-07-25: „třídy stylů musí být napříč celou platformou stejné,
 * abychom pak mohli dělat globální změny." Tohle je to místo: kdo chce
 * změnit výšku, poloměr nebo barvu tlačítek, mění je TADY a změní se všude.
 * Psát si vlastní `className` s `h-9 rounded-md bg-primary…` je porušení
 * pravidla, i když to vypadá stejně — příště se to rozejde.
 *
 * ČTYŘI ÚROVNĚ HLASITOSTI, víc jich appka nemá:
 *   `primary`     — grafitová plocha. JEDNA na obrazovku (to, co po člověku
 *                   ta obrazovka chce).
 *   `secondary`   — vlasový rám. Akce, která se nabízí, ale netlačí.
 *   `ghost`       — jen text. „Zrušit", odkazy do stran, akce v řádku.
 *   `destructive` — červená. Maže se, tak ať je to vidět.
 *
 * Výšky jdou s typografickou stupnicí (základ 15/23 od 2026-07-25):
 * `default` 40 px na obyčejné akce a formuláře, `sm` 36 px do řádků a
 * hlaviček bloků, `icon` čtverec na samotnou ikonu. Nižší už ne — na
 * dotykovém displeji se pod 36 px nedá spolehlivě trefit.
 */
/*
 * CESTA E — Geist. Tři věci se proti cestě D změnily:
 *
 *   1. Písmo tlačítka je 14 px, ne 15. Vercel má tlačítka a popisky
 *      o stupeň menší než běžný text; drží to ovládací prvky vzadu za
 *      obsahem, což je u nástroje správně.
 *   2. Rám sekundárního tlačítka je STÍN, ne `border`. Nezabírá místo
 *      v layoutu, takže se sousedi při hoveru neposunou.
 *   3. Primární plocha se převrací s režimem (černá / bílá) — `--primary`
 *      i `--primary-foreground` se v tmavém režimu prohodí samy.
 */
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium ' +
    'transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none ' +
    'focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary:
          'bg-surface text-text-primary shadow-border hover:bg-overlay-active hover:text-text-primary',
        /** Historické jméno pro `secondary` — ať se nemusí přepisovat volající. */
        outline:
          'bg-surface text-text-primary shadow-border hover:bg-overlay-active hover:text-text-primary',
        ghost: 'text-text-secondary hover:bg-overlay-active hover:text-text-primary',
        destructive: 'bg-danger-solid text-white hover:opacity-90',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Ukládání/odesílání probíhá — spinner místo obsahu, tlačítko zamčené.
   * Použij s `useAsyncSubmit` (src/hooks/useAsyncSubmit.ts), ať "Ukládám…"
   * neproblikne rychleji, než si toho uživatel stihne všimnout. */
  loading?: boolean
  /** Krátký potvrzovací záblesk hned po úspěšném uložení. */
  success?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, success, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading || success}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {loading ? (
          <Loader2 size={16} className="shrink-0 animate-spin" />
        ) : success ? (
          <Check size={16} className="shrink-0" />
        ) : null}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
