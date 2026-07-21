import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * DESIGN_SYSTEM.md §6.4 — Formuláře. Input text nikdy < 16px (§9.3) — toto
 * je záměrná odchylka od referenčního designu (jejich Name input měří
 * 14px), protože §9.3 je tvrdý požadavek kvůli iOS Safari zoomu na
 * mobilu/PWA, ne estetická volba — jediná záměrná odchylka v celé
 * komponentě. Zbytek přeměřeno přímo 2026-07-19 (getComputedStyle na
 * skutečném Name/Username poli): klidové pozadí --bg-inset (5% bílá
 * overlay v dark, plná bílá v light — teď skutečně tak definované, ne
 * extrapolovaný odhad), border --border-medium (15% alpha — přeměřeno
 * přesně, ne zaokrouhleno na sousední krok), focus = tloušťka 1→2px +
 * barva --accent (jejich #4F69F2 — u nás teď taky, formulářové prvky mají
 * vlastní barevný akcent mimo subjektové tokeny, viz index.css), ŽÁDNÝ
 * ring/glow (na focus se nepoužívá box-shadow, jen border).
 */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-sm border border-border-medium bg-inset px-3 text-[16px]',
        'text-text-primary placeholder:text-text-tertiary',
        'focus:border-2 focus:border-accent focus:outline-none',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
