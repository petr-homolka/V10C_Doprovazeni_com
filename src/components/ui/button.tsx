import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Cesta B (2026-07-24) — Lumo-inspired: primární tlačítko je SKUTEČNÁ
 * sytá modrá (`--primary` == Lumo Primary), ne monochrom jako Cesta A.
 * Crisp radius (`rounded-sm` teď 6px, viz index.css), `font-semibold`
 * (o stupeň těžší než Cesty A `font-medium` — Lumo tlačítka jsou
 * vizuálně "hutnější"), a skutečný focus RING (`shadow-focus`
 * box-shadow glow) místo Cesty A `ring-primary/40` (na monochromní
 * appce ring splýval s tlačítkem samotným — na modré appce potřebuje
 * vlastní odstín, aby byl viditelný i na modrém pozadí primary tlačítka).
 * Výška o krok nižší (h-9/h-8 místo h-10/h-9) — hustší, "nástrojová"
 * škála namísto Cesty A dotykově velkorysé (mobilní BottomSheet
 * formuláře si výšku přebíjejí vlastním `className`, viz volající kód).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-sm text-[14px] font-semibold ' +
    'transition-[background-color,box-shadow] duration-150 focus-visible:outline-none ' +
    'focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary:
          'bg-primary-soft text-primary hover:bg-primary-soft-hover',
        outline: 'border border-border-strong text-text-primary hover:bg-overlay-active',
        ghost: 'text-text-secondary hover:bg-overlay-active',
        destructive: 'bg-danger-solid text-white hover:opacity-90',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-3 text-[13px]',
        icon: 'h-9 w-9',
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
