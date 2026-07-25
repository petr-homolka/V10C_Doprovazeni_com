import { cn } from '@/lib/utils'

/**
 * Switch — track 40×20px (`w-10 h-5`), radius-full, thumb 16×16px
 * (`size-4`) s 2px odsazením (`left-0.5 top-0.5`), transition transform
 * 150ms — přeměřeno 2026-07-19 přímo na živém přepínači (skutečné kliknutí
 * + čtení classList/computed style PŘED i PO, ne jen výchozí stav):
 * track OFF = --toggle-off, track ON = --primary — GRAFIT, ne červená.
 * Červená (`--accent`) je v appce vyhrazená jedné věci: „tohle hoří / je po
 * termínu". Zapnutý přepínač v nastavení nehoří, jen je zapnutý; když byl
 * červený, byl na profilu tím nejsilnějším prvkem na obrazovce.
 * Historie: track OFF = --toggle-off, track ON = --accent (dřív jsme tu měli
 * monochromní --primary, teď podle explicitního zadání použito přesně
 * naměřená barva #4F69F2), thumb --toggle-thumb (#FAFAFA, KONSTANTNÍ
 * v obou režimech, potvrzeno měřením v obou — drží se stínem
 * `shadow-raised`, ne kontrastem barvy vůči tracku).
 */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-[background-color,box-shadow] duration-150',
        'focus-visible:outline-none focus-visible:shadow-focus',
        checked ? 'bg-primary' : 'bg-toggle-off',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-toggle-thumb shadow-raised transition-transform duration-150',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
