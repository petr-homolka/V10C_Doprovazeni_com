import type { MouseEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Mic, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

function computeInitials(label: string): string {
  return label
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * Avatar Dohody/rodiny/pěstouna/dítěte — nová funkce (vyžádáno uživatelem,
 * M3). Dvě oddělené role, NIKDY na stejné instanci zároveň (jinak by si
 * hover-mikrofon a klik-na-změnu-fotky konkurovaly o stejnou plochu):
 *
 * - `onQuickRecord` (řádek v tabulce, `size="sm"`): najetí myší PŘEKRYJE
 *   celý kruh hezkým červeným tlačítkem s mikrofonem (přesně dle zadání),
 *   klik spustí VoiceRecorderModal s touhle entitou předvybranou jako
 *   subjekt. `quickRecordDisabledReason` (bez Dohody nejde zápis uložit)
 *   zobrazí jen tooltip, klik nic nespustí.
 * - `onChangePhoto` (profil, `size="lg"`): klik na celý avatar otevře
 *   výběr souboru. Zapojeno na profilu rodiny, pěstouna, dítěte i
 *   zaměstnance (přes `EditableAvatar`), a taky přímo v seznamech Dětí/
 *   Pěstounů/Zaměstnanců přes ⋮ menu.
 *
 * `stopPropagation` na obou klicích je nutný — řádky v tabulkách (viz
 * FamilyListPage) bývají celé zabalené v `<Link>`, klik na avatar nesmí
 * navigovat na detail.
 */
export function EntityAvatar({
  photoURL,
  label,
  size = 'sm',
  fallbackIcon: FallbackIcon,
  onQuickRecord,
  quickRecordDisabledReason,
  onChangePhoto,
  ring,
  online,
  className,
}: {
  photoURL?: string | null
  label: string
  size?: 'sm' | 'lg'
  fallbackIcon?: LucideIcon
  onQuickRecord?: () => void
  quickRecordDisabledReason?: string
  onChangePhoto?: () => void
  /** Cesta D: 2px modrý prstenec kolem avataru — "tohle je aktuální
   * uživatel/kontext" konvence z Woorkroom reference. */
  ring?: boolean
  /** Cesta D: zelená tečka vpravo dole — online/přítomnost (Messenger). */
  online?: boolean
  className?: string
}) {
  const dimension = size === 'lg' ? 'size-24' : 'size-8'
  const iconSize = size === 'lg' ? 40 : 16
  const micSize = size === 'lg' ? 32 : 14

  function handleQuickRecordClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (quickRecordDisabledReason) return
    onQuickRecord?.()
  }

  function handleChangePhotoClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onChangePhoto?.()
  }

  return (
    <div className={cn('group relative shrink-0 rounded-full', dimension, className)}>
      <div
        className={cn(
          'flex h-full w-full items-center justify-center overflow-hidden rounded-full border bg-surface-soft text-text-secondary',
          ring ? 'border-2 border-primary' : 'border-border-strong',
          size === 'lg' ? 'text-xl font-semibold' : 'text-[11px] font-semibold',
        )}
      >
        {photoURL ? (
          <img src={photoURL} alt={label} className="h-full w-full object-cover" />
        ) : FallbackIcon ? (
          <FallbackIcon size={iconSize} strokeWidth={1.75} />
        ) : (
          computeInitials(label) || '?'
        )}
      </div>
      {online && (
        <span
          aria-hidden
          className={cn(
            'absolute rounded-full border-2 border-surface-soft bg-online',
            size === 'lg' ? 'bottom-0.5 right-0.5 size-4' : 'bottom-0 right-0 size-2.5',
          )}
        />
      )}

      {onQuickRecord && (
        <button
          type="button"
          onClick={handleQuickRecordClick}
          title={quickRecordDisabledReason ?? `Nahrát hlasový zápis — ${label}`}
          aria-label={`Nahrát hlasový zápis — ${label}`}
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded-full bg-danger-solid text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100',
            quickRecordDisabledReason && 'cursor-not-allowed opacity-0 group-hover:opacity-60',
          )}
        >
          <Mic size={micSize} strokeWidth={2} />
        </button>
      )}

      {onChangePhoto && (
        <button
          type="button"
          onClick={handleChangePhotoClick}
          aria-label="Změnit fotku"
          title="Změnit fotku"
          className="absolute inset-0 flex items-center justify-center rounded-full bg-overlay-active text-text-primary opacity-0 transition-opacity duration-150 hover:opacity-100"
        >
          <Pencil size={iconSize * 0.6} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
