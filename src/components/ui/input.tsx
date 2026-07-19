import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * DESIGN_SYSTEM.md §6.4 — Formuláře. Input text nikdy < 16px (§9.3) — toto
 * je záměrná odchylka od Magnific referenece (jejich Name input měří 14px),
 * protože §9.3 je tvrdý požadavek kvůli iOS Safari zoomu na mobilu/PWA, ne
 * estetická volba. Zbytek (pozadí, border, focus chování) přeměřeno přímo
 * na živé Magnific appce (workflow 2026-07-19): klidové pozadí --bg-inset,
 * border --border-default (jejich 15% alpha je mezi naším 10%/20% krokem,
 * netvoříme kvůli 5 bodům nový token), focus = tloušťka 1→2px + barva
 * --primary (u nich barevná #4F69F2 — u nás zůstává monochromní --primary
 * podle vlastního principu "barva jen na badge"), ŽÁDNÝ ring/glow (Magnific
 * na focus nepoužívá box-shadow ring, jen border).
 */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-sm border border-border bg-inset px-3 text-[16px]',
        'text-text-primary placeholder:text-text-tertiary',
        'focus:border-2 focus:border-primary focus:outline-none',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
