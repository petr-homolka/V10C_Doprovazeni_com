import { addDoc, collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { MessageDoc } from '@/types/message'
import type { SharingLevel } from '@/types/sharing'

/**
 * Barrel service (ZADANI §11 bod 3) pro `families/{familyId}/messages` —
 * Chat, M9. Na rozdíl od `timelineService.ts` (jen staff zakládá) tenhle
 * soubor nese zápis pro OBĚ strany vlákna — `sendStaffMessage` i
 * `sendFosterMessage` — protože chat je jedna sdílená podkolekce, ne dvě
 * oddělené (foster-side čtení nicméně žije v `mojeService.ts`, stejná
 * dělicí čára jako `documents`/`fosterApproveDocument`: čtení pro `/moje`
 * v `mojeService.ts`, zápis kohokoli tady u entity).
 *
 * `listMessages` filtruje `where('createdByOrgId','==',organizationId)`
 * stejně jako `listTimelineEntries` — musí přesně zrcadlit `firestore.rules`
 * `sameOrg(resource.data.createdByOrgId)` podmínku, jinak Firestore zamítne
 * CELÝ list dotaz (§5 "List dotaz vs. pole v pravidle"). Vyžaduje složený
 * index (`createdByOrgId` + `createdAt`), viz firestore.indexes.json.
 */

function messagesCollection(familyDocId: string) {
  return collection(db, 'families', familyDocId, 'messages')
}

export async function listMessages(
  familyDocId: string,
  organizationId: string,
): Promise<Array<{ docId: string; message: MessageDoc }>> {
  const q = query(
    messagesCollection(familyDocId),
    where('createdByOrgId', '==', organizationId),
    orderBy('createdAt', 'asc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ docId: d.id, message: d.data() as MessageDoc }))
}

export interface SendStaffMessageInput {
  familyDocId: string
  organizationId: string
  createdByUid: string
  body: string
  /** Výchozí `'foster'` (skutečná zpráva pěstounovi) — `'internal'` pro
   * poznámku k vláknu, kterou vidí jen tým. */
  audience?: SharingLevel
}

export async function sendStaffMessage(input: SendStaffMessageInput): Promise<void> {
  const data: MessageDoc = {
    createdByOrgId: input.organizationId,
    createdByUid: input.createdByUid,
    authorRole: 'staff',
    audience: input.audience ?? 'foster',
    body: input.body,
    createdAt: new Date().toISOString(),
  }
  await addDoc(messagesCollection(input.familyDocId), data)
}

export interface SendFosterMessageInput {
  familyDocId: string
  organizationId: string
  createdByUid: string
  body: string
}

/** Pěstoun smí zapsat VÝHRADNĚ `audience: 'foster'` (jediná úroveň, kterou
 * sám vidí, viz `firestore.rules` `messages` create podmínka) — proto tu
 * na rozdíl od `sendStaffMessage` není parametr. */
export async function sendFosterMessage(input: SendFosterMessageInput): Promise<void> {
  const data: MessageDoc = {
    createdByOrgId: input.organizationId,
    createdByUid: input.createdByUid,
    authorRole: 'foster',
    audience: 'foster',
    body: input.body,
    createdAt: new Date().toISOString(),
  }
  await addDoc(messagesCollection(input.familyDocId), data)
}
