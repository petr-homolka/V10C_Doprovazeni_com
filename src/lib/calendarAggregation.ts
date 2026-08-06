import { computeVisitAlertTier, daysSince, type AlertTier } from './familyAlertStatus'
import type { CalendarEventDoc } from '@/types/calendarEvent'
import type { AgreementDoc } from '@/types/agreement'

/**
 * Kalendář agreguje ze DVOU zdrojů zatím (vědomě zúžený rozsah pro první
 * verzi, ne nedopatření):
 *
 * 1. `calendarEvents` — VLASTNÍ, plně editovatelná/přetažitelná staff
 *    událost (schůzka, supervize, …), viz `calendarEventService.ts`.
 * 2. Aktivní Dohody — "další návštěva je splatná" READ-ONLY připomínka,
 *    spočtená ze STEJNÉ logiky jako štítek na seznamu Rodin
 *    (`familyAlertStatus.ts`), ne duplikovaná.
 *
 * VĚDOMĚ VYNECHÁNO (SEAM pro budoucí rozšíření, ne zapomenuté):
 * `scheduledActivities`/`assistedContactSeries` occurrences a respit
 * (`children/{id}/…`, `families/{id}/…`) nemají `organizationId` na
 * samotném výskytu (jen na rodičovském dokumentu) — agregace napříč
 * CELOU organizací by buď vyžadovala N+1 dotazy (rodina→dítě→aktivita→
 * výskyt pro každou rodinu zvlášť), nebo denormalizaci `organizationId`
 * na existující, už otestované kolekce (schema změna se skutečným
 * rizikem regrese). Obojí je mimo rozsah týhle dávky — zůstávají
 * dostupné na profilu dítěte/rodiny jako dosud, jen se nezobrazují tady.
 *
 * Jen `calendarEvents` jsou PŘETAŽITELNÉ (`draggable: true`) — agreement
 * připomínky jsou odvozené z jiných dat (Dohoda), přetažení by nemělo co
 * reálně zapsat zpět.
 */
export type CalendarItemSource = 'calendarEvent' | 'agreementVisit'

export interface CalendarItem {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  source: CalendarItemSource
  staffUid: string | null
  draggable: boolean
  tier?: AlertTier
  deepLink?: string
  docId?: string
  event?: CalendarEventDoc
  /** Rodina, které se záznam týká — i u připomínek z Dohody, které žádný
   * `event` nemají. Slouží k vykreslení avataru (`lib/eventSubjects.ts`). */
  familyDocId?: string
}

/** Vrací `null` u neplatného `start`/`end` — stejný důvod jako
 * `agreementToNextVisitItem` níž (jeden špatný záznam nesmí shodit celý
 * kalendář). */
export function calendarEventToItem(docId: string, event: CalendarEventDoc): CalendarItem | null {
  const start = new Date(event.start)
  const end = new Date(event.end)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return {
    id: `ce-${docId}`,
    title: event.title,
    start,
    end,
    allDay: false,
    source: 'calendarEvent',
    staffUid: event.assignedToUid,
    draggable: true,
    docId,
    event,
    familyDocId: event.familyDocId ?? undefined,
    deepLink: event.familyUid ? `/rodiny/${event.familyUid}` : undefined,
  }
}

/** `lastVisitAt` chybí u nové Dohody → počítá se od `validFrom` (Dohoda
 * samotná je "start hodin"), přesně stejný předpoklad jako
 * `dashboardService.ts`/seznam Rodin.
 *
 * Vrací `null`, pokud je `anchor`/`visitIntervalDays` neplatné/chybí —
 * `react-big-calendar` s `Invalid Date` v `start`/`end` uvnitř layoutu
 * SPADNE (živě odhaleno 2026-07-22 po nasazení: reálná produkční data
 * mají historicky vzniklé nekonzistence, které čisté testovací fixtury
 * nikdy nenapodobily) — jeden špatný záznam nesmí shodit CELÝ kalendář,
 * `CalendarPage.tsx` tenhle výsledek filtruje pryč (`.filter(Boolean)`). */
export function agreementToNextVisitItem(
  familyId: string,
  familyUid: string,
  familyLabel: string,
  agreement: AgreementDoc,
  now: number,
): CalendarItem | null {
  const anchor = agreement.lastVisitAt ?? agreement.validFrom
  const anchorMs = anchor ? Date.parse(anchor) : NaN
  if (Number.isNaN(anchorMs) || !Number.isFinite(agreement.visitIntervalDays)) return null
  const dueAt = new Date(anchorMs + agreement.visitIntervalDays * 24 * 60 * 60 * 1000)
  const tier = computeVisitAlertTier(daysSince(anchor, now), agreement.visitIntervalDays)
  return {
    id: `av-${familyId}`,
    title: `Návštěva splatná — ${familyLabel}`,
    start: dueAt,
    end: dueAt,
    allDay: true,
    source: 'agreementVisit',
    staffUid: agreement.assignedTo ?? null,
    draggable: false,
    tier,
    familyDocId: familyId,
    deepLink: `/rodiny/${familyUid}`,
  }
}
