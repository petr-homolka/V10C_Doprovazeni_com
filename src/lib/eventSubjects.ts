import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { AvatarSubject } from '@/components/calendar/EventAvatarStack'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { CalendarEventDoc } from '@/types/calendarEvent'

/** docId → jméno + fotka, zvlášť pro každý druh subjektu. */
export interface SubjectDirectory {
  family: Map<string, { label: string; avatarUrl?: string | null }>
  fosterPerson: Map<string, { label: string; avatarUrl?: string | null }>
  child: Map<string, { label: string; avatarUrl?: string | null }>
}

export function buildSubjectDirectory({
  families,
  fosterPersons,
  children,
}: {
  families: Array<{ docId: string; family: FamilyDoc }>
  fosterPersons: Array<{ docId: string; fosterPerson: FosterPersonDoc }>
  children: Array<{ docId: string; child: ChildDoc }>
}): SubjectDirectory {
  return {
    family: new Map(
      families.map(({ docId, family }) => [
        docId,
        { label: resolveFamilyDisplayName(family, null), avatarUrl: family.avatarUrl },
      ]),
    ),
    fosterPerson: new Map(
      fosterPersons.map(({ docId, fosterPerson: f }) => [
        docId,
        { label: `${f.firstName} ${f.lastName}`, avatarUrl: f.avatarUrl },
      ]),
    ),
    child: new Map(
      children.map(({ docId, child: c }) => [docId, { label: `${c.firstName} ${c.lastName}`, avatarUrl: c.avatarUrl }]),
    ),
  }
}

/**
 * Osoby, kterých se záznam v kalendáři týká — pro překrývající se avatary.
 * Sdílené desktopem i mobilem: "VŽDY se zobrazují avatary" platí pro celou
 * platformu, a dvě kopie stejné logiky by se rozešly.
 *
 * Záznamy bez `subjectRefs` (starší události, připomínky návštěv z Dohody,
 * které žádný `event` nemají) spadnou aspoň na rodinu z `familyDocId` —
 * jinak by u nich nebyl avatar žádný.
 */
export function resolveItemSubjects(
  directory: SubjectDirectory,
  item: { event?: CalendarEventDoc | null; familyDocId?: string | null } | null | undefined,
): AvatarSubject[] {
  if (!item) return []
  const refs = item.event?.subjectRefs
  if (refs && refs.length) {
    const out: AvatarSubject[] = []
    for (const ref of refs) {
      if (ref.kind !== 'family' && ref.kind !== 'fosterPerson' && ref.kind !== 'child') continue
      const found = directory[ref.kind].get(ref.id)
      if (found) out.push({ kind: ref.kind, label: found.label, avatarUrl: found.avatarUrl })
    }
    if (out.length) return out
  }
  const familyDocId = item.familyDocId ?? item.event?.familyDocId
  if (familyDocId) {
    const fam = directory.family.get(familyDocId)
    if (fam) return [{ kind: 'family', label: fam.label, avatarUrl: fam.avatarUrl }]
  }
  return []
}
