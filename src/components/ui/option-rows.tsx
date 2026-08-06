import { Check } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

/**
 * VÝBĚR JEDNÉ MOŽNOSTI V NASTAVENÍ — řádky s fajfkou.
 *
 * Nastavení není přepínač pohledu, takže do záložek nepatří (viz pravidlo
 * v `tabs.tsx`). Notion i Routine na tohle používají řádky, kde vybraná
 * možnost nese FAJFKU — ne tmavou pilulku, kterou tu appka měla.
 *
 * Rozdíl není kosmetický: pilulka na vybrané možnosti je vizuálně stejně
 * silná jako primární tlačítko, takže „Světlý" v nastavení vypadalo jako
 * akce, kterou má člověk provést. Fajfka říká „takhle to je", ne „klikni".
 */
export function OptionRows<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; hint?: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" className="max-w-[360px]">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className="flex w-full items-center gap-2 border-b border-border-subtle px-2 py-2 text-left transition-colors duration-150 last:border-b-0 hover:bg-overlay-active"
          >
            {/* Fajfka drží místo i když není vidět — jinak by se popisky
                nevybraných možností posunuly o 20 px vlevo. */}
            <span className={cn('flex w-4 shrink-0 justify-center text-text-primary', !selected && 'invisible')}>
              <Check size={14} />
            </span>
            <span className={cn('flex-1 text-sm', selected ? 'text-text-primary' : 'text-text-secondary')}>
              {option.label}
            </span>
            {option.hint && <span className="text-xs text-text-faint">{option.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}
