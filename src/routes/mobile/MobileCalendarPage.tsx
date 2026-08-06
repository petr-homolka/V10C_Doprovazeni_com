import { useEffect, useMemo, useRef, useState, type FormEvent, type TouchEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Search, Settings, Trash2 } from '@/components/ui/icons'
import { MobileShell } from '@/components/mobile/MobileShell'
import { BottomSheet } from '@/components/mobile/BottomSheet'
import { GroupedList, GroupedListRow } from '@/components/mobile/GroupedList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/textarea'
import { SubjectRefsPicker } from '@/components/calendar/SubjectRefsPicker'
import { EventAvatarStack } from '@/components/calendar/EventAvatarStack'
import { EntitySearch } from '@/components/search/EntitySearch'
import { buildSubjectDirectory, resolveItemSubjects } from '@/lib/eventSubjects'
import { AGREEMENT_VISIT_COLOR, staffColor } from '@/lib/staffColor'
import { formatDateValue, parseDateValue } from '@/lib/dateGrid'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { listStaff, updateNotifyBirthdays, updateNotifyNameDays } from '@/services/staffService'
import { listActiveAgreementsForOrg } from '@/services/agreementService'
import { addEnumOption, listEnumOptions } from '@/services/enumOptionsService'
import { listFamiliesWithDocIds, listChildrenForOrg, listFosterPersonsForOrg } from '@/services/familyService'
import {
  cancelCalendarEvent,
  cancelCalendarEventSeries,
  createCalendarEvent,
  createRecurringCalendarEvents,
  listCalendarEvents,
  updateCalendarEvent,
} from '@/services/calendarEventService'
import { agreementToNextVisitItem, calendarEventToItem, type CalendarItem } from '@/lib/calendarAggregation'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import {
  CALENDAR_EVENT_KIND_LABELS,
  RECURRENCE_UNIT_LABELS,
  type CalendarEventKind,
  type RecurrenceUnit,
} from '@/types/calendarEvent'
import type { UserDoc } from '@/types/user'
import type { FamilyDoc } from '@/types/family'
import type { ChildDoc } from '@/types/child'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { AgreementDoc } from '@/types/agreement'
import type { SubjectRef } from '@/types/timelineEntry'
import type { EnumOption } from '@/types/enumOptions'

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfDay(d: Date): Date {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

const DAY_STRIP_RADIUS = 10 // ±10 dní kolem "dnes"
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

const EMPTY_FORM = {
  title: '',
  kind: 'schuzka' as CalendarEventKind,
  date: '',
  time: '09:00',
  endTime: '10:00',
  assignedToUid: '',
  subjectRefs: [] as SubjectRef[],
  notes: '',
  recurrenceEnabled: false,
  recurrenceInterval: 1,
  recurrenceUnit: 'week' as RecurrenceUnit,
  occurrenceCount: 4,
}

function czechPlural(n: number, unit: RecurrenceUnit): string {
  const labels = RECURRENCE_UNIT_LABELS[unit]
  if (n === 1) return labels.singular
  if (n >= 2 && n <= 4) return labels.few
  return labels.many
}

/**
 * Mobilní Kalendář (M11, 2026-07-22) — Things/Routine-inspirovaná AGENDA,
 * NE zmenšenina desktopové mřížky (`react-big-calendar` na 390px šířky
 * displeje je nepoužitelná — vodorovný pás dnů + svislý seznam událostí
 * VYBRANÉHO dne je mobilní ekvivalent, ne kompromis). Znovupoužívá stejné
 * `calendarAggregation.ts` helpery jako desktop `CalendarPage.tsx` (jeden
 * zdroj pravdy pro "co je to za událost", jen jiné vykreslení).
 */
export default function MobileCalendarPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [staffList, setStaffList] = useState<UserDoc[]>([])
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }>>([])
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [fosterPersons, setFosterPersons] = useState<Array<{ docId: string; fosterPerson: FosterPersonDoc }>>([])
  const [events, setEvents] = useState<Array<{ docId: string; event: import('@/types/calendarEvent').CalendarEventDoc }>>([])
  const [agreementsByFamilyId, setAgreementsByFamilyId] = useState<Record<string, AgreementDoc>>({})
  /** Vlastní typy událostí organizace — číselník je OTEVŘENÝ (viz
   * `enumOptionsService`), takže mobil musí nabízet i je, ne jen zabudované. */
  const [customKinds, setCustomKinds] = useState<EnumOption[]>([])
  const [newKindLabel, setNewKindLabel] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [hiddenStaffUids, setHiddenStaffUids] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const [sheet, setSheet] = useState<{ mode: 'new' | 'edit'; docId?: string; seriesId?: string | null; start?: string } | null>(
    null,
  )
  const [form, setForm] = useState(EMPTY_FORM)
  const { loading: saving, run: runSave } = useAsyncSubmit()
  const { loading: cancelling, run: runCancel } = useAsyncSubmit()
  const { loading: cancellingSeries, run: runCancelSeries } = useAsyncSubmit()
  const selectedDayRef = useRef<HTMLButtonElement | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  // Směr poslední změny dne — den vpřed/vzad se má vizuálně "přisunout" ze
  // správné strany (Petrovo zadání 2026-07-23, "přechod je moc mechanický"),
  // ne jen tiše nahradit obsah beze změny.
  const [direction, setDirection] = useState<1 | -1>(1)
  // Nastavení narozeninových/jmeninových upozornění (2026-07-24, Petrovo
  // zadání "speciální nastavení PRO KALENDÁŘE") — VLASTNÍ mobilní
  // BottomSheet, ne odkaz na desktopové `/nastaveni/kalendar` (ten žije
  // v desktopovém `AppShell` se sidebarem, na 390px by to bylo rozbité —
  // stejný důvod, proč `MobileAccountPage` nikam do Nastavení neediruje,
  // viz její komentář).
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifyBirthdays, setNotifyBirthdays] = useState(true)
  const [notifyNameDays, setNotifyNameDays] = useState(true)

  useEffect(() => {
    setNotifyBirthdays(userDoc?.notifyBirthdays !== false)
    setNotifyNameDays(userDoc?.notifyNameDays !== false)
  }, [userDoc?.notifyBirthdays, userDoc?.notifyNameDays])

  async function handleNotifyBirthdaysToggle(checked: boolean) {
    setNotifyBirthdays(checked)
    if (!userDoc) return
    try {
      await updateNotifyBirthdays(userDoc.uid, checked)
    } catch {
      setNotifyBirthdays(!checked)
    }
  }

  async function handleNotifyNameDaysToggle(checked: boolean) {
    setNotifyNameDays(checked)
    if (!userDoc) return
    try {
      await updateNotifyNameDays(userDoc.uid, checked)
    } catch {
      setNotifyNameDays(!checked)
    }
  }

  function selectDate(next: Date) {
    setDirection(next.getTime() >= selectedDate.getTime() ? 1 : -1)
    setSelectedDate(next)
  }

  function goToDay(delta: number) {
    setDirection(delta > 0 ? 1 : -1)
    setSelectedDate((d) => {
      const n = new Date(d)
      n.setDate(n.getDate() + delta)
      return n
    })
  }

  // Swipe mezi dny (Petrovo zadání 2026-07-22, "jako v nativním kalendáři")
  // — jen na svislý pohyb menší než vodorovný, ať to nekoliduje se
  // svislým scrollem seznamu událostí; práh 40px odfiltruje náhodné ťuky.
  function handleTouchStart(e: TouchEvent) {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }
  function handleTouchEnd(e: TouchEvent) {
    const start = touchStartRef.current
    touchStartRef.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      goToDay(dx < 0 ? 1 : -1)
    }
  }

  // Pás dnů je ±10 dní kolem "dnes", ale vybraný den nemusí ležet ve viditelné
  // části scrollu (živě odhaleno 2026-07-22 — vybraný den byl mimo záběr a
  // v pásu nesvítil žádný chip). Po každé změně vybraného dne (i po
  // prvotním vykreslení) ho posuneme doprostřed viditelné oblasti.
  useEffect(() => {
    selectedDayRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [selectedDate])

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      const [staff, fams, kids, fosters, evts, agreements, kinds] = await Promise.all([
        listStaff(organizationId),
        listFamiliesWithDocIds(organizationId),
        listChildrenForOrg(organizationId),
        listFosterPersonsForOrg(organizationId),
        listCalendarEvents(organizationId),
        listActiveAgreementsForOrg(organizationId),
        listEnumOptions(organizationId, 'calendarEventKind'),
      ])
      setStaffList(staff)
      setFamilies(fams)
      setChildren(kids)
      setFosterPersons(fosters)
      setEvents(evts)
      setAgreementsByFamilyId(agreements)
      setCustomKinds(kinds)
    } catch {
      setError('Kalendář se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const familyLabel = useMemo(() => {
    const map = new Map<string, { uid: string; label: string }>()
    for (const { docId, family } of families) map.set(docId, { uid: family.uid, label: resolveFamilyDisplayName(family, null) })
    return map
  }, [families])

  /** Jména + fotky subjektů pro avatary u událostí — stejný helper jako
   * desktopová `CalendarPage` ("VŽDY se zobrazují avatary" platí i tady). */
  const subjectDirectory = useMemo(
    () => buildSubjectDirectory({ families, fosterPersons, children }),
    [families, fosterPersons, children],
  )

  /** Zabudované typy + vlastní organizace, stejné pořadí jako na desktopu. */
  const kindOptions = useMemo(
    () => [
      ...Object.entries(CALENDAR_EVENT_KIND_LABELS).map(([value, label]) => ({ value, label })),
      ...customKinds.map((k) => ({ value: k.key, label: k.label })),
    ],
    [customKinds],
  )

  async function handleCreateKind() {
    const label = (newKindLabel ?? '').trim()
    if (!organizationId || !userDoc || !label) return
    try {
      const option = await addEnumOption(organizationId, 'calendarEventKind', label, userDoc.uid)
      setCustomKinds((prev) => [...prev, option])
      setForm((f) => ({ ...f, kind: option.key }))
      setNewKindLabel(null)
    } catch {
      setError('Nový typ se nepodařilo přidat.')
    }
  }

  const allItems = useMemo<CalendarItem[]>(() => {
    const now = Date.now()
    const fromEvents = events
      .filter(({ event }) => event.status === 'planovano')
      .map(({ docId, event }) => calendarEventToItem(docId, event))
    const fromAgreements = Object.entries(agreementsByFamilyId).map(([familyId, agreement]) => {
      const fam = familyLabel.get(familyId)
      return agreementToNextVisitItem(familyId, fam?.uid ?? familyId, fam?.label ?? 'Rodina', agreement, now)
    })
    return [...fromEvents, ...fromAgreements]
      .filter((item): item is CalendarItem => item !== null)
      .filter((item) => !item.staffUid || !hiddenStaffUids.has(item.staffUid))
  }, [events, agreementsByFamilyId, familyLabel, hiddenStaffUids])

  const dayStrip = useMemo(() => {
    const today = startOfDay(new Date())
    const days: Date[] = []
    for (let i = -DAY_STRIP_RADIUS; i <= DAY_STRIP_RADIUS; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }, [])

  const dayItems = useMemo(
    () => allItems.filter((item) => sameDay(item.start, selectedDate)).sort((a, b) => a.start.getTime() - b.start.getTime()),
    [allItems, selectedDate],
  )

  function toggleStaff(uid: string) {
    setHiddenStaffUids((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function openNew() {
    setForm({
      ...EMPTY_FORM,
      date: formatDateValue(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()),
      assignedToUid: userDoc?.uid ?? '',
    })
    setSheet({ mode: 'new' })
  }

  function openEdit(item: CalendarItem) {
    if (item.source !== 'calendarEvent' || !item.docId || !item.event) {
      if (item.deepLink) navigate(item.deepLink)
      return
    }
    const d = new Date(item.event.start)
    const dEnd = new Date(item.event.end)
    const pad = (n: number) => String(n).padStart(2, '0')
    setForm({
      ...EMPTY_FORM,
      title: item.event.title,
      kind: item.event.kind,
      date: formatDateValue(d.getFullYear(), d.getMonth(), d.getDate()),
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      endTime: `${pad(dEnd.getHours())}:${pad(dEnd.getMinutes())}`,
      assignedToUid: item.event.assignedToUid,
      subjectRefs: item.event.subjectRefs ?? (item.event.familyDocId ? [{ kind: 'family', id: item.event.familyDocId }] : []),
      notes: item.event.notes ?? '',
    })
    setSheet({ mode: 'edit', docId: item.docId, seriesId: item.event.recurrence?.seriesId ?? null, start: item.event.start })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!organizationId || !userDoc || !sheet) return
    setError(null)
    const dateParts = parseDateValue(form.date)
    if (!dateParts) {
      setError('Zadejte platné datum.')
      return
    }
    const start = new Date(dateParts.year, dateParts.month, dateParts.day)
    const [h, m] = form.time.split(':').map(Number)
    start.setHours(h, m, 0, 0)
    const end = new Date(dateParts.year, dateParts.month, dateParts.day)
    const [eh, em] = form.endTime.split(':').map(Number)
    end.setHours(eh, em, 0, 0)
    const primaryFamily = form.subjectRefs.find((r) => r.kind === 'family')
    const fam = primaryFamily ? familyLabel.get(primaryFamily.id) : undefined
    const assignedToUid = form.assignedToUid || userDoc.uid
    const notes = form.notes.trim() || null
    try {
      await runSave(async () => {
        if (sheet.mode === 'new' && form.recurrenceEnabled) {
          await createRecurringCalendarEvents({
            organizationId,
            createdByUid: userDoc.uid,
            assignedToUid,
            title: form.title.trim(),
            kind: form.kind,
            start: start.toISOString(),
            end: end.toISOString(),
            familyDocId: primaryFamily?.id ?? null,
            familyUid: fam?.uid ?? null,
            subjectRefs: form.subjectRefs,
            notes,
            recurrenceInterval: form.recurrenceInterval,
            recurrenceUnit: form.recurrenceUnit,
            occurrenceCount: form.occurrenceCount,
          })
        } else if (sheet.mode === 'new') {
          await createCalendarEvent({
            organizationId,
            createdByUid: userDoc.uid,
            assignedToUid,
            title: form.title.trim(),
            kind: form.kind,
            start: start.toISOString(),
            end: end.toISOString(),
            familyDocId: primaryFamily?.id ?? null,
            familyUid: fam?.uid ?? null,
            subjectRefs: form.subjectRefs,
            notes,
          })
        } else if (sheet.docId) {
          await updateCalendarEvent({
            organizationId,
            docId: sheet.docId,
            title: form.title.trim(),
            kind: form.kind,
            assignedToUid,
            start: start.toISOString(),
            end: end.toISOString(),
            familyDocId: primaryFamily?.id ?? null,
            familyUid: fam?.uid ?? null,
            subjectRefs: form.subjectRefs,
            notes,
          })
        }
        await reload()
      })
      setSheet(null)
      // Uložená událost může patřit jinému dni, než se právě prohlíží
      // (Petrovo zadání 2026-07-23 — datum ve formuláři je teď editovatelné,
      // ne napevno "aktuálně zobrazený den") — po uložení přeskoč agendu na
      // ten den, ať výsledek hned uvidíte.
      selectDate(startOfDay(start))
    } catch {
      setError('Uložení se nezdařilo.')
    }
  }

  async function handleCancel() {
    if (!organizationId || !sheet?.docId) return
    try {
      await runCancel(async () => {
        await cancelCalendarEvent(organizationId, sheet.docId!)
        await reload()
      })
      setSheet(null)
    } catch {
      setError('Zrušení se nezdařilo.')
    }
  }

  /** Zruší VŠECHNY dosud neproběhlé výskyty stejné opakující se řady —
   * stejný princip jako `CalendarPage.tsx` (desktop). */
  async function handleCancelSeries() {
    if (!organizationId || !sheet?.seriesId || !sheet.start) return
    try {
      await runCancelSeries(async () => {
        await cancelCalendarEventSeries(organizationId, sheet.seriesId!, sheet.start!)
        await reload()
      })
      setSheet(null)
    } catch {
      setError('Zrušení celé řady se nezdařilo.')
    }
  }

  return (
    <MobileShell>
      <div className="flex flex-col pb-24 pt-6">
        <div className="flex items-center justify-between px-5">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-text-primary">Kalendář</h1>
          <div className="flex shrink-0 items-center gap-1">
            {/* Lupa = hledání mezi entitami. Na mobilu se otevře jako
             * vytažený spodní sheet, na desktopu jako pravý panel. */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Hledat mezi entitami"
              className="flex size-9 items-center justify-center rounded-full text-text-secondary transition-transform active:scale-90"
            >
              <Search size={22} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Nastavení kalendáře"
              className="flex size-9 items-center justify-center rounded-full text-text-secondary transition-transform active:scale-90"
            >
              <Settings size={22} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {staffList.length > 1 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1">
            {staffList.map((s) => {
              const hidden = hiddenStaffUids.has(s.uid)
              return (
                <button
                  key={s.uid}
                  type="button"
                  onClick={() => toggleStaff(s.uid)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-transform active:scale-95 ${
                    hidden ? 'border-border-subtle text-text-tertiary opacity-50' : 'border-border-strong text-text-primary'
                  }`}
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: staffColor(s.uid) }} />
                  {s.displayName.split(' ')[0]}
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-3 flex gap-1.5 overflow-x-auto px-5 pb-2">
          {dayStrip.map((d) => {
            const selected = sameDay(d, selectedDate)
            const isToday = sameDay(d, new Date())
            return (
              <button
                key={d.toISOString()}
                ref={selected ? selectedDayRef : undefined}
                type="button"
                onClick={() => selectDate(d)}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all duration-150 active:scale-90 ${
                  selected ? 'bg-primary text-primary-foreground' : 'text-text-primary'
                }`}
              >
                <span className={`text-xs uppercase ${selected ? 'text-primary-foreground/70' : 'text-text-tertiary'}`}>
                  {d.toLocaleDateString('cs-CZ', { weekday: 'short' })}
                </span>
                <span className={`text-base font-medium ${!selected && isToday ? 'text-accent' : ''}`}>{d.getDate()}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 flex items-center justify-between px-5">
          <button type="button" onClick={() => goToDay(-1)} className="p-1 transition-transform active:scale-90">
            <ChevronLeft size={20} className="text-text-secondary" />
          </button>
          <p className="text-base font-semibold text-text-primary">
            {selectedDate.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <button type="button" onClick={() => goToDay(1)} className="p-1 transition-transform active:scale-90">
            <ChevronRight size={20} className="text-text-secondary" />
          </button>
        </div>

        {error && (
          <p className="mt-3 px-5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {/* Swipe vlevo/vpravo kdekoli v seznamu událostí přepíná den (Petrovo
         * zadání 2026-07-22, "jako v nativním kalendáři") — na TÉTHLE
         * oblasti, ne na pásu dnů výš (ten už má svůj vlastní vodorovný
         * scroll, swipe by se s ním rval). `key` na datu + animace podle
         * směru (`direction`) — přechod byl "moc mechanický" (Petrovo
         * zadání 2026-07-23), obsah dne teď při každé změně nabíhá zprava/
         * zleva podle toho, jestli jde o den vpřed/vzad. */}
        <div
          key={selectedDate.toDateString()}
          className={`mt-4 min-h-[40vh] px-5 ${direction === 1 ? 'animate-day-in-forward' : 'animate-day-in-backward'}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {dayItems.length === 0 ? (
            <EmptyState icon={CalendarClock} text="Pro tenhle den nemáte žádné události." />
          ) : (
            <GroupedList>
              {dayItems.map((item) => {
                const color = item.source === 'agreementVisit' ? AGREEMENT_VISIT_COLOR : staffColor(item.staffUid ?? '')
                const subjects = resolveItemSubjects(subjectDirectory, item)
                return (
                  <GroupedListRow key={item.id} onClick={() => openEdit(item)} className="border-l-4" style={{ borderLeftColor: color }}>
                    <span className="w-14 shrink-0 text-base font-medium text-text-primary">
                      {item.allDay ? 'Celý den' : item.start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {/* Avatary o něco větší než na desktopu — prst není myš
                     * a v mobilní agendě je na ně místo. */}
                    {subjects.length > 0 && <EventAvatarStack subjects={subjects} size={22} />}
                    <span className="min-w-0 flex-1 truncate text-base text-text-secondary">{item.title}</span>
                  </GroupedListRow>
                )
              })}
            </GroupedList>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={openNew}
        aria-label="Nová událost"
        className="fixed bottom-24 right-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-overlay transition-transform duration-150 active:scale-90"
      >
        <Plus size={26} strokeWidth={2} />
      </button>

      {sheet && (
        <BottomSheet onClose={() => setSheet(null)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 pb-6 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                {sheet.mode === 'new' ? 'Nová událost' : 'Upravit událost'}
              </h2>
              {sheet.mode === 'edit' && (
                <Button type="button" variant="ghost" size="sm" loading={cancelling} onClick={handleCancel} className="text-danger">
                  <Trash2 size={16} /> Smazat
                </Button>
              )}
            </div>
            {sheet.mode === 'edit' && sheet.seriesId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={cancellingSeries}
                onClick={handleCancelSeries}
                className="w-fit text-danger"
              >
                <Trash2 size={16} /> Zrušit celou opakující se řadu
              </Button>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Název</span>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="h-12 text-base"
              />
            </label>
            {/* Datum — dřív jen tiše převzaté z aktuálně zobrazeného dne
             * agendy, nikde ve formuláři vidět ani editovatelné (živě
             * nahlášeno Petrem 2026-07-23: "zmizelo datum, kterého se
             * událost týká"). `DatePicker` = stejná komponenta jako
             * desktopová `CalendarPage.tsx`, záměrně NE nativní
             * `<input type="date">` (viz komentář u `Select` výš — u
             * `type="time"` to na iOS Safari přeteklo mimo viewport). */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Datum</span>
              <DatePicker value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} className="h-12 text-base" />
            </label>
            {/* Typ + Čas každý na VLASTNÍM řádku, ne vedle sebe (živě
             * nahlášeno Petrem 2026-07-22). Čas navíc NENÍ nativní
             * `<input type="time">` — na skutečném iOS Safari (ne jen
             * Chromium, kde to v testu vypadalo v pořádku) má vlastní
             * ovládací prvek minimální šířku větší než celý viewport na
             * 390px displeji a přetekl i na vlastním řádku (druhé
             * nahlášení stejného problému). Dva `<Select>` (hodina/minuta)
             * používají STEJNOU komponentu jako Typ/Rodina — garantovaně
             * stejné, bezpečné chování napříč prohlížeči. */}
            {/* Typ = OTEVŘENÝ číselník: kromě zabudovaných hodnot nabízí
             * i vlastní typy organizace a umí přidat nový, stejně jako
             * desktopový `Combobox` (jen mobilním zápisem — `Select` +
             * rozbalovací pole, ne našeptávač). */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Typ</span>
              <Select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as CalendarEventKind }))}
                className="h-12 text-base"
              >
                {kindOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {newKindLabel === null ? (
                <button
                  type="button"
                  onClick={() => setNewKindLabel('')}
                  className="w-fit text-sm font-medium text-primary active:opacity-60"
                >
                  + Nový typ
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={newKindLabel}
                    onChange={(e) => setNewKindLabel(e.target.value)}
                    placeholder="Např. Návštěva rodiny"
                    className="h-12 flex-1 text-base"
                  />
                  <Button type="button" size="sm" onClick={handleCreateKind} disabled={!newKindLabel.trim()}>
                    Přidat
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setNewKindLabel(null)}>
                    Zrušit
                  </Button>
                </div>
              )}
            </label>
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Začátek</span>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={form.time.split(':')[0]}
                    onChange={(e) => setForm((f) => ({ ...f, time: `${e.target.value}:${f.time.split(':')[1]}` }))}
                    className="h-12 text-base"
                    aria-label="Hodina začátku"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                  <span className="text-lg font-medium text-text-tertiary">:</span>
                  <Select
                    value={form.time.split(':')[1]}
                    onChange={(e) => setForm((f) => ({ ...f, time: `${f.time.split(':')[0]}:${e.target.value}` }))}
                    className="h-12 text-base"
                    aria-label="Minuta začátku"
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Konec</span>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={form.endTime.split(':')[0]}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: `${e.target.value}:${f.endTime.split(':')[1]}` }))}
                    className="h-12 text-base"
                    aria-label="Hodina konce"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                  <span className="text-lg font-medium text-text-tertiary">:</span>
                  <Select
                    value={form.endTime.split(':')[1]}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: `${f.endTime.split(':')[0]}:${e.target.value}` }))}
                    className="h-12 text-base"
                    aria-label="Minuta konce"
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>
              </label>
            </div>
            {staffList.length > 1 && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Přiřazeno</span>
                <Select
                  value={form.assignedToUid}
                  onChange={(e) => setForm((f) => ({ ...f, assignedToUid: e.target.value }))}
                  className="h-12 text-base"
                >
                  {staffList.map((s) => (
                    <option key={s.uid} value={s.uid}>
                      {s.displayName}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {/* Opakování jen v "new" režimu — stejný princip jako desktop
             * (editace výskytu mění jen TENHLE výskyt, ne celou řadu). */}
            {sheet.mode === 'new' && (
              <div className="flex flex-col gap-2 rounded-sm border border-border-medium bg-inset px-3 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-text-primary">Opakovat</span>
                  <Switch
                    checked={form.recurrenceEnabled}
                    onChange={(v) => setForm((f) => ({ ...f, recurrenceEnabled: v }))}
                    label="Opakovat"
                  />
                </div>
                {form.recurrenceEnabled && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-text-secondary">Každých</span>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={form.recurrenceInterval}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, recurrenceInterval: Math.max(1, Number(e.target.value) || 1) }))
                        }
                        className="h-10 w-16"
                      />
                      <Select
                        value={form.recurrenceUnit}
                        onChange={(e) => setForm((f) => ({ ...f, recurrenceUnit: e.target.value as RecurrenceUnit }))}
                        className="h-10 w-28"
                      >
                        {(['day', 'week', 'month', 'year'] as RecurrenceUnit[]).map((u) => (
                          <option key={u} value={u}>
                            {czechPlural(form.recurrenceInterval, u)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-text-secondary">Celkem</span>
                      <Input
                        type="number"
                        min={1}
                        max={104}
                        value={form.occurrenceCount}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, occurrenceCount: Math.min(104, Math.max(1, Number(e.target.value) || 1)) }))
                        }
                        className="h-10 w-16"
                      />
                      <span className="text-sm text-text-secondary">krát</span>
                    </div>
                  </>
                )}
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Vazba (rodina / dítě / pěstoun)</span>
              <SubjectRefsPicker
                value={form.subjectRefs}
                onChange={(refs) => setForm((f) => ({ ...f, subjectRefs: refs }))}
                families={families}
                children={children}
                fosterPersons={fosterPersons}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Poznámky (volitelné)</span>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Doplňující poznámka…"
              />
            </label>
            <Button type="submit" loading={saving} className="h-14 text-base">
              {sheet.mode === 'new' ? 'Založit' : 'Uložit změny'}
            </Button>
          </form>
        </BottomSheet>
      )}

      {searchOpen && (
        <BottomSheet onClose={() => setSearchOpen(false)}>
          <div className="flex h-[70vh] flex-col px-5 pb-6 pt-4">
            <h2 className="mb-3 shrink-0 text-lg font-semibold text-text-primary">Hledat</h2>
            <EntitySearch
              data={{ families, fosterPersons, children, staff: staffList }}
              onNavigated={() => setSearchOpen(false)}
            />
          </div>
        </BottomSheet>
      )}

      {settingsOpen && (
        <BottomSheet onClose={() => setSettingsOpen(false)}>
          <div className="flex flex-col gap-4 px-5 pb-6 pt-4">
            <h2 className="text-lg font-semibold text-text-primary">Nastavení kalendáře</h2>
            <div className="flex items-center justify-between gap-4">
              <span className="text-base text-text-primary">Narozeninová upozornění</span>
              <Switch checked={notifyBirthdays} onChange={handleNotifyBirthdaysToggle} label="Narozeninová upozornění" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-base text-text-primary">Jmeninová upozornění</span>
              <Switch checked={notifyNameDays} onChange={handleNotifyNameDaysToggle} label="Jmeninová upozornění" />
            </div>
          </div>
        </BottomSheet>
      )}
    </MobileShell>
  )
}
