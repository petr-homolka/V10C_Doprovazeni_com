import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { buildUid, MAX_SEQUENCE } from './uid'
import { ENTITY_TYPE_CODES, type EntityType } from '@/types/identity'

/**
 * §4.3 pozn. 2: sekvenční číslo (SSSSSS) se přiděluje přes Firestore
 * transakci na counters/{orgId}_{typ} — jinak hrozí kolize při souběžném
 * vytváření dvou entit stejného typu ve stejné organizaci ve stejnou chvíli.
 *
 * `orgId` = Firestore document ID organizace (klíč čítače).
 * `orgCode` = 4místný OOOO segment UID, přidělený organizaci jednorázově
 * při jejím založení (M1) — tenhle modul ho jen skládá do výsledného UID,
 * nepřiděluje ho.
 */
export async function allocateUid(
  orgId: string,
  orgCode: string,
  entityType: EntityType,
): Promise<string> {
  const typeCode = ENTITY_TYPE_CODES[entityType]
  const counterRef = doc(db, 'counters', `${orgId}_${typeCode}`)

  const sequence = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    const current = snap.exists() ? (snap.data().value as number) : 0
    const next = current + 1

    if (next > MAX_SEQUENCE) {
      throw new Error(
        `Vyčerpán rozsah pořadových čísel (${MAX_SEQUENCE}) pro typ ${entityType} v organizaci ${orgId}`,
      )
    }

    tx.set(counterRef, {
      organizationId: orgId,
      entityType,
      value: next,
      updatedAt: serverTimestamp(),
    })

    return next
  })

  return buildUid(entityType, orgCode, sequence)
}
