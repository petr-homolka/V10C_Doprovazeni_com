import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calendar as BigCalendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar'
import * as DragAndDropAddon from 'react-big-calendar/lib/addons/dragAndDrop'
import type { EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, getDay, parse, startOfWeek } from 'date-fns'
import { cs } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import '@/styles/calendar-overrides.css'
import { CalendarPlus, Ban, Settings } from 'lucide-react'
import { AppShell } from '@/components/shell/AppShell'
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Switch } from '@/components/ui/switch'
import { SubjectRefsPicker } from '@/components/calendar/SubjectRefsPicker'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { listStaff } from '@/services/staffService'
import { listFamiliesWithDocIds, listChildrenForOrg, listFosterPersonsForOrg } from '@/services/familyService'
import { listActiveAgreementsForOrg } from '@/services/agreementService'
import {
  cancelCalendarEvent,
  cancelCalendarEventSeries,
  createCalendarEvent,
  createRecurringCalendarEvents,
  listCalendarEvents,
  markCalendarEventSynced,
  rescheduleCalendarEvent,
  updateCalendarEvent,
} from '@/services/calendarEventService'
import { getGoogleCalendarAccessToken, upsertGoogleCalendarEvent } from '@/lib/googleCalendar'
import { agreementToNextVisitItem, calendarEventToItem, type CalendarItem } from '@/lib/calendarAggregation'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { CALENDAR_EVENT_KIND_LABELS, RECURRENCE_UNIT_LABELS, type CalendarEventKind, type RecurrenceUnit } from '@/types/calendarEvent'
import type { UserDoc } from '@/types/user'
import type { FamilyDoc } from '@/types/family'
import type { ChildDoc } from '@/types/child'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { SubjectRef } from '@/types/timelineEntry'

const locales = { 'cs-CZ': cs }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

const MESSAGES = {
  month: 'Měsíc',
  week: 'Týden',
  day: 'Den',
  agenda: 'Agenda',
  today: 'Dnes',
  previous: 'Zpět',
  next: 'Další',
  date: 'Datum',
  time: 'Čas',
  event: 'Událost',
  noEventsInRange: 'V tomhle rozsahu nejsou žádné události.',
  showMore: (count: number) => `+${count} další`,
}

// Vite dev-server dep-optimizer dvakrát zabalí CJS `export default` téhle
// (jen CJS, žádný ESM build) addon knihovny do `{ default: fn }` navíc
// obalu ({ default: { default: fn } }) — živě odhaleno (PAGE ERROR
// "withDragAndDrop is not a function"), odbalujeme, dokud nenarazíme na
// funkci samotnou, ne natvrdo jedno `.default`.
function unwrapDefault<T>(mod: unknown): T {
  let current: unknown = mod
  while (current && typeof current !== 'function' && typeof current === 'object' && 'default' in current) {
    current = (current as { default: unknown }).default
  }
  return current as T
}

// DnD calendar — react-big-calendar 1.x drag & drop addon poskytuje
// TAKÉ resize, ne jen přesun mezi sloty, viz `onEventResize` níž.
const withDragAndDrop = unwrapDefault<typeof import('react-big-calendar/lib/addons/dragAndDrop').default>(
  DragAndDropAddon,
)
const DnDCalendar = withDragAndDrop<CalendarItem>(BigCalendar)

// Cesta B (2026-07-24) — kategorická paleta VĚDOMĚ vynechává modrou (teď
// --primary, konfliktovalo by s barvou appky samotné) a čistě červenou
// (--danger) — zbytek spektra, ať zaměstnanci zůstanou vzájemně
// rozlišitelní i vedle nového sebevědomě modrého chrome.
const STAFF_PALETTE = [
  '#8B5CF6', '#DB2777', '#EA580C', '#0D9488',
  '#65A30D', '#0891B2', '#D97706', '#9333EA',
]

function staffColor(uid: string): string {
  let hash = 0
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0
  return STAFF_PALETTE[Math.abs(hash) % STAFF_PALETTE.length]
}

/** Routine.co inspirace (2026-07-22, "vypadá to jako z roku 1999") — místo
 * plné saturované barvy s bílým textem: PASTELOVÉ pozadí (stejný odstín,
 * jen zesvětlený) + tmavý text appky + silnější barevný levý okraj coby
 * jediný sytý akcent. Čitelnější, klidnější, sedí do zbytku appky (žádný
 * blok čisté saturované barvy nikde jinde v UI). */
function lightenHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amount)
  const g = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amount)
  const b = Math.round((n & 255) + (255 - (n & 255)) * amount)
  return `rgb(${r}, ${g}, ${b})`
}

const TIER_COLORS: Record<string, string> = {
  ok: '#7587A8',
  waiting: '#C8790A',
  warning: '#E21D12',
  crisis: '#E21D12',
}

function splitIso(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function toIso(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}

const EMPTY_FORM = {
  title: '',
  kind: 'schuzka' as CalendarEventKind,
  assignedToUid: '',
  subjectRefs: [] as SubjectRef[],
  startDate: '',
  startTime: '09:00',
  endDate: '',
  endTime: '10:00',
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
 * `/kalendar` — nový staff-wide sdílený kalendář (mimo dosud číslovanou
 * M-řadu, přímý požadavek 2026-07-21: "skvěle udělaný kalendář s mnoha
 * pohledy včetně agendy a s možností přetahování"). Agreguje ze dvou
 * zdrojů (viz `calendarAggregation.ts` pro plné zdůvodnění rozsahu):
 * vlastní `calendarEvents` (plně editovatelné/přetažitelné) a "další
 * návštěva splatná" připomínky z aktivních Dohod (jen READ-ONLY).
 *
 * "Synchronizace s Google Kalendářem" (`handleGoogleSync`, viz
 * `lib/googleCalendar.ts` pro plné zdůvodnění klientského OAuth toku bez
 * backendu) — push VÝHRADNĚ vlastních naplánovaných událostí
 * (`assignedToUid === userDoc.uid`) do vlastního Google Kalendáře
 * přihlášeného uživatele.
 */
export default function CalendarPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [staffList, setStaffList] = useState<UserDoc[]>([])
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }>>([])
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [fosterPersons, setFosterPersons] = useState<Array<{ docId: string; fosterPerson: FosterPersonDoc }>>([])
  const [events, setEvents] = useState<Array<{ docId: string; event: import('@/types/calendarEvent').CalendarEventDoc }>>([])
  const [agreementsByFamilyId, setAgreementsByFamilyId] = useState<
    Record<string, import('@/types/agreement').AgreementDoc>
  >({})
  const [hiddenStaffUids, setHiddenStaffUids] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<View>(Views.WEEK)
  const [date, setDate] = useState(new Date())

  const [slotModal, setSlotModal] = useState<{ mode: 'new' | 'edit'; docId?: string; seriesId?: string | null; start?: string } | null>(
    null,
  )
  const { loading: cancellingSeries, run: runCancelSeries } = useAsyncSubmit()
  const [form, setForm] = useState(EMPTY_FORM)
  const { loading: saving, run: runSave } = useAsyncSubmit()
  const { loading: cancelling, run: runCancel } = useAsyncSubmit()
  const [syncingGoogle, setSyncingGoogle] = useState(false)

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      const [staff, fams, kids, fosters, evts, agreements] = await Promise.all([
        listStaff(organizationId),
        listFamiliesWithDocIds(organizationId),
        listChildrenForOrg(organizationId),
        listFosterPersonsForOrg(organizationId),
        listCalendarEvents(organizationId),
        listActiveAgreementsForOrg(organizationId),
      ])
      setStaffList(staff)
      setFamilies(fams)
      setChildren(kids)
      setFosterPersons(fosters)
      setEvents(evts)
      setAgreementsByFamilyId(agreements)
      setLoaded(true)
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
    for (const { docId, family } of families) {
      map.set(docId, { uid: family.uid, label: resolveFamilyDisplayName(family, null) })
    }
    return map
  }, [families])

  const items = useMemo<CalendarItem[]>(() => {
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

  function toggleStaff(uid: string) {
    setHiddenStaffUids((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function openNew(start?: Date, end?: Date) {
    const s = start ?? new Date()
    const e = end ?? new Date(s.getTime() + 60 * 60 * 1000)
    const { date: startDate, time: startTime } = splitIso(s.toISOString())
    const { date: endDate, time: endTime } = splitIso(e.toISOString())
    setForm({ ...EMPTY_FORM, assignedToUid: userDoc?.uid ?? '', startDate, startTime, endDate, endTime })
    setSlotModal({ mode: 'new' })
  }

  function openEdit(item: CalendarItem) {
    if (item.source !== 'calendarEvent' || !item.docId || !item.event) {
      if (item.deepLink) navigate(item.deepLink)
      return
    }
    const { date: startDate, time: startTime } = splitIso(item.event.start)
    const { date: endDate, time: endTime } = splitIso(item.event.end)
    setForm({
      ...EMPTY_FORM,
      title: item.event.title,
      kind: item.event.kind,
      assignedToUid: item.event.assignedToUid,
      subjectRefs: item.event.subjectRefs ?? (item.event.familyDocId ? [{ kind: 'family', id: item.event.familyDocId }] : []),
      startDate,
      startTime,
      endDate,
      endTime,
      notes: item.event.notes ?? '',
    })
    setSlotModal({ mode: 'edit', docId: item.docId, seriesId: item.event.recurrence?.seriesId ?? null, start: item.event.start })
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!organizationId || !userDoc || !slotModal) return
    setError(null)
    const start = toIso(form.startDate, form.startTime)
    const end = toIso(form.endDate, form.endTime)
    if (Date.parse(end) <= Date.parse(start)) {
      setError('Konec musí být po začátku.')
      return
    }
    const primaryFamily = form.subjectRefs.find((r) => r.kind === 'family')
    const fam = primaryFamily ? familyLabel.get(primaryFamily.id) : undefined
    try {
      await runSave(async () => {
        if (slotModal.mode === 'new' && form.recurrenceEnabled) {
          await createRecurringCalendarEvents({
            organizationId,
            createdByUid: userDoc.uid,
            assignedToUid: form.assignedToUid || userDoc.uid,
            title: form.title.trim(),
            kind: form.kind,
            start,
            end,
            familyDocId: primaryFamily?.id ?? null,
            familyUid: fam?.uid ?? null,
            subjectRefs: form.subjectRefs,
            notes: form.notes.trim() || null,
            recurrenceInterval: form.recurrenceInterval,
            recurrenceUnit: form.recurrenceUnit,
            occurrenceCount: form.occurrenceCount,
          })
        } else if (slotModal.mode === 'new') {
          await createCalendarEvent({
            organizationId,
            createdByUid: userDoc.uid,
            assignedToUid: form.assignedToUid || userDoc.uid,
            title: form.title.trim(),
            kind: form.kind,
            start,
            end,
            familyDocId: primaryFamily?.id ?? null,
            familyUid: fam?.uid ?? null,
            subjectRefs: form.subjectRefs,
            notes: form.notes.trim() || null,
          })
        } else if (slotModal.docId) {
          await updateCalendarEvent({
            organizationId,
            docId: slotModal.docId,
            title: form.title.trim(),
            kind: form.kind,
            assignedToUid: form.assignedToUid || userDoc.uid,
            start,
            end,
            familyDocId: primaryFamily?.id ?? null,
            familyUid: fam?.uid ?? null,
            subjectRefs: form.subjectRefs,
            notes: form.notes.trim() || null,
          })
        }
        await reload()
      })
      setSlotModal(null)
    } catch {
      setError('Uložení se nezdařilo.')
    }
  }

  async function handleCancel() {
    if (!organizationId || !slotModal?.docId) return
    setError(null)
    try {
      await runCancel(async () => {
        await cancelCalendarEvent(organizationId, slotModal.docId!)
        await reload()
      })
      setSlotModal(null)
    } catch {
      setError('Zrušení se nezdařilo.')
    }
  }

  /** Zruší VŠECHNY dosud neproběhlé výskyty stejné opakující se řady —
   * dostupné jen pro události s `recurrence` (viz `openEdit`, `seriesId`
   * uložený v `slotModal`). Minulé výskyty zůstávají beze změny. */
  async function handleCancelSeries() {
    if (!organizationId || !slotModal?.seriesId || !slotModal.start) return
    setError(null)
    try {
      await runCancelSeries(async () => {
        await cancelCalendarEventSeries(organizationId, slotModal.seriesId!, slotModal.start!)
        await reload()
      })
      setSlotModal(null)
    } catch {
      setError('Zrušení celé řady se nezdařilo.')
    }
  }

  async function handleEventDrop(args: EventInteractionArgs<CalendarItem>) {
    if (!organizationId || args.event.source !== 'calendarEvent' || !args.event.docId) return
    const start = typeof args.start === 'string' ? args.start : args.start.toISOString()
    const end = typeof args.end === 'string' ? args.end : args.end.toISOString()
    try {
      await rescheduleCalendarEvent({ organizationId, docId: args.event.docId, start, end })
      await reload()
    } catch {
      setError('Přesun se nezdařilo uložit.')
    }
  }

  /** Google Kalendář sync — VÝHRADNĚ vlastní (`assignedToUid === userDoc.uid`)
   * naplánované události, push (insert/update), nikdy mazání ani cizí
   * kalendář (viz `googleCalendar.ts` komentář pro plné zdůvodnění). */
  async function handleGoogleSync() {
    if (!organizationId || !userDoc) return
    setSyncingGoogle(true)
    setError(null)
    try {
      const accessToken = await getGoogleCalendarAccessToken()
      const mine = events.filter(
        ({ event }) => event.status === 'planovano' && event.assignedToUid === userDoc.uid,
      )
      for (const { docId, event } of mine) {
        const googleEventId = await upsertGoogleCalendarEvent(accessToken, event.googleEventId, {
          summary: event.title,
          description: event.notes,
          start: event.start,
          end: event.end,
        })
        await markCalendarEventSynced(organizationId, docId, googleEventId)
      }
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synchronizace s Google Kalendářem se nezdařila.')
    } finally {
      setSyncingGoogle(false)
    }
  }

  return (
    <AppShell breadcrumb={[{ label: 'Kalendář' }]}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {staffList.map((s) => {
            const hidden = hiddenStaffUids.has(s.uid)
            return (
              <button
                key={s.uid}
                type="button"
                onClick={() => toggleStaff(s.uid)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity ${
                  hidden ? 'border-border-subtle text-text-tertiary opacity-50' : 'border-border-strong text-text-primary'
                }`}
                title={hidden ? `Zobrazit ${s.displayName}` : `Skrýt ${s.displayName}`}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: staffColor(s.uid) }} />
                {s.displayName}
              </button>
            )
          })}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/nastaveni/kalendar"
            aria-label="Nastavení kalendáře"
            title="Nastavení kalendáře — narozeninová a jmeninová upozornění"
            className="flex size-9 items-center justify-center rounded-sm text-text-secondary hover:bg-overlay-active hover:text-text-primary"
          >
            <Settings size={18} />
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGoogleSync}
            loading={syncingGoogle}
            title="Odešle vaše naplánované události (přiřazené vám) do vašeho Google Kalendáře — přihlásíte se poprvé Google účtem."
          >
            Synchronizovat s Google Kalendářem
          </Button>
          <Button size="sm" onClick={() => openNew()}>
            <CalendarPlus size={16} /> Nová událost
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 rounded-lg border border-border bg-surface-soft p-4 shadow-raised">
        {loaded && (
          <DnDCalendar
            localizer={localizer}
            culture="cs-CZ"
            messages={MESSAGES}
            events={items}
            view={view}
            onView={setView}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA] as View[]}
            date={date}
            onNavigate={setDate}
            style={{ height: 720 }}
            selectable
            components={{ toolbar: CalendarToolbar }}
            draggableAccessor={(item) => item.draggable}
            resizableAccessor={(item) => item.draggable}
            onSelectSlot={({ start, end }) => openNew(start as Date, end as Date)}
            onSelectEvent={openEdit}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventDrop}
            eventPropGetter={(item) => {
              const color =
                item.source === 'agreementVisit' ? TIER_COLORS[item.tier ?? 'ok'] : staffColor(item.staffUid ?? '')
              return {
                style: {
                  backgroundColor: lightenHex(color, item.source === 'agreementVisit' ? 0.82 : 0.78),
                  color: 'var(--text-primary)',
                  borderLeft: `3px solid ${color}`,
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                },
              }
            }}
          />
        )}
      </div>

      {slotModal && (
        <Modal onClose={() => setSlotModal(null)} className="max-w-[520px]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-text-primary">
                {slotModal.mode === 'new' ? 'Nová událost' : 'Upravit událost'}
              </h3>
              {slotModal.mode === 'edit' && (
                <div className="flex gap-2">
                  {slotModal.seriesId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={cancellingSeries}
                      onClick={handleCancelSeries}
                      className="text-danger"
                      title="Zruší tenhle i všechny budoucí výskyty stejné opakující se řady, minulé výskyty zůstanou beze změny."
                    >
                      <Ban size={14} /> Zrušit celou řadu
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={cancelling}
                    onClick={handleCancel}
                    className="text-danger"
                  >
                    <Ban size={14} /> Zrušit událost
                  </Button>
                </div>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Název</span>
              <Input required value={form.title} onChange={(e) => set('title', e.target.value)} />
            </label>

            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Typ</span>
                <Select value={form.kind} onChange={(e) => set('kind', e.target.value as CalendarEventKind)}>
                  {Object.entries(CALENDAR_EVENT_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Přiřazeno</span>
                <Select value={form.assignedToUid} onChange={(e) => set('assignedToUid', e.target.value)}>
                  {staffList.map((s) => (
                    <option key={s.uid} value={s.uid}>
                      {s.displayName}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Začátek</span>
                <div className="flex gap-2">
                  <DatePicker value={form.startDate} onChange={(v) => set('startDate', v)} />
                  <Input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
                </div>
              </label>
            </div>
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Konec</span>
                <div className="flex gap-2">
                  <DatePicker value={form.endDate} onChange={(v) => set('endDate', v)} />
                  <Input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
                </div>
              </label>
            </div>

            {/* Opakování jen v "new" režimu — editace existujícího výskytu
             * mění jen TENHLE výskyt, ne celou řadu (viz komentář u
             * `EventRecurrence` typu proč jsou to nezávislé dokumenty). */}
            {slotModal.mode === 'new' && (
              <div className="flex flex-col gap-2 rounded-sm border border-border-medium bg-inset px-3 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Opakovat</span>
                  <Switch checked={form.recurrenceEnabled} onChange={(v) => set('recurrenceEnabled', v)} label="Opakovat" />
                </div>
                {form.recurrenceEnabled && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-text-secondary">Každých</span>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={form.recurrenceInterval}
                      onChange={(e) => set('recurrenceInterval', Math.max(1, Number(e.target.value) || 1))}
                      className="w-16"
                    />
                    <Select
                      value={form.recurrenceUnit}
                      onChange={(e) => set('recurrenceUnit', e.target.value as RecurrenceUnit)}
                      className="w-28"
                    >
                      {(['day', 'week', 'month', 'year'] as RecurrenceUnit[]).map((u) => (
                        <option key={u} value={u}>
                          {czechPlural(form.recurrenceInterval, u)}
                        </option>
                      ))}
                    </Select>
                    <span className="text-sm text-text-secondary">celkem</span>
                    <Input
                      type="number"
                      min={1}
                      max={104}
                      value={form.occurrenceCount}
                      onChange={(e) => set('occurrenceCount', Math.min(104, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-16"
                    />
                    <span className="text-sm text-text-secondary">krát</span>
                  </div>
                )}
                {form.recurrenceEnabled && (
                  <p className="text-xs text-text-tertiary">
                    Založí se každý výskyt zvlášť (max. 104 výskytů/2 roky dopředu) — pozdější dogenerování řady
                    zatím appka neumí, na dlouhodobě opakující se událost je potřeba se vrátit ručně.
                  </p>
                )}
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Vazba (rodina / dítě / pěstoun)</span>
              <SubjectRefsPicker
                value={form.subjectRefs}
                onChange={(refs) => set('subjectRefs', refs)}
                families={families}
                children={children}
                fosterPersons={fosterPersons}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Poznámka</span>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={2}
                className="w-full resize-y rounded-sm border border-transparent bg-field px-3 py-2 text-sm text-text-primary transition-shadow duration-150 focus:border-accent focus:shadow-focus focus:outline-none"
              />
            </label>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" loading={saving}>
                {slotModal.mode === 'new' ? 'Založit' : 'Uložit změny'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSlotModal(null)} disabled={saving}>
                Zrušit okno
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  )
}
