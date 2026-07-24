import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { SubjectDirectory } from '@/lib/eventSubjects'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'

const COLLECTION_BY_KIND = {
  family: 'families',
  fosterPerson: 'fosterPersons',
  child: 'children',
} as const

type DirectoryKind = keyof typeof COLLECTION_BY_KIND

function isDirectoryKind(kind: string): kind is DirectoryKind {
  return kind === 'family' || kind === 'fosterPerson' || kind === 'child'
}

/**
 * Jména + fotky POUZE těch entit, na které se odkazují dané záznamy —
 * na rozdíl od `buildSubjectDirectory`, který si bere už načtené celé
 * seznamy organizace.
 *
 * Používá profilová agenda (`EntityAgenda`): tam jde o pár desítek událostí
 * a jednotky různých entit, takže načíst kvůli avatarům všechny rodiny,
 * pěstouny a děti organizace by byl řádový přeplatek. Velký kalendář
 * (`CalendarPage`) naopak ty seznamy potřebuje na filtry i našeptávače, tak
 * si tam adresář staví z nich.
 *
 * Neexistující/nepřístupné dokumenty se tiše přeskočí (vazba na smazanou
 * entitu nesmí shodit celou agendu) — chybějící záznam se pak vykreslí bez
 * avataru, ne jako chyba.
 */
export async function loadSubjectDirectory(
  refs: Array<{ kind: string; id: string }>,
): Promise<SubjectDirectory> {
  const wanted = new Map<string, DirectoryKind>()
  for (const ref of refs) {
    if (!ref?.id || !isDirectoryKind(ref.kind)) continue
    wanted.set(`${ref.kind}:${ref.id}`, ref.kind)
  }

  const directory: SubjectDirectory = { family: new Map(), fosterPerson: new Map(), child: new Map() }

  await Promise.all(
    [...wanted.entries()].map(async ([key, kind]) => {
      const id = key.slice(kind.length + 1)
      try {
        const snap = await getDoc(doc(db, COLLECTION_BY_KIND[kind], id))
        if (!snap.exists()) return
        if (kind === 'family') {
          const family = snap.data() as FamilyDoc
          directory.family.set(id, { label: resolveFamilyDisplayName(family, null), avatarUrl: family.avatarUrl })
        } else if (kind === 'fosterPerson') {
          const f = snap.data() as FosterPersonDoc
          directory.fosterPerson.set(id, { label: `${f.firstName} ${f.lastName}`, avatarUrl: f.avatarUrl })
        } else {
          const c = snap.data() as ChildDoc
          directory.child.set(id, { label: `${c.firstName} ${c.lastName}`, avatarUrl: c.avatarUrl })
        }
      } catch {
        // Nepřístupná entita (pravidla) — agenda ji zobrazí bez avataru.
      }
    }),
  )

  return directory
}
