import { collection, doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SubjectRef, TimelineEntryDoc, TimelineEntryKind } from '@/types/timelineEntry'
import type { SharingLevel } from '@/types/sharing'

/**
 * Barrel service (ZADANI §11 bod 3) pro `families/{familyId}/timeline` —
 * M3, jen cesta "avatar + mikrofon → rychlý hlasový zápis" (viz
 * VoiceRecorderModal.tsx). NEZAKLÁDÁ návštěvu (§A3 Giant Timer, GPS,
 * `startedAt`/`endedAt`) — to zůstává samostatný, zatím nepostavený flow.
 *
 * `firestore.rules` vyžaduje AKTIVNÍ Dohodu volající organizace pro tenhle
 * Spis (`hasActiveAgreementFor`) — zápis pro rodinu bez aktivní Dohody
 * spadne na permission-denied, volající (modal) na to musí počítat.
 */
export interface CreateVoiceEntryInput {
  familyDocId: string
  organizationId: string
  createdByUid: string
  subjectRefs: SubjectRef[]
  sharingLevel: SharingLevel
  body: string
}

export async function createVoiceTimelineEntry(input: CreateVoiceEntryInput): Promise<void> {
  const ref = doc(collection(db, 'families', input.familyDocId, 'timeline'))
  const data: TimelineEntryDoc = {
    type: 'voice_entry' satisfies TimelineEntryKind,
    createdByOrgId: input.organizationId,
    createdByUid: input.createdByUid,
    occurredAt: new Date().toISOString(),
    subjectRefs: input.subjectRefs,
    sharingLevel: input.sharingLevel,
    body: input.body,
  }
  await setDoc(ref, data)
}
