import { Badge, type SubjectKind } from '@/components/ui/badge'

/**
 * DESIGN_SYSTEM.md §14 — referenční mikro-příklad karty rodiny v seznamu.
 *
 * `crisis` (§A3 bod 5 "krize >60") — Dohoda už přesáhla svou VLASTNÍ
 * zákonnou lhůtu na návštěvu (`agreement.visitIntervalDays`), ne jen
 * blíží se jí. Barva `--crisis` vždy doprovází text "Krize" (§11 "barevné
 * kódování vždy doprovází text, nikdy jen barva"), nikdy sama.
 */
export function FamilyCard({
  initials,
  name,
  lastContactText,
  badgeKind,
  badgeLabel,
  crisis,
  onClick,
}: {
  initials: string
  name: string
  lastContactText: string
  badgeKind: SubjectKind
  badgeLabel: string
  crisis?: boolean
  onClick?: () => void
}) {
  return (
    <article
      onClick={onClick}
      className="flex cursor-pointer items-center gap-4 rounded-lg border border-border bg-surface p-5 transition-colors duration-150 hover:bg-surface-soft"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold text-text-primary">{name}</h3>
        <p className="truncate text-[13px] text-text-secondary">{lastContactText}</p>
      </div>
      {crisis && (
        <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-crisis-bg px-2.5 text-xs font-medium text-crisis">
          Krize
        </span>
      )}
      <Badge kind={badgeKind}>{badgeLabel}</Badge>
    </article>
  )
}
