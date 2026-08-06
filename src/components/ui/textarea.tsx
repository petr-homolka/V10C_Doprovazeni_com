import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * VÍCEŘÁDKOVÉ POLE — jedna definice pro celou platformu.
 *
 * Do 2026-07-25 tahle komponenta NEEXISTOVALA: každý zápis, poznámka, IPPD
 * i chat měly vlastní `<textarea>` s ručně opsaným řetězcem tříd
 * (`bg-field`, tónované, bez rámu). Bylo jich šestnáct a lišily se
 * velikostí textu i chováním při tažení — takže „změň vzhled polí"
 * znamenalo projít šestnáct souborů a na jeden zapomenout. Přesně to,
 * čemu Petrovo zadání („třídy stylů musí být napříč celou platformou
 * stejné") brání.
 *
 * Vzhled je záměrně TENTÝŽ jako u `Input`: vlasový rám `--border-default`,
 * bílé pozadí, radius 8. Tónované pole v bílé kartě zmizí, orámované ne.
 */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full resize-y rounded-md bg-field px-3 py-2 shadow-border',
      'text-sm leading-relaxed text-text-primary placeholder:text-text-faint',
      'transition-shadow duration-150',
      'focus:outline-none focus:shadow-focus',
      'disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
