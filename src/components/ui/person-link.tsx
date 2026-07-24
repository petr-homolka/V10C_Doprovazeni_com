import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export type PersonKind = 'staff' | 'family' | 'fosterPerson' | 'child'

/**
 * Kdekoli se v platformě objeví jméno, je proklikem na profil — VŽDY
 * (Petrovo zadání 2026-07-24). Tahle komponenta je to jediné místo, kde se
 * rozhoduje, kam který druh jména vede; díky tomu se pravidlo nemusí
 * hlídat na stovkách míst zvlášť.
 *
 * Když cesta k profilu neexistuje (chybí `familyUid` u pěstouna/dítěte,
 * jméno neznámého autora zápisu), vykreslí se prostý text — jméno se
 * neztratí a nikde nevznikne odkaz, který vede do prázdna.
 */
export function PersonLink({
  kind,
  id,
  familyUid,
  name,
  className,
  muted,
}: {
  kind: PersonKind
  /** `staff` → uid, `family` → UID rodiny (13místné, ne docId),
   * `fosterPerson`/`child` → docId. Přesně to, co má daná cesta v URL. */
  id: string | null | undefined
  /** Nutné u pěstouna/dítěte — jejich profil žije pod rodinou. */
  familyUid?: string | null
  name: string
  className?: string
  /** Tišší varianta pro sekundární text (autoři zápisů, metadata). */
  muted?: boolean
}) {
  const href = personProfilePath({ kind, id, familyUid })
  if (!href) return <span className={className}>{name}</span>
  return (
    <Link
      to={href}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'hover:underline',
        muted ? 'text-text-secondary hover:text-primary' : 'text-text-primary hover:text-primary',
        className,
      )}
    >
      {name}
    </Link>
  )
}

/** Cesta k profilu, nebo `null`, když ji z dostupných dat složit nejde. */
export function personProfilePath({
  kind,
  id,
  familyUid,
}: {
  kind: PersonKind
  id: string | null | undefined
  familyUid?: string | null
}): string | null {
  if (!id) return null
  switch (kind) {
    case 'staff':
      return `/zamestnanci/${id}`
    case 'family':
      return `/rodiny/${id}`
    case 'fosterPerson':
      return familyUid ? `/rodiny/${familyUid}/pestoun/${id}` : null
    case 'child':
      return familyUid ? `/rodiny/${familyUid}/dite/${id}` : null
  }
}
