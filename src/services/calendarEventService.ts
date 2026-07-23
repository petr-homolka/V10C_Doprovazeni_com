import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CalendarEventDoc, CalendarEventKind, EventRecurrence, RecurrenceUnit } from '@/types/calendarEvent'
import type { SubjectRef } from '@/types/timelineEntry'

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
  subjectRefs?: SubjectRef[]
  notes?: string | null
  recurrence?: EventRecurrence | null
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
    subjectRefs: input.subjectRefs ?? [],
    notes: input.notes ?? null,
    recurrence: input.recurrence ?? null,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, data)
  return { docId: ref.id, event: data }
}

const MAX_RECURRING_OCCURRENCES = 104 // ~2 roky týdně — dost pro "jednou za půl roku" i "každý týden"
const MAX_RECURRENCE_HORIZON_DAYS = 730

function addInterval(date: Date, unit: RecurrenceUnit, amount: number): Date {
  const d = new Date(date)
  if (unit === 'day') d.setDate(d.getDate() + amount)
  else if (unit === 'week') d.setDate(d.getDate() + amount * 7)
  else if (unit === 'month') d.setMonth(d.getMonth() + amount)
  else d.setFullYear(d.getFullYear() + amount)
  return d
}

export interface CreateRecurringCalendarEventsInput extends CreateCalendarEventInput {
  recurrenceInterval: number
  recurrenceUnit: RecurrenceUnit
  occurrenceCount: number
}

/**
 * Založí CELOU řadu opakujících se událostí najednou — každý výskyt je
 * SVŮJ VLASTNÍ `CalendarEventDoc` se sdíleným `recurrence.seriesId`, ne
 * jeden "master" dokument (viz `EventRecurrence` komentář v typu proč).
 * `occurrenceCount`/horizont oba omezené (`MAX_RECURRING_OCCURRENCES`/
 * `MAX_RECURRENCE_HORIZON_DAYS`) — appka nemá cron na dogenerovávání
 * (§10), takže dlouho dopředu opakující se událost má tvrdý strop.
 */
export async function createRecurringCalendarEvents(
  input: CreateRecurringCalendarEventsInput,
): Promise<Array<{ docId: string; event: CalendarEventDoc }>> {
  const seriesId = doc(eventsCollection(input.organizationId)).id
  const occurrenceCount = Math.min(Math.max(1, Math.round(input.occurrenceCount)), MAX_RECURRING_OCCURRENCES)
  const startBase = new Date(input.start)
  const endBase = new Date(input.end)

  const results: Array<{ docId: string; event: CalendarEventDoc }> = []
  for (let i = 0; i < occurrenceCount; i++) {
    const occStart = addInterval(startBase, input.recurrenceUnit, input.recurrenceInterval * i)
    if (occStart.getTime() - startBase.getTime() > MAX_RECURRENCE_HORIZON_DAYS * 86_400_000) break
    const occEnd = addInterval(endBase, input.recurrenceUnit, input.recurrenceInterval * i)
    // eslint-disable-next-line no-await-in-loop -- záměrně sekvenční, ať
    // pořadí založení odpovídá pořadí výskytů (ne kritické, ale čitelnější
    // v Firestore Console při ladění).
    const created = await createCalendarEvent({
      ...input,
      start: occStart.toISOString(),
      end: occEnd.toISOString(),
      recurrence: { interval: input.recurrenceInterval, unit: input.recurrenceUnit, seriesId },
    })
    results.push(created)
  }
  return results
}

/** Zruší VŠECHNY dosud neproběhlé výskyty stejné řady (`seriesId`) — dřívější
 * (minulé) výskyty zůstávají beze změny (§5 audit stopa, "zrušeno" ≠
 * mazání). Zrušení JEDNOHO výskytu (`cancelCalendarEvent`) na zbytek řady
 * nesahá vůbec — obě operace jsou nezávislé, `seriesId` je jen slabá
 * vazba pro tohle hromadné zrušení. */
export async function cancelCalendarEventSeries(organizationId: string, seriesId: string, fromIso: string): Promise<void> {
  const snap = await getDocs(query(eventsCollection(organizationId), where('recurrence.seriesId', '==', seriesId)))
  const now = new Date().toISOString()
  await Promise.all(
    snap.docs
      .filter((d) => (d.data() as CalendarEventDoc).start >= fromIso)
      .map((d) => updateDoc(d.ref, { status: 'zruseno', updatedAt: now })),
  )
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
  subjectRefs?: SubjectRef[]
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
    subjectRefs: input.subjectRefs ?? [],
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
