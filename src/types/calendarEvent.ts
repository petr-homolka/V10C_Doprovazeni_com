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
/**
 * Cesta B (2026-07-23) — "Typ události" už NENÍ uzavřený výčet (Petrovo
 * zadání: "číselníky nesmí mít konečný počet variant"). `kind` je teď
 * libovolný string — `schuzka`/`supervize`/`jine` zůstávají zabudované
 * výchozí, ale organizace si může přes `enumOptionsService.ts`
 * (`organizations/{orgId}/enumOptions/calendarEventKind`) přidat vlastní.
 * Žádná byznys logika na konkrétní hodnotě `kind` nezávisí (jen se ukládá/
 * zobrazuje), takže rozšíření je bezpečné.
 */
export type CalendarEventKind = string
export type CalendarEventStatus = 'planovano' | 'zruseno'

export const CALENDAR_EVENT_KIND_LABELS: Record<string, string> = {
  schuzka: 'Schůzka',
  supervize: 'Supervize',
  jine: 'Jiné',
}

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'

export const RECURRENCE_UNIT_LABELS: Record<RecurrenceUnit, { singular: string; few: string; many: string }> = {
  day: { singular: 'den', few: 'dny', many: 'dní' },
  week: { singular: 'týden', few: 'týdny', many: 'týdnů' },
  month: { singular: 'měsíc', few: 'měsíce', many: 'měsíců' },
  year: { singular: 'rok', few: 'roky', many: 'let' },
}

/**
 * Opakování (2026-07-23, Petrovo zadání "každé dva měsíce/týden/půl
 * roku... nebo jinak") — STEJNÝ princip jako `scheduledActivity.ts`/
 * `assistedContactSeries.ts`: žádné on-the-fly RRULE expandování, každý
 * výskyt je SVŮJ VLASTNÍ `CalendarEventDoc` (materializovaný najednou při
 * založení, ne generovaný za běhu) — `seriesId` je jen slabá vazba pro
 * "zrušit celou řadu", editace/zrušení JEDNOHO výskytu nijak neovlivní
 * ostatní. Materializace je OMEZENÁ (`createRecurringCalendarEvents`,
 * `calendarEventService.ts` — max ~104 výskytů/2 roky dopředu), appka
 * nemá Cloud Functions/cron na průběžné dogenerovávání (§10) — SEAM,
 * dlouhodobě opakující se událost (např. týdně na 5+ let) bude nutné
 * jednou obnovit ručně.
 */
export interface EventRecurrence {
  interval: number
  unit: RecurrenceUnit
  seriesId: string
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
  /**
   * Vazba na VÍC entit najednou (2026-07-23, Petrovo zadání) — stejný
   * `SubjectRef` pattern jako `timelineEntry.ts`. `familyDocId`/`familyUid`
   * VÝŠ zůstávají (zpětná kompatibilita s `calendarAggregation.ts`
   * deep-linkem a Google Kalendář sync popisem) — vždy odvozené od PRVNÍ
   * `family` položky tady, ne nezávislé pole. Nová entita bez rodiny
   * (jen dítě/pěstoun) je validní stav — `familyDocId`/`familyUid` pak
   * zůstanou `null`.
   */
  subjectRefs?: import('./timelineEntry').SubjectRef[]
  /**
   * Denormalizace `subjectRefs` (+ `familyDocId`) do plochého polí klíčů
   * `"kind:id"` — VÝHRADNĚ proto, aby šel Firestore dotaz zúžit
   * (`array-contains`). Firestore neumí filtrovat podle pole uvnitř polí
   * objektů, takže kalendář entity by jinak musel načíst VŠECHNY události
   * organizace a filtrovat je v prohlížeči (což do 2026-07-24 dělal).
   *
   * Zdroj pravdy zůstává `subjectRefs`/`familyDocId` — tohle pole se z nich
   * VŽDY dopočítává (`buildSubjectKeys`) při zápisu, nikdy se needituje
   * samostatně. Starší události ho nemají; dopočítá je
   * `scripts/backfill-subject-keys.mjs`.
   */
  subjectKeys?: string[]
  notes?: string | null
  recurrence?: EventRecurrence | null
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
