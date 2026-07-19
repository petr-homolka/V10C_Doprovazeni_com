import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * DESIGN_SYSTEM.md §6.1 — Tlačítka.
 * Max jedno primární tlačítko na obrazovku/kartu (enforced by usage, not code).
 * Žádné gradienty, žádné stíny, transition-colors 150ms.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-[15px] font-medium ' +
    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-3 ' +
    'focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary:
          'bg-surface border border-border-strong text-text-primary hover:bg-surface-soft',
        /* Naměřeno 2026-07-19 (Dodatek 11, "Learn more"/"Delete account"
           tlačítka) — průhledné pozadí + border, na rozdíl od "secondary"
           (plné --bg-surface pozadí). Použij, když tlačítko sedí na
           plovoucí/upsell ploše, kde plné pozadí sekundárního tlačítka
           splývá s okolím. */
        outline: 'border border-border-medium text-text-primary hover:bg-overlay-active',
        ghost: 'text-text-secondary hover:bg-surface-soft',
        destructive: 'bg-danger-solid text-white hover:opacity-90',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3 text-[13px]',
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
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
