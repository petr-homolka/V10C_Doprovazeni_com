import { Badge, type SubjectKind } from '@/components/ui/badge'

/** DESIGN_SYSTEM.md §14 — referenční mikro-příklad karty rodiny v seznamu. */
export function FamilyCard({
  initials,
  name,
  lastContactText,
  badgeKind,
  badgeLabel,
}: {
  initials: string
  name: string
  lastContactText: string
  badgeKind: SubjectKind
  badgeLabel: string
}) {
  return (
    <article className="flex cursor-pointer items-center gap-4 rounded-lg border border-border bg-surface p-5 transition-colors duration-150 hover:bg-surface-soft">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold text-text-primary">{name}</h3>
        <p className="truncate text-[13px] text-text-secondary">{lastContactText}</p>
      </div>
      <Badge kind={badgeKind}>{badgeLabel}</Badge>
    </article>
  )
}
