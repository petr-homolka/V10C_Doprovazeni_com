import type { ReactElement } from 'react'
import { cn } from '@/lib/utils'
import type { IconProps } from '@/components/ui/icons'

/**
 * ZÁLOŽKY — JEDINÝ způsob, jak se v téhle appce přepíná mezi pohledy.
 *
 * Přestavěno 2026-07-25 podle Routine (a tím i Notionu, na kterém stojí):
 * jejich přepínač `Board | List` má ikonu, popisek, a AKTIVNÍ ZÁLOŽKA JE
 * PODTRŽENÁ 2px linkou POD POPISKEM — ne obarvená, ne v pilulce. Pod celou
 * řadou běží vlasová linka, která odděluje záložky od obsahu.
 *
 * Proč je to lepší než pilulka, kterou tu appka měla (`SegmentedTabs`, teď
 * smazaná): tmavá pilulka na vybrané volbě je stejně silný signál jako
 * primární tlačítko, takže „Týden" v kalendáři křičelo přesně tak nahlas
 * jako „Nová událost". Podtržení je nejtišší možný způsob, jak říct „tady
 * jsi" — a právě proto ho Notion i Routine snesou i na desíti místech.
 *
 * PRAVIDLO PRO CELOU APPKU: cokoli, co PŘEPÍNÁ POHLED na tatáž data
 * (Přehled/Časová osa, Měsíc/Týden/Den, Přehled/Historie), je tahle
 * komponenta. Nic jiného na to není. Volby, které obsah MĚNÍ (seskupení,
 * řazení, filtr), do záložek NEPATŘÍ — ty žijí v tlačítku „Zobrazení"
 * (`view-menu.tsx`), stejně jako u nich.
 */
export interface TabItem {
  key: string
  label: string
  /** Ikona před popiskem — jako `Board`/`List` u nich. Nepovinná. */
  icon?: (props: IconProps) => ReactElement
  /** Počet vpravo od popisku (kolik je v záložce položek). */
  count?: number
}

export function Tabs({
  items,
  active,
  onSelect,
  className,
}: {
  items: TabItem[]
  active: string
  onSelect: (key: string) => void
  className?: string
}) {
  return (
    <div role="tablist" className={cn('flex items-center gap-5 border-b border-border-subtle', className)}>
      {items.map((item) => {
        const selected = item.key === active
        const Icon = item.icon
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(item.key)}
            className={cn(
              // `-mb-px` posadí podtržení PŘESNĚ na vlasovou linku pod řadou,
              // takže se nekreslí dvě linky pod sebou.
              '-mb-px flex h-9 shrink-0 items-center gap-1.5 border-b-2 text-base transition-colors duration-150',
              selected
                ? 'border-text-primary font-medium text-text-primary'
                : 'border-transparent text-text-tertiary hover:text-text-primary',
            )}
          >
            {Icon && <Icon size={15} className="shrink-0" />}
            {item.label}
            {item.count !== undefined && (
              <span className={cn('text-xs', selected ? 'text-text-tertiary' : 'text-text-faint')}>{item.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
