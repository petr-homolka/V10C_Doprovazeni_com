import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { UserDoc } from '@/types/user'

export type SearchResultKind = 'family' | 'fosterPerson' | 'child' | 'staff'

export interface SearchResult {
  kind: SearchResultKind
  /** Hodnota do URL profilu: rodina UID, pěstoun/dítě docId, zaměstnanec uid. */
  id: string
  /** U pěstouna/dítěte UID rodiny, pod kterou jejich profil žije. */
  familyUid?: string
  name: string
  /** Ten kontaktní údaj, KTERÝM se výsledek našel — ať je vidět, proč tu je. */
  detail?: string
  avatarUrl?: string | null
}

function norm(value: string): string {
  // Diakritika pryč: "Novotna" musí najít "Novotná" a naopak. Telefon se
  // navíc píše s mezerami i bez nich, proto se u čísel porovnávají jen
  // cifry (viz `digits` níž).
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function digits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Sedí dotaz na tuhle hodnotu? U číselných dotazů se ignoruje formátování. */
function hit(value: string | null | undefined, q: string, qDigits: string): boolean {
  if (!value) return false
  if (norm(value).includes(q)) return true
  return qDigits.length >= 3 && digits(value).includes(qDigits)
}

/**
 * Hledání napříč KONTAKTNÍMI ÚDAJI všech entit — jméno, telefon, e-mail,
 * adresa, rodné číslo (Petrovo zadání pro lupu v kalendáři: "Hledat se bude
 * mezi kontaktními údaji všech entit"). Čistá funkce nad už načtenými
 * seznamy, žádné dotazy do Firestore — kalendář ty seznamy stejně má.
 *
 * Řazení: nejdřív ty, kde dotaz sedí na ZAČÁTEK jména (to člověk hledá
 * nejčastěji), pak zbytek podle abecedy.
 */
export function searchEntities(
  query: string,
  {
    families,
    fosterPersons,
    children,
    staff,
  }: {
    families: Array<{ docId: string; family: FamilyDoc }>
    fosterPersons: Array<{ docId: string; fosterPerson: FosterPersonDoc }>
    children: Array<{ docId: string; child: ChildDoc }>
    staff: UserDoc[]
  },
  limit = 40,
): SearchResult[] {
  const q = norm(query.trim())
  if (!q) return []
  const qDigits = digits(query)

  /** docId rodiny → UID, aby profil pěstouna/dítěte šel složit. */
  const familyUidByDocId = new Map(families.map(({ docId, family }) => [docId, family.uid]))
  const out: SearchResult[] = []

  for (const { family } of families) {
    const name = resolveFamilyDisplayName(family, null)
    if (hit(name, q, qDigits) || hit(family.address, q, qDigits) || hit(family.uid, q, qDigits)) {
      out.push({ kind: 'family', id: family.uid, name, detail: family.address, avatarUrl: family.avatarUrl })
    }
  }

  for (const { docId, fosterPerson: f } of fosterPersons) {
    const name = `${f.firstName} ${f.lastName}`
    const matchedContact = hit(f.phone, q, qDigits) ? f.phone : hit(f.email, q, qDigits) ? f.email : undefined
    if (hit(name, q, qDigits) || matchedContact || hit(f.uid, q, qDigits)) {
      out.push({
        kind: 'fosterPerson',
        id: docId,
        familyUid: familyUidByDocId.get(f.familyId),
        name,
        detail: matchedContact ?? f.phone ?? f.email,
        avatarUrl: f.avatarUrl,
      })
    }
  }

  for (const { docId, child: c } of children) {
    const name = `${c.firstName} ${c.lastName}`
    if (hit(name, q, qDigits) || hit(c.birthNumber, q, qDigits) || hit(c.uid, q, qDigits)) {
      out.push({
        kind: 'child',
        id: docId,
        familyUid: familyUidByDocId.get(c.familyId),
        name,
        detail: c.birthNumber,
        avatarUrl: c.avatarUrl,
      })
    }
  }

  for (const member of staff) {
    if (hit(member.displayName, q, qDigits) || hit(member.email, q, qDigits)) {
      out.push({
        kind: 'staff',
        id: member.uid,
        name: member.displayName,
        detail: member.email,
        avatarUrl: member.avatarUrl,
      })
    }
  }

  return out
    .sort((a, b) => {
      const aStarts = norm(a.name).startsWith(q)
      const bStarts = norm(b.name).startsWith(q)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
      return a.name.localeCompare(b.name, 'cs')
    })
    .slice(0, limit)
}
