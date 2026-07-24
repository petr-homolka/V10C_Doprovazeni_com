import type { EventRecurrence } from './calendarEvent'
import type { SubjectRef } from './timelineEntry'

/**
 * organizations/{orgId}/tasks/{id} — Úkoly (2026-07-23, Petrovo zadání bod
 * 3: "nyní máme možnost uložit do kalendáře 'událost' vázanou na čas — jak
 * to bude s Úkoly, které na čas vázané nejsou nebo mají jen deadline v
 * budoucnosti?"). VLASTNÍ kolekce, ne varianta `CalendarEventDoc` —
 * `dueDate` je VOLITELNÉ datum (žádný čas), na rozdíl od události, která
 * VŽDY má `start`/`end`. `/ukoly` nav položka (`Sidebar.tsx`) existovala už
 * dřív jako mrtvý odkaz — tahle kolekce/UI ji poprvé zprovozňuje.
 *
 * Sdílené staff úkoly, STEJNÁ důvěra napříč staff rolemi jako Kalendář —
 * kdokoli ze stejné organizace smí založit/upravit/dokončit ČÍKOLIV úkol.
 * `status` je STAV, ne mazání (§5 audit stopa, `delete: if false`).
 */
export type TaskStatus = 'otevreny' | 'hotovo' | 'zruseno'

export interface TaskDoc {
  organizationId: string
  createdByUid: string
  assignedToUid: string
  title: string
  notes?: string | null
  dueDate?: string | null
  status: TaskStatus
  subjectRefs?: SubjectRef[]
  /**
   * Denormalizace `subjectRefs` do plochých klíčů „kind:id" — stejný důvod
   * i stejný tvar jako u `CalendarEventDoc.subjectKeys` (viz tam), aby šly
   * úkoly jedné entity načíst zúženým dotazem místo stažení všech úkolů
   * organizace. Zdroj pravdy zůstává `subjectRefs`.
   */
  subjectKeys?: string[]
  /** Stejný princip jako `CalendarEventDoc.recurrence` (viz tam komentář
   * pro plné zdůvodnění) — sdílený `EventRecurrence` typ, ne vlastní
   * duplikát. */
  recurrence?: EventRecurrence | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}
