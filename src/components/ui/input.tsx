import * as React from 'react'
import { cn } from '@/lib/utils'

/** DESIGN_SYSTEM.md §6.4 — Formuláře. Input text nikdy < 16px (§9.3). */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-sm border border-border-strong bg-surface px-3 text-[16px]',
        'text-text-primary placeholder:text-text-tertiary',
        'focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary-soft',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
