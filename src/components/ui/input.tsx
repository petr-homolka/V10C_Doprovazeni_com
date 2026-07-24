import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Cesta B, druhý průchod (2026-07-23) — skutečné Lumo `TextField`: VYPLNĚNÉ
 * pole (`bg-surface`, jemný modro-šedý tón), BEZ viditelného obrysu v
 * klidu (border zůstává 1px, jen průhledný — žádný reflow) — na rozdíl od
 * generického "bílé pole s šedým rámečkem", co appka měla předtím (a co
 * má skoro každá appka). Ověřeno na referenčním Date Pickeru/Combo Boxu
 * z .fig souboru — obě pole tam nemají obrys, jen tónované pozadí. Focus
 * = modrý glow (`shadow-focus`) + modrý obrys.
 */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-sm border border-transparent bg-field px-3 text-lg',
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
