import { cn } from '@/lib/utils'

/**
 * SegmentedTabs — přeměřeno 2026-07-19 na živé referenční appce (výběr
 * klienta na stránce integrací): ŽÁDNÝ obalový "pilulkový" kontejner
 * s vlastním pozadím — jen plochý flex řádek (gap 4px), každá volba je
 * SAMOSTATNĚ plně zaoblené tlačítko. Vybraná = --primary/--primary-
 * foreground; nevybraná = průhledná + --text-primary (STEJNÁ jasnost
 * textu jako vybraná — jen pozadí chybí), stejný font-weight (500) pro obě.
 */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              'flex h-8 items-center rounded-full px-4 text-xs font-medium transition-colors duration-150',
              selected ? 'bg-primary text-primary-foreground' : 'text-text-primary hover:bg-overlay-active',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
