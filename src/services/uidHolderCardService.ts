import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { UidHolderCardDoc } from '@/types/uidHolderCard'
import { actorFields, recordAudit } from '@/services/auditLogService'
import type { AuditActor } from '@/types/auditLog'

/**
 * Ověřovací karta k UID. Viz `types/uidHolderCard.ts` — je to jediná
 * kolekce, kde osobní údaj překračuje hranici organizace, a čtení je
 * proto vždycky auditované.
 */

function cardRef(uid: string) {
  return doc(db, 'uidHolderCard', uid)
}

/**
 * DOTAZ NA UID. Auditní kontext je POVINNÝ parametr, ne volitelný —
 * zeptat se bez stopy nesmí jít. Kdyby byl volitelný, první volající, co
 * ho vynechá, tichounce odstraní jedinou zábranu, kterou tahle kolekce má.
 */
export async function lookupUidHolder(
  uid: string,
  audit: { actor: AuditActor; organizationId: string },
): Promise<UidHolderCardDoc | null> {
  const snap = await getDoc(cardRef(uid))
  const card = snap.exists() ? (snap.data() as UidHolderCardDoc) : null

  await recordAudit({
    organizationId: audit.organizationId,
    action: 'person_lookup',
    ...actorFields(audit.actor),
    detail: `Dotaz na UID ${uid}. Výsledek: ${card ? 'nalezeno' : 'nenalezeno'}.`,
    ...(card ? { target: { kind: 'other' as const, id: uid, label: `UID ${uid}` } } : {}),
  })

  return card
}

/**
 * Založí/aktualizuje kartu. Volá se, když organizace zakládá nebo mění
 * pěstouna.
 *
 * `municipality` se schválně bere zvlášť a ne z celé adresy — kdo sem
 * pošle „Dlouhá 5, Kolín", zveřejní ulici s číslem popisným. Rozdělit to
 * musí volající, protože jen on ví, kde v jeho datech obec je.
 */
export async function upsertUidHolderCard(input: {
  uid: string
  firstName: string
  lastName: string
  municipality: string
  holderOrgId: string | null
}): Promise<void> {
  await setDoc(cardRef(input.uid), {
    uid: input.uid,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    municipality: input.municipality.trim(),
    holderOrgId: input.holderOrgId,
    updatedAt: new Date().toISOString(),
  } satisfies UidHolderCardDoc)
}
