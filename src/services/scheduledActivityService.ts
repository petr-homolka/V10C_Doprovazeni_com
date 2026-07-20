import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ScheduledActivityDoc, ScheduledActivityOccurrenceDoc } from '@/types/scheduledActivity'

/** Barrel service — původní ZADANI §4.4.B.1. `isRespit` je vždy explicitní
 * volba na vstupu, tenhle soubor ji nikdy needvozuje z `activityType`. */

function activitiesCollection(childId: string) {
  return collection(db, 'children', childId, 'scheduledActivities')
}
function occurrencesCollection(childId: string, activityId: string) {
  return collection(db, 'children', childId, 'scheduledActivities', activityId, 'occurrences')
}

export async function createScheduledActivity(
  childId: string,
  data: Omit<ScheduledActivityDoc, 'createdAt'>,
): Promise<string> {
  const ref = doc(activitiesCollection(childId))
  await setDoc(ref, { ...data, createdAt: new Date().toISOString() } satisfies ScheduledActivityDoc)
  return ref.id
}

export async function listScheduledActivities(
  childId: string,
): Promise<Array<{ docId: string; activity: ScheduledActivityDoc }>> {
  const snap = await getDocs(activitiesCollection(childId))
  return snap.docs.map((d) => ({ docId: d.id, activity: d.data() as ScheduledActivityDoc }))
}

export async function addOccurrence(
  childId: string,
  activityId: string,
  date: string,
  initialStatus: ScheduledActivityOccurrenceDoc['status'],
): Promise<string> {
  const ref = doc(occurrencesCollection(childId, activityId))
  await setDoc(ref, { date, status: initialStatus } satisfies ScheduledActivityOccurrenceDoc)
  return ref.id
}

export async function listOccurrences(
  childId: string,
  activityId: string,
): Promise<Array<{ docId: string; occurrence: ScheduledActivityOccurrenceDoc }>> {
  const snap = await getDocs(query(occurrencesCollection(childId, activityId), orderBy('date', 'desc')))
  return snap.docs.map((d) => ({ docId: d.id, occurrence: d.data() as ScheduledActivityOccurrenceDoc }))
}

export async function confirmOccurrence(
  childId: string,
  activityId: string,
  occurrenceId: string,
  status: 'probehlo' | 'neprobehlo',
  confirmedBy: string,
): Promise<void> {
  await updateDoc(doc(occurrencesCollection(childId, activityId), occurrenceId), {
    status,
    confirmedBy,
    confirmedAt: new Date().toISOString(),
  })
}
