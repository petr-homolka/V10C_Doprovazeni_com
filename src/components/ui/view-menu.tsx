import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Check, Settings } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

/**
 * „ZOBRAZENÍ" — tlačítko, které otevře panel s volbami seskupení a řazení.
 *
 * Takhle to řeší Routine i Notion: nad tabulkou nejsou rozseté přepínače,
 * je tam JEDNO tlačítko (u nich „Layout / Type / Group / Filter") a volby
 * se rozbalí. Do 2026-07-25 měl seznam rodin dvě řady tmavých pilulek
 * („SESKUPIT: Stav | Klíčová osoba | Bez seskupení" a „ŘADIT: Adresa |
 * Poslední kontakt | Poslední návštěva"), tedy šest tlačítek trvale na
 * obrazovce, z nichž se dvě někdy použijí.
 *
 * Proč je panel lepší než pilulky, i když je o klik dál:
 *   - trvale je vidět jen VÝSLEDEK volby („Stav · Adresa"), což je to, co
 *     člověk potřebuje vědět. Ne všechny možnosti, které nezvolil.
 *   - přidat třetí osu (filtr) neznamená přidat další řadu na obrazovku.
 *   - vybraná volba se pozná FAJFKOU, ne tmavou plochou — a tmavá plocha
 *     zůstává vyhrazená primárnímu tlačítku, kde má být.
 */
/**
 * Volby jsou schválně `string`, ne generický typ: panel drží několik skupin
 * s RŮZNÝMI typy hodnot (seskupení vs. řazení) a generika by si na jednom
 * poli vynutila jeden společný typ. Přetypování je na straně volajícího,
 * kde se ví, o kterou skupinu jde.
 */
export interface ViewMenuGroup {
  /** Nadpis skupiny voleb („Seskupit", „Řadit"). */
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
}

export function ViewMenu({ groups }: { groups: ViewMenuGroup[] }): ReactElement {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  /* Souhrn na tlačítku: co je právě vybrané. Bez něj by tlačítko říkalo
     „Zobrazení" a člověk by musel otevřít panel, aby zjistil, co vidí. */
  const summary = groups
    .map((group) => group.options.find((o) => o.value === group.value)?.label)
    .filter(Boolean)
    .join(' · ')

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex h-8 items-center gap-2 rounded-md shadow-border px-2.5 text-sm transition-colors duration-150',
          open ? 'border-border-strong text-text-primary' : 'text-text-secondary hover:border-border-strong',
        )}
      >
        <Settings size={15} className="shrink-0" />
        <span className="text-text-tertiary">Zobrazení</span>
        {summary && <span className="text-text-primary">{summary}</span>}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-lg bg-surface p-1 shadow-overlay">
          {groups.map((group, index) => (
            <div key={group.label}>
              {index > 0 && <div className="my-1 border-t border-border-subtle" />}
              <p className="px-2 pb-0.5 pt-1.5 text-xs uppercase tracking-wide text-text-faint">{group.label}</p>
              {group.options.map((option) => {
                const selected = option.value === group.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      group.onChange(option.value)
                      setOpen(false)
                    }}
                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-text-primary transition-colors duration-150 hover:bg-overlay-active"
                  >
                    {/* Fajfka drží místo i když není vidět, jinak by text
                        u nevybraných voleb začínal o 20 px vlevo. */}
                    <span className={cn('flex w-4 shrink-0 justify-center', !selected && 'invisible')}>
                      <Check size={14} />
                    </span>
                    {option.label}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
