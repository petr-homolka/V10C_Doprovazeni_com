import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Pravý SCHOVÁVACÍ sidebar (2026-07-23, na přímé přání Petra pro Kalendář:
 * "různá nastavování a napojování... chci skrýt do pravého schovávacího
 * sidebaru, kde by se mohli editovat i Události a Úkoly"). Na rozdíl od
 * `Drawer` (fixed overlay přes celou obrazovku, tlumené pozadí, BLOKUJE
 * zbytek appky) je tenhle primitiv SOUČÁST normálního flex řádku vedle
 * sebe — žádný overlay/backdrop, žádné `position: fixed`. Otevření/zavření
 * jen zmenší/zvětší šířku sousedního obsahu (typicky kalendářová mřížka),
 * zbytek appky zůstává celou dobu interaktivní. Použij uvnitř vlastního
 * `<div className="flex h-full ...">` vedle hlavního obsahu, ne samostatně.
 */
export function SidePanel({
  title,
  actions,
  onClose,
  children,
  className,
}: {
  title: string
  actions?: ReactNode
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full w-[380px] shrink-0 flex-col overflow-hidden border-l border-border-default bg-surface-soft',
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border-default px-4">
        <h2 className="truncate text-[15px] font-semibold text-text-primary">{title}</h2>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít panel"
            title="Zavřít panel"
            className="flex size-8 items-center justify-center rounded-sm text-text-secondary transition-colors duration-150 hover:bg-overlay-active hover:text-text-primary"
          >
            <X size={17} strokeWidth={1.9} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  )
}
