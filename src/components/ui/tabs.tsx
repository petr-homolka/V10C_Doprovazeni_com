import { cn } from '@/lib/utils'

/**
 * Cesta B, druhý průchod (2026-07-23) — nahrazuje `ProfileSectionNav`
 * (svislý seznam ve vlastním `secondaryPanel` sloupci, Cesta A vzor).
 * Skutečné Lumo/Vaadin `<vaadin-tabs>`: VODOROVNÝ řádek, spodní 2px
 * podtržení jako indikátor vybrané záložky, žádný obalový panel/pozadí —
 * ten samý vzor, co je vidět v referenčním Lumo screenshotu (First tab/
 * Second tab/Third tab). Detail stránky (rodina/pěstoun/dítě/Dohoda) teď
 * mají JEDEN sloupec obsahu s taby nahoře místo dvou-sloupcového layoutu.
 */
export interface TabItem {
  key: string
  label: string
}

export function Tabs({
  items,
  active,
  onSelect,
}: {
  items: TabItem[]
  active: string
  onSelect: (key: string) => void
}) {
  return (
    <div role="tablist" className="flex items-center gap-6 border-b border-border-default">
      {items.map((item) => {
        const selected = item.key === active
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(item.key)}
            className={cn(
              '-mb-px flex h-10 items-center border-b-2 text-base transition-colors duration-150',
              selected
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent font-medium text-text-secondary hover:border-border-medium hover:text-text-primary',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
