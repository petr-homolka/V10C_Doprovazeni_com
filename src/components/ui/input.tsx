import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Cesta B (2026-07-24) — Input text nikdy < 16px (§9.3, iOS Safari zoom
 * pojistka, zachováno beze změny). Focus teď dává SKUTEČNÝ modrý glow
 * (`shadow-focus`, box-shadow) namísto Cesty A tloušťkového skoku
 * 1→2px — border zůstává STÁLE 1px (žádný reflow při focusu, jen barva
 * + glow), Lumo afordance vzor.
 */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-sm border border-border-medium bg-inset px-3 text-[16px]',
        'text-text-primary placeholder:text-text-tertiary transition-shadow duration-150',
        'focus:border-accent focus:outline-none focus:shadow-focus',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
