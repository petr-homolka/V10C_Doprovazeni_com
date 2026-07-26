import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { buildMatchKeys, matchKeyHash, type MatchKeyKind, type PersonIdentifiers } from '@/lib/personMatch'
import type { PersonIndexDoc } from '@/types/personIndex'
import { recordAudit } from '@/services/auditLogService'
import type { AuditActor } from '@/types/auditLog'
import { actorFields } from '@/services/auditLogService'

/**
 * Hledání osoby podle identifikátoru a udržování otisků.
 *
 * Viz `lib/personMatch.ts` — hledá se podle otisků, ne podle hodnot, takže
 * najít někoho znamená znát jeho údaj předem.
 */

function indexRef(hash: string) {
  return doc(db, 'personIndex', hash)
}

/** Zapíše otisky osoby. Volá se při založení a při úpravě údajů pěstouna. */
export async function indexPerson(uid: string, person: PersonIdentifiers, orgId: string): Promise<number> {
  const keys = await buildMatchKeys(person)
  await Promise.all(
    keys.map(({ kind, hash }) =>
      setDoc(indexRef(hash), {
        uid,
        kind,
        createdAt: new Date().toISOString(),
        createdByOrgId: orgId,
      } satisfies PersonIndexDoc),
    ),
  )
  return keys.length
}

export interface PersonMatch {
  uid: string
  kind: MatchKeyKind
}

/**
 * NAJDI OSOBU PODLE JEDNOHO IDENTIFIKÁTORU.
 *
 * KAŽDÝ DOTAZ SE ZAPISUJE DO AUDITU — a `audit` je proto POVINNÝ parametr,
 * ne volitelný. Je to jediná zábrana proti tomu, aby si někdo rejstříkem
 * projížděl cizí rodná čísla, a i tak je to jen odstrašení, ne prevence
 * (skutečné omezení počtu dotazů jde udělat až na serveru — napsané
 * v hlavičce `personMatch.ts`). Kdyby šel dotaz položit bez auditu,
 * neexistovala by ani ta odstrašení.
 */
export async function findPersonByIdentifier(
  kind: MatchKeyKind,
  parts: string[],
  audit: { actor: AuditActor; organizationId: string },
): Promise<PersonMatch | null> {
  const hash = await matchKeyHash(kind, parts)
  if (!hash) return null

  const snap = await getDoc(indexRef(hash))
  const match = snap.exists() ? (snap.data() as PersonIndexDoc) : null

  await recordAudit({
    organizationId: audit.organizationId,
    action: 'person_lookup',
    ...actorFields(audit.actor),
    // Do auditu se zapisuje DRUH klíče, nikdy hledaná hodnota. Log, ve
    // kterém by byla rodná čísla, by byl sám o sobě tou nejhorší kolekcí
    // v databázi — a přitom je append-only, takže by z něj nešla vymazat.
    detail: `Dotaz na shodu podle: ${kind}. Výsledek: ${match ? 'nalezeno' : 'nenalezeno'}.`,
    ...(match ? { target: { kind: 'other' as const, id: match.uid, label: `UID ${match.uid}` } } : {}),
  })

  return match ? { uid: match.uid, kind: match.kind } : null
}

/** Zkusí všechny identifikátory, které o osobě víme, a vrátí první shodu. */
export async function findPersonByAny(
  person: PersonIdentifiers,
  audit: { actor: AuditActor; organizationId: string },
): Promise<PersonMatch | null> {
  const keys = await buildMatchKeys(person)
  for (const { hash, kind } of keys) {
    const snap = await getDoc(indexRef(hash))
    if (snap.exists()) {
      const found = snap.data() as PersonIndexDoc
      await recordAudit({
        organizationId: audit.organizationId,
        action: 'person_lookup',
        ...actorFields(audit.actor),
        detail: `Dotaz na shodu podle: ${kind}. Výsledek: nalezeno.`,
        target: { kind: 'other', id: found.uid, label: `UID ${found.uid}` },
      })
      return { uid: found.uid, kind }
    }
  }

  await recordAudit({
    organizationId: audit.organizationId,
    action: 'person_lookup',
    ...actorFields(audit.actor),
    detail: `Dotaz na shodu podle ${keys.length} identifikátorů. Výsledek: nenalezeno.`,
  })
  return null
}
