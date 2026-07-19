import { cn } from '@/lib/utils'

/**
 * Switch — track/rozměry přeměřeny 2026-07-19 na Magnific Preferences
 * stránce (Newsletter přepínač): track 40×20px, radius-full, thumb 16×16px
 * s 2px odsazením, transition transform 150ms. **Jen OFF stav byl reálně
 * naměřený** (ON stav u nich blokoval mock backend, agent to poctivě
 * nahlásil, nefabrikoval) — ON stav tady navrhuji podle vlastního principu:
 * track ON = --primary, thumb zůstává --bg-surface + jemný stín (funguje
 * v obou režimech, ne jen naměřená dark-mode #FAFAFA hodnota, která by
 * v light módu splynula s pozadím).
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
        'relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors duration-150',
        checked ? 'bg-primary' : 'bg-overlay-active',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-surface shadow-raised transition-transform duration-150',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
