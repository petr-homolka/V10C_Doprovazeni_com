import type { ButtonHTMLAttributes } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Floating Action Button — Cesta D signature prvek (viz SPEC.md
 * "Woorkroom" reference): kruhové modré tlačítko fixované vpravo dole
 * nad obsahem. Doplněk k existujícímu "Nový/Nová…" tlačítku v hlavičce,
 * hlavně pro mobilní/dotykový kontext.
 */
export function Fab({
  className,
  icon: Icon = Plus,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: typeof Plus }) {
  return (
    <button
      type="button"
      className={cn(
        'fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full',
        'bg-primary text-primary-foreground shadow-md transition-transform duration-150',
        'hover:bg-primary-hover active:scale-95',
        className,
      )}
      {...props}
    >
      <Icon size={24} strokeWidth={2.25} />
    </button>
  )
}
