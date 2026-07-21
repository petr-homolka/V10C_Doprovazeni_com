import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * UX zpětná vazba 2026-07-20 — nativní `<select>` bez vlastního stylu
 * měl ošklivou prohlížečovou šipku (nekonzistentní napříč appkou).
 * `appearance-none` skryje nativní šipku, vlastní `ChevronDown` ikona se
 * překrývá přes ni — zbytek chování (klávesnice, screen reader) zůstává
 * plně nativní, žádný vlastní listbox od nuly.
 */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-11 w-full appearance-none rounded-sm border border-border-medium bg-inset px-3.5 pr-9 text-[16px]',
          'text-text-primary focus:border-2 focus:border-accent focus:outline-none disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
      />
    </div>
  ),
)
Select.displayName = 'Select'
