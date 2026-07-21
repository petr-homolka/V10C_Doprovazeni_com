/**
 * organizations/{orgId}/calendarEvents/{id} — Kalendář (2026-07-21, nový
 * milestone nad rámec dosud číslovaných M-fází). Nezávislé na
 * `families/{id}/timeline` (minulé návštěvy) i na plánovaných aktivitách
 * dítěte (`children/{id}/scheduledActivities`) — tohle je VLASTNÍ,
 * ad-hoc staff událost (schůzka, supervize, cokoli, co nepatří pod žádnou
 * existující entitu), plně vlastněná kalendářem, proto jediná, kterou lze
 * přetahovat (drag & drop) mezi časy/dny beze změny cizích subsystémů.
 *
 * Sdílený týmový kalendář — KAŽDÝ staff organizace smí založit/upravit/
 * přesunout ČÍKOLIV událost (ne jen svoji), stejná důvěra napříč staff
 * rolemi jako jinde v appce (`isStaff()`/`sameOrg()`). `assignedToUid`
 * řídí barvu/viditelnost v přepínači "podle zaměstnance", NE kdo smí psát.
 *
 * `status` — "zrušeno" je STAV, ne mazání (§5 "delete: if false" napříč
 * celou appkou, audit stopa). Zrušená událost zmizí z výchozího zobrazení
 * kalendáře, ale zůstává v Firestore.
 */
export type CalendarEventKind = 'schuzka' | 'supervize' | 'jine'
export type CalendarEventStatus = 'planovano' | 'zruseno'

export const CALENDAR_EVENT_KIND_LABELS: Record<CalendarEventKind, string> = {
  schuzka: 'Schůzka',
  supervize: 'Supervize',
  jine: 'Jiné',
}

export interface CalendarEventDoc {
  organizationId: string
  createdByUid: string
  assignedToUid: string
  title: string
  kind: CalendarEventKind
  status: CalendarEventStatus
  start: string
  end: string
  familyDocId?: string | null
  familyUid?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  /**
   * Google Kalendář sync (klientský OAuth tok, `lib/googleCalendar.ts`,
   * §10 — žádná Cloud Function, žádný uložený refresh token, viz tam
   * komentář proč). ID vráceného Google Calendar API `events.insert`
   * volání — přítomnost znamená "už jednou synchronizováno", `PATCH`
   * místo `POST` při dalším přesunu/úpravě, ať se nevytváří duplicitní
   * událost v cizím kalendáři. Synchronizuje VÝHRADNĚ `assignedToUid`
   * sám za sebe (do VLASTNÍHO Google Kalendáře), nikdy cizí událost —
   * sdílený týmový kalendář appky ≠ osobní Google Kalendář zaměstnance.
   */
  googleEventId?: string | null
}
