import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * POLE — jedna definice pro celou platformu.
 *
 * Od 2026-07-25 má pole VLASOVÝ RÁM. Předtím bylo jen tónované (Lumo styl,
 * bez obrysu) — což fungovalo na šedé ploše, ale jakmile se obsah přesunul
 * do BÍLÝCH KARET, tónované pole z karty zmizelo: hledání na seznamu
 * pěstounů vypadalo jako nadpis s lupou, ne jako pole, do kterého se píše.
 * Rám je tentýž `--border-default` jako u karet a řádků, takže appka drží
 * jeden slovník linek.
 *
 * Výška 40 px jde s typografickou stupnicí (základ 15/23) a s tlačítky —
 * pole a tlačítko vedle sebe musí mít stejnou výšku, jinak se řádek láme.
 */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-md border border-border-default bg-surface px-3 text-base',
        'text-text-primary placeholder:text-text-faint transition-[border-color,box-shadow] duration-150',
        'hover:border-border-strong focus:border-border-strong focus:outline-none focus:shadow-focus',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
