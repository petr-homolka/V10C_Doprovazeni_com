import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CalendarEventDoc, CalendarEventKind } from '@/types/calendarEvent'

/**
 * Barrel service (ZADANI §11 bod 3) pro `organizations/{orgId}/
 * calendarEvents` — Kalendář. Na rozdíl od skoro celé appky (append-only,
 * `delete: if false`) tenhle typ SKUTEČNĚ potřebuje update (přetažení na
 * jiný čas/den, přejmenování) — proto obyčejný `updateDoc`, ne
 * append-a-nový-záznam vzor jako `timeline`/`messages`. Mazání pořád
 * zůstává `if false` (viz `firestore.rules`) — "zrušit" nastaví
 * `status:'zruseno'`, nikdy nemaže dokument.
 */

function eventsCollection(organizationId: string) {
  return collection(db, 'organizations', organizationId, 'calendarEvents')
}

export interface CreateCalendarEventInput {
  organizationId: string
  createdByUid: string
  assignedToUid: string
  title: string
  kind: CalendarEventKind
  start: string
  end: string
  familyDocId?: string | null
  familyUid?: string | null
  notes?: string | null
}

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<{ docId: string; event: CalendarEventDoc }> {
  const ref = doc(eventsCollection(input.organizationId))
  const now = new Date().toISOString()
  const data: CalendarEventDoc = {
    organizationId: input.organizationId,
    createdByUid: input.createdByUid,
    assignedToUid: input.assignedToUid,
    title: input.title,
    kind: input.kind,
    status: 'planovano',
    start: input.start,
    end: input.end,
    familyDocId: input.familyDocId ?? null,
    familyUid: input.familyUid ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, data)
  return { docId: ref.id, event: data }
}

export async function listCalendarEvents(
  organizationId: string,
): Promise<Array<{ docId: string; event: CalendarEventDoc }>> {
  const snap = await getDocs(eventsCollection(organizationId))
  return snap.docs.map((d) => ({ docId: d.id, event: d.data() as CalendarEventDoc }))
}

export interface RescheduleCalendarEventInput {
  organizationId: string
  docId: string
  start: string
  end: string
}

/** Drag & drop (přesun i resize) v `CalendarPage.tsx` volá tohle — jen
 * čas se mění, nic jiného. */
export async function rescheduleCalendarEvent(input: RescheduleCalendarEventInput): Promise<void> {
  await updateDoc(doc(eventsCollection(input.organizationId), input.docId), {
    start: input.start,
    end: input.end,
    updatedAt: new Date().toISOString(),
  })
}

export interface UpdateCalendarEventInput {
  organizationId: string
  docId: string
  title: string
  kind: CalendarEventKind
  assignedToUid: string
  start: string
  end: string
  familyDocId?: string | null
  familyUid?: string | null
  notes?: string | null
}

export async function updateCalendarEvent(input: UpdateCalendarEventInput): Promise<void> {
  await updateDoc(doc(eventsCollection(input.organizationId), input.docId), {
    title: input.title,
    kind: input.kind,
    assignedToUid: input.assignedToUid,
    start: input.start,
    end: input.end,
    familyDocId: input.familyDocId ?? null,
    familyUid: input.familyUid ?? null,
    notes: input.notes ?? null,
    updatedAt: new Date().toISOString(),
  })
}

/** "Zrušit" — status, ne mazání (`delete: if false`, viz firestore.rules). */
export async function cancelCalendarEvent(organizationId: string, docId: string): Promise<void> {
  await updateDoc(doc(eventsCollection(organizationId), docId), {
    status: 'zruseno',
    updatedAt: new Date().toISOString(),
  })
}

/** Google Kalendář sync (`lib/googleCalendar.ts`) volá tohle PO úspěšném
 * `upsertGoogleCalendarEvent` — jen denormalizace ID, žádná vlastní
 * validace (rules pravidlo pro `update` je stejné jako u ostatních polí,
 * `googleEventId` v něm není zvlášť zmíněné, protože nepotřebuje být). */
export async function markCalendarEventSynced(
  organizationId: string,
  docId: string,
  googleEventId: string,
): Promise<void> {
  await updateDoc(doc(eventsCollection(organizationId), docId), {
    googleEventId,
    updatedAt: new Date().toISOString(),
  })
}
