import { Badge, type SubjectKind } from '@/components/ui/badge'

/**
 * DESIGN_SYSTEM.md §14 — referenční mikro-příklad karty rodiny v seznamu.
 *
 * `visitStatus` (§A3 bod 5, rozšířeno DOPLNENI_ZADANI-DO-M5 §3) — `'crisis'`:
 * Dohoda už přesáhla svou VLASTNÍ zákonnou lhůtu na návštěvu
 * (`agreement.visitIntervalDays`). `'warning'`: nový mezistupeň, 45 dní
 * od poslední návštěvy (plochý práh, nezávislý na `visitIntervalDays`) —
 * předstih PŘED "Krize", ne náhrada za ni. `'waiting'`/`undefined` =
 * žádný badge (nezměněno). Barva vždy doprovází text (§11 "barevné
 * kódování vždy doprovází text, nikdy jen barva"), nikdy sama.
 *
 * `secondaryWarning` (DOPLNENI_ZADANI-DO-M5 §2) — volitelný druhý řádek
 * pod `lastContactText`, pro upozornění na KONKRÉTNÍHO partnera, jehož
 * `fosterPersons.lastVisitAt` se rozešla od Dohody/druhého partnera
 * (nesdílená návštěva jen jednoho z nich).
 */
export function FamilyCard({
  initials,
  name,
  lastContactText,
  secondaryWarning,
  badgeKind,
  badgeLabel,
  visitStatus,
  onClick,
}: {
  initials: string
  name: string
  lastContactText: string
  secondaryWarning?: string
  badgeKind: SubjectKind
  badgeLabel: string
  visitStatus?: 'warning' | 'crisis'
  onClick?: () => void
}) {
  return (
    <article onClick={onClick} className="sp__row cursor-pointer" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto auto' }}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-medium text-primary">
        {initials}
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-sm text-text-primary">{name}</h3>
        <p className="truncate text-xs text-text-tertiary">{lastContactText}</p>
        {secondaryWarning && <p className="truncate text-xs text-warning">{secondaryWarning}</p>}
      </div>
      {visitStatus === 'crisis' && (
        <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-crisis-bg px-2.5 text-xs font-medium text-crisis">
          Krize
        </span>
      )}
      {visitStatus === 'warning' && (
        <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-warning-bg px-2.5 text-xs font-medium text-warning">
          Blíží se lhůta
        </span>
      )}
      <Badge kind={badgeKind}>{badgeLabel}</Badge>
    </article>
  )
}
