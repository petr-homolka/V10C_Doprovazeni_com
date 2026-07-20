import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { FamilyDoc } from '@/types/family'
import type { ChildDoc } from '@/types/child'
import type { TimelineEntryDoc } from '@/types/timelineEntry'

/**
 * Barrel service (ZADANI §11 bod 3) pro pěstounovu appku `/moje` — M4.
 * Všechny tři dotazy jsou scoped na `userDoc().fosterFamilyId`
 * (`users/{uid}` profil, ne organizace) — `firestore.rules` `isFoster()`
 * disjunkty na `families`/`children`/`timeline` na tohle přímo navazují.
 *
 * `listFosterVisibleTimelineEntries` MUSÍ zrcadlit přesně tytéž dvě
 * podmínky, které čte `timeline` read pravidlo pro pěstouna
 * (`sharingLevel == 'foster'` + `subjectRefs array-contains {kind:family,
 * id:familyId}`) — jinak Firestore zamítne CELÝ list dotaz (§5 "List
 * dotaz vs. pole v pravidle", živě ověřeno na vlastní kůži hodinu před M4,
 * viz firestore.rules komentář). Vyžaduje složený index (`sharingLevel` +
 * `subjectRefs` array-contains + `occurredAt`), viz firestore.indexes.json.
 */

export async function getFosterFamily(familyDocId: string): Promise<FamilyDoc | null> {
  const snap = await getDoc(doc(db, 'families', familyDocId))
  return snap.exists() ? (snap.data() as FamilyDoc) : null
}

export async function listFosterChildren(familyDocId: string): Promise<Array<{ docId: string; child: ChildDoc }>> {
  const q = query(collection(db, 'children'), where('familyId', '==', familyDocId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ docId: d.id, child: d.data() as ChildDoc }))
}

export async function listFosterVisibleTimelineEntries(
  familyDocId: string,
): Promise<Array<{ docId: string; entry: TimelineEntryDoc }>> {
  const q = query(
    collection(db, 'families', familyDocId, 'timeline'),
    where('sharingLevel', '==', 'foster'),
    where('subjectRefs', 'array-contains', { kind: 'family', id: familyDocId }),
    orderBy('occurredAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ docId: d.id, entry: d.data() as TimelineEntryDoc }))
}
