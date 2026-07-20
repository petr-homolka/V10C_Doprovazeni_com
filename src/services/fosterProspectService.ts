import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { FosterProspectDoc, FosterProspectNoteDoc, FosterProspectStatus } from '@/types/fosterProspect'

/** Barrel service — M7 §B.7. Obyčejné Firestore ID (ne UID systém), pipeline
 * PŘED vznikem Dohody. */

function prospectsCollection() {
  return collection(db, 'fosterProspects')
}
function notesCollection(prospectId: string) {
  return collection(db, 'fosterProspects', prospectId, 'notes')
}

export async function createFosterProspect(
  data: Omit<FosterProspectDoc, 'createdAt' | 'status'>,
): Promise<string> {
  const ref = doc(prospectsCollection())
  await setDoc(ref, { ...data, status: 'v_jednani', createdAt: new Date().toISOString() } satisfies FosterProspectDoc)
  return ref.id
}

export async function listFosterProspects(organizationId: string): Promise<Array<{ docId: string; prospect: FosterProspectDoc }>> {
  const snap = await getDocs(
    query(prospectsCollection(), where('organizationId', '==', organizationId), orderBy('createdAt', 'desc')),
  )
  return snap.docs.map((d) => ({ docId: d.id, prospect: d.data() as FosterProspectDoc }))
}

export async function updateFosterProspectStatus(
  prospectId: string,
  status: FosterProspectStatus,
  resultingFamilyRef?: string,
): Promise<void> {
  await updateDoc(doc(prospectsCollection(), prospectId), {
    status,
    ...(resultingFamilyRef ? { resultingFamilyRef } : {}),
  })
}

export async function addFosterProspectNote(prospectId: string, authorUid: string, text: string): Promise<void> {
  const now = new Date().toISOString()
  await setDoc(doc(notesCollection(prospectId)), { authorUid, text, createdAt: now } satisfies FosterProspectNoteDoc)
  await updateDoc(doc(prospectsCollection(), prospectId), { lastContactAt: now })
}

export async function listFosterProspectNotes(prospectId: string): Promise<Array<{ docId: string; note: FosterProspectNoteDoc }>> {
  const snap = await getDocs(query(notesCollection(prospectId), orderBy('createdAt', 'desc')))
  return snap.docs.map((d) => ({ docId: d.id, note: d.data() as FosterProspectNoteDoc }))
}

/** §B.8 dashboard hlídání — bez kontaktu 60+ dní a ne v koncovém stavu →
 * kandidát na `status='uspany'` (nastavuje staff ručně, tenhle helper jen navrhuje). */
export function suggestDormantProspects(
  prospects: Array<{ docId: string; prospect: FosterProspectDoc }>,
  thresholdDays = 60,
  today: Date = new Date(),
): Array<{ docId: string; prospect: FosterProspectDoc }> {
  const activeStatuses: FosterProspectStatus[] = ['v_jednani']
  return prospects.filter(({ prospect }) => {
    if (!activeStatuses.includes(prospect.status)) return false
    const lastContact = prospect.lastContactAt ?? prospect.createdAt
    const daysSince = (today.getTime() - new Date(lastContact).getTime()) / (24 * 60 * 60 * 1000)
    return daysSince >= thresholdDays
  })
}

export async function getFosterProspect(prospectId: string): Promise<FosterProspectDoc | null> {
  const snap = await getDoc(doc(prospectsCollection(), prospectId))
  return snap.exists() ? (snap.data() as FosterProspectDoc) : null
}
