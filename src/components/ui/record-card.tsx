import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * RecordCard — seznamový řádek jako samostatná bílá zaoblená karta
 * (avatar/ikona vlevo, jméno+podtext uprostřed, volitelná metadata/akce
 * vpravo), místo `<Table>`/`<TableRow>` řádků se sloupci.
 *
 * `leading` = avatar/ikona/checkbox shluk vlevo (fixní šířka, viz
 * volající kód pro přesné složení). `meta` = pravá strana (badge/datum/
 * počty). `trailing` = akce, co se objeví až při hoveru (mikrofon,
 * hvězdička…) — volitelné, viditelné jinak jen na mobilu/dotykových
 * zařízeních natrvalo (`group-hover` princip řeší volající).
 */
export function RecordCard({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  onClick,
  highlight,
  className,
}: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  /** Naléhavý stav (krize) — jemné červené podbarvení celé karty. */
  highlight?: boolean
  className?: string
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3.5 rounded-lg bg-surface-soft p-3.5 shadow-raised transition-shadow duration-150',
        onClick && 'cursor-pointer hover:shadow-md',
        highlight && 'bg-crisis-bg',
        className,
      )}
    >
      {leading && <div className="flex shrink-0 items-center gap-2">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-text-primary">{title}</div>
        {subtitle && <div className="truncate text-xs text-text-secondary">{subtitle}</div>}
      </div>
      {meta && <div className="flex shrink-0 items-center gap-4">{meta}</div>}
      {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
    </div>
  )
}

/** Vertikální stack `RecordCard`ů s jednotnou mezerou — použij místo
 * `<Table>` na seznamové stránce. */
export function RecordCardList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-2.5', className)}>{children}</div>
}

/** Sloupec „malý šedý LABEL nad hodnotou" do `meta` části RecordCardu —
 * Woorkroom reference (Gender/Birthday/Full age/Position…). Na úzkých
 * obrazovkách se skryje (`hideBelow`), ať se řádek nerozsype. */
export function MetaColumn({
  label,
  value,
  width = 'w-28',
  hideBelow = 'md',
}: {
  label: string
  value: ReactNode
  width?: string
  hideBelow?: 'sm' | 'md' | 'lg'
}) {
  const show = hideBelow === 'sm' ? 'hidden sm:block' : hideBelow === 'lg' ? 'hidden lg:block' : 'hidden md:block'
  return (
    <div className={cn(show, width)}>
      <p className="text-[11px] uppercase tracking-wide text-text-tertiary">{label}</p>
      <div className="mt-0.5 truncate text-sm text-text-secondary">{value}</div>
    </div>
  )
}
