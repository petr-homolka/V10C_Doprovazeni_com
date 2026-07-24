import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { buildSubjectKeys, subjectKey } from '@/lib/eventSubjects'
import type { TaskDoc, TaskStatus } from '@/types/task'
import type { EventRecurrence, RecurrenceUnit } from '@/types/calendarEvent'
import type { SubjectRef } from '@/types/timelineEntry'

/**
 * Barrel service pro `organizations/{orgId}/tasks` — Úkoly. Stejný tvar
 * jako `calendarEventService.ts` (opakování, `seriesId`, `update`
 * povolený místo append-only), viz `types/task.ts` proč je to VLASTNÍ
 * kolekce, ne varianta kalendářní události.
 */

function tasksCollection(organizationId: string) {
  return collection(db, 'organizations', organizationId, 'tasks')
}

export interface CreateTaskInput {
  organizationId: string
  createdByUid: string
  assignedToUid: string
  title: string
  notes?: string | null
  dueDate?: string | null
  subjectRefs?: SubjectRef[]
  recurrence?: EventRecurrence | null
}

export async function createTask(input: CreateTaskInput): Promise<{ docId: string; task: TaskDoc }> {
  const ref = doc(tasksCollection(input.organizationId))
  const now = new Date().toISOString()
  const data: TaskDoc = {
    organizationId: input.organizationId,
    createdByUid: input.createdByUid,
    assignedToUid: input.assignedToUid,
    title: input.title,
    notes: input.notes ?? null,
    dueDate: input.dueDate ?? null,
    status: 'otevreny',
    subjectRefs: input.subjectRefs ?? [],
    subjectKeys: buildSubjectKeys({ subjectRefs: input.subjectRefs }),
    recurrence: input.recurrence ?? null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, data)
  return { docId: ref.id, task: data }
}

// Stejné stropy jako `calendarEventService.ts` — appka nemá cron na
// dogenerovávání řady (§10), viz tam komentář pro plné zdůvodnění.
const MAX_RECURRING_OCCURRENCES = 104
const MAX_RECURRENCE_HORIZON_DAYS = 730

function addInterval(date: Date, unit: RecurrenceUnit, amount: number): Date {
  const d = new Date(date)
  if (unit === 'day') d.setDate(d.getDate() + amount)
  else if (unit === 'week') d.setDate(d.getDate() + amount * 7)
  else if (unit === 'month') d.setMonth(d.getMonth() + amount)
  else d.setFullYear(d.getFullYear() + amount)
  return d
}

export interface CreateRecurringTasksInput extends CreateTaskInput {
  recurrenceInterval: number
  recurrenceUnit: RecurrenceUnit
  occurrenceCount: number
}

/** Založí CELOU řadu opakujících se úkolů najednou — každý výskyt SVŮJ
 * VLASTNÍ `TaskDoc` se sdíleným `recurrence.seriesId`, stejný princip jako
 * `createRecurringCalendarEvents`. Vyžaduje `dueDate` (opakující se úkol
 * bez data by neměl podle čeho posouvat další výskyt). */
export async function createRecurringTasks(
  input: CreateRecurringTasksInput,
): Promise<Array<{ docId: string; task: TaskDoc }>> {
  const seriesId = doc(tasksCollection(input.organizationId)).id
  const occurrenceCount = Math.min(Math.max(1, Math.round(input.occurrenceCount)), MAX_RECURRING_OCCURRENCES)
  const dueBase = new Date(input.dueDate ?? new Date().toISOString())

  const results: Array<{ docId: string; task: TaskDoc }> = []
  for (let i = 0; i < occurrenceCount; i++) {
    const occDue = addInterval(dueBase, input.recurrenceUnit, input.recurrenceInterval * i)
    if (occDue.getTime() - dueBase.getTime() > MAX_RECURRENCE_HORIZON_DAYS * 86_400_000) break
    // eslint-disable-next-line no-await-in-loop -- záměrně sekvenční, stejný důvod jako calendarEventService.ts
    const created = await createTask({
      ...input,
      dueDate: occDue.toISOString().slice(0, 10),
      recurrence: { interval: input.recurrenceInterval, unit: input.recurrenceUnit, seriesId },
    })
    results.push(created)
  }
  return results
}

/** Zruší VŠECHNY dosud nesplněné/nezrušené výskyty stejné řady od
 * `fromDate` dál (řetězcové porovnání funguje, `dueDate` je `YYYY-MM-DD`).
 * Stejný princip jako `cancelCalendarEventSeries`. */
export async function cancelTaskSeries(organizationId: string, seriesId: string, fromDate: string): Promise<void> {
  const snap = await getDocs(query(tasksCollection(organizationId), where('recurrence.seriesId', '==', seriesId)))
  const now = new Date().toISOString()
  await Promise.all(
    snap.docs
      .filter((d) => {
        const task = d.data() as TaskDoc
        return task.status === 'otevreny' && (!task.dueDate || task.dueDate >= fromDate)
      })
      .map((d) => updateDoc(d.ref, { status: 'zruseno', updatedAt: now })),
  )
}

export async function listTasksForOrg(organizationId: string): Promise<Array<{ docId: string; task: TaskDoc }>> {
  const snap = await getDocs(tasksCollection(organizationId))
  return snap.docs.map((d) => ({ docId: d.id, task: d.data() as TaskDoc }))
}

export interface UpdateTaskInput {
  organizationId: string
  docId: string
  title: string
  assignedToUid: string
  notes?: string | null
  dueDate?: string | null
  subjectRefs?: SubjectRef[]
}

export async function updateTask(input: UpdateTaskInput): Promise<void> {
  await updateDoc(doc(tasksCollection(input.organizationId), input.docId), {
    title: input.title,
    assignedToUid: input.assignedToUid,
    notes: input.notes ?? null,
    dueDate: input.dueDate ?? null,
    subjectRefs: input.subjectRefs ?? [],
    // Přepočítat i při úpravě — jinak by úkol zůstal viset v profilu
    // entity, ze které ho někdo odvázal.
    subjectKeys: buildSubjectKeys({ subjectRefs: input.subjectRefs }),
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Úkoly vázané na JEDNU entitu — pro sekci "Úkoly" v jejím profilu.
 * Zúžený dotaz přes denormalizované `subjectKeys` (stejný princip jako
 * `listCalendarEventsForSubject`), bez `orderBy`, ať to nevyžaduje složený
 * index; pár desítek řádků se seřadí v prohlížeči.
 */
export async function listTasksForSubject(
  organizationId: string,
  kind: string,
  id: string,
): Promise<Array<{ docId: string; task: TaskDoc }>> {
  const snap = await getDocs(
    query(tasksCollection(organizationId), where('subjectKeys', 'array-contains', subjectKey(kind, id))),
  )
  return snap.docs.map((d) => ({ docId: d.id, task: d.data() as TaskDoc }))
}

/** Úkoly přiřazené konkrétnímu zaměstnanci — pro jeho profil. */
export async function listTasksForStaff(
  organizationId: string,
  assignedToUid: string,
): Promise<Array<{ docId: string; task: TaskDoc }>> {
  const snap = await getDocs(query(tasksCollection(organizationId), where('assignedToUid', '==', assignedToUid)))
  return snap.docs.map((d) => ({ docId: d.id, task: d.data() as TaskDoc }))
}

export async function setTaskStatus(organizationId: string, docId: string, status: TaskStatus): Promise<void> {
  const now = new Date().toISOString()
  await updateDoc(doc(tasksCollection(organizationId), docId), {
    status,
    completedAt: status === 'hotovo' ? now : null,
    updatedAt: now,
  })
}
