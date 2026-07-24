import { cn } from '@/lib/utils'

/** DESIGN_SYSTEM.md §6.3 — subjektové štítky. Jediné místo, kde se
 * subjektová barva potkává s textem (nikdy na celé karty/hlavičky). */
const SUBJECT_STYLES = {
  foster: 'text-subject-foster bg-subject-foster-bg',
  ospod: 'text-subject-ospod bg-subject-ospod-bg',
  court: 'text-subject-court bg-subject-court-bg',
  bio: 'text-subject-bio bg-subject-bio-bg',
} as const

export type SubjectKind = keyof typeof SUBJECT_STYLES

export function Badge({
  kind,
  children,
  className,
}: {
  kind: SubjectKind
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        SUBJECT_STYLES[kind],
        className,
      )}
    >
      {children}
    </span>
  )
}
