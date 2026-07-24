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
    <article
      onClick={onClick}
      className="flex cursor-pointer items-center gap-4 rounded-lg bg-surface-soft p-4 shadow-raised transition-shadow duration-150 hover:shadow-md"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-text-primary">{name}</h3>
        <p className="truncate text-sm text-text-secondary">{lastContactText}</p>
        {secondaryWarning && <p className="truncate text-sm text-warning">{secondaryWarning}</p>}
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
