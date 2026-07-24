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
import { Ban, Settings } from 'lucide-react'
import { AppShell } from '@/components/shell/AppShell'
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar'
import { EventAvatarStack } from '@/components/calendar/EventAvatarStack'
import { EntitySearch } from '@/components/search/EntitySearch'
import { buildSubjectDirectory, matchesAnySubject, resolveItemSubjects } from '@/lib/eventSubjects'
import { SidePanel } from '@/components/ui/side-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import { Switch } from '@/components/ui/switch'
import { SubjectRefsPicker } from '@/components/calendar/SubjectRefsPicker'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { listStaff } from '@/services/staffService'
import { listFamiliesWithDocIds, listChildrenForOrg, listFosterPersonsForOrg } from '@/services/familyService'
import { listActiveAgreementsForOrg } from '@/services/agreementService'
import { addEnumOption, listEnumOptions } from '@/services/enumOptionsService'
import type { EnumOption } from '@/types/enumOptions'
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
import { staffColor } from '@/lib/staffColor'
import { cn } from '@/lib/utils'

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

// Bez tohohle DnDCalendar (Týden/Den pohled) naskočí na půlnoc — vidět je
// tak hlavně hodiny 0:00-7:00, kde nikdy nic není, a pracovní dopoledne je
// potřeba nejdřív odscrollovat. 7:00 dává rovnou vidět celou pracovní dobu
// bez scrollování (živě ověřeno 2026-07-23 — Petrova zpětná vazba "kalendář
// nevyplňuje celý prostor" byla z většiny právě tohle).
const SCROLL_TO_TIME = new Date(1970, 0, 1, 7, 0, 0)

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
 *
 * Cesta B, čtvrtý průchod (2026-07-23, přímé přání Petra) — STRUKTURÁLNÍ
 * přestavba layoutu: mřížka teď `fullBleed` (celá šířka/výška obsahové
 * plochy, žádný `PageHeader`/max-width strop) a všechno "nastavování a
 * napojování" (filtr zaměstnanců, odkaz na Nastavení, Google sync) i
 * editace Události zmizelo z centrovaného `Modal`u do pravého SCHOVÁVACÍHO
 * `SidePanel`u (na rozdíl od `Drawer` bez overlay/backdrop — zbytek appky
 * zůstává interaktivní, panel jen zmenší šířku mřížky vedle sebe). Dvě
 * ikony v `CalendarToolbar` (vlevo od mřížky) přepínají, který panel (če
 * žádný) je otevřený — `panelMode`.
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
  /** Kalendáře konkrétních rodin/pěstounů/dětí zapnuté "na vyžádání"
   * (Petrovo zadání: vedení vidí kalendáře podřízených klíčových osob a NA
   * VYŽÁDÁNÍ i kalendáře jím podřízených rodin / pěstounů / dětí). Fungují
   * PŘIČTENÍM: události zapnuté entity se zobrazí i tehdy, když je jejich
   * řešitel ve filtru zaměstnanců schovaný — jinak by "zapnout kalendář
   * rodiny" nešlo použít k tomu vidět JEN tu rodinu. */
  const [extraSubjects, setExtraSubjects] = useState<SubjectRef[]>([])
  const [customKinds, setCustomKinds] = useState<EnumOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<View>(Views.WEEK)
  const [date, setDate] = useState(new Date())

  const [panelMode, setPanelMode] = useState<'none' | 'settings' | 'event' | 'search'>('none')
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

  /** Jména + fotky subjektů pro avatary u událostí — sdíleno s mobilní
   * agendou (`lib/eventSubjects.ts`). */
  const subjectDirectory = useMemo(
    () => buildSubjectDirectory({ families, fosterPersons, children }),
    [families, fosterPersons, children],
  )

  /** Zabudované typy + vlastní organizace vedle sebe (viz `enumOptionsService.ts`
   * a Petrovo zadání "číselníky nesmí mít konečný počet variant") —
   * zabudované první, ať se pořadí nemění pokaždé, když někdo přidá nový. */
  const kindOptions = useMemo(
    () => [
      ...Object.entries(CALENDAR_EVENT_KIND_LABELS).map(([value, label]) => ({ value, label })),
      ...customKinds.map((k) => ({ value: k.key, label: k.label })),
    ],
    [customKinds],
  )

  async function handleCreateKind(label: string) {
    if (!organizationId || !userDoc) throw new Error('not ready')
    const option = await addEnumOption(organizationId, 'calendarEventKind', label, userDoc.uid)
    setCustomKinds((prev) => [...prev, option])
    return { value: option.key, label: option.label }
  }

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
      .filter((item) => {
        if (!item.staffUid || !hiddenStaffUids.has(item.staffUid)) return true
        return matchesAnySubject(item, extraSubjects)
      })
  }, [events, agreementsByFamilyId, familyLabel, hiddenStaffUids, extraSubjects])

  function toggleStaff(uid: string) {
    setHiddenStaffUids((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function closePanel() {
    setPanelMode('none')
    setSlotModal(null)
  }

  function openNew(start?: Date, end?: Date) {
    const s = start ?? new Date()
    const e = end ?? new Date(s.getTime() + 60 * 60 * 1000)
    const { date: startDate, time: startTime } = splitIso(s.toISOString())
    const { date: endDate, time: endTime } = splitIso(e.toISOString())
    setForm({ ...EMPTY_FORM, assignedToUid: userDoc?.uid ?? '', startDate, startTime, endDate, endTime })
    setSlotModal({ mode: 'new' })
    setPanelMode('event')
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
    setPanelMode('event')
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
      closePanel()
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
      closePanel()
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
      closePanel()
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

  const sidePanel =
    panelMode === 'search' ? (
      <SidePanel title="Hledat" onClose={closePanel}>
        <EntitySearch data={{ families, fosterPersons, children, staff: staffList }} onNavigated={closePanel} />
      </SidePanel>
    ) : panelMode === 'settings' ? (
      <SidePanel title="Nastavení kalendáře" onClose={closePanel}>
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
              Zobrazit zaměstnance
            </h3>
            <div className="mt-2 flex flex-col gap-0.5">
              {staffList.map((s) => {
                const hidden = hiddenStaffUids.has(s.uid)
                return (
                  <button
                    key={s.uid}
                    type="button"
                    onClick={() => toggleStaff(s.uid)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-overlay-active',
                      hidden ? 'text-text-tertiary opacity-60' : 'text-text-primary',
                    )}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: staffColor(s.uid) }} />
                    {s.displayName}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Kalendáře entit "na vyžádání" — vypnuté nic nemění, zapnuté
           * přidají do kalendáře události té rodiny/pěstouna/dítěte i
           * tehdy, když je jejich řešitel ve filtru výš schovaný. */}
          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
              Kalendáře entit (na vyžádání)
            </h3>
            <SubjectRefsPicker
              value={extraSubjects}
              onChange={setExtraSubjects}
              families={families}
              children={children}
              fosterPersons={fosterPersons}
            />
            {extraSubjects.length > 0 && hiddenStaffUids.size === 0 && (
              <p className="text-xs text-text-tertiary">
                Zobrazují se všichni zaměstnanci, takže tyhle kalendáře nic nepřidávají. Schovejte výš zaměstnance,
                jejichž události vidět nechcete.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Napojení</h3>
            <Link
              to="/nastaveni/kalendar"
              className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-text-primary transition-colors duration-150 hover:bg-overlay-active"
            >
              <Settings size={16} strokeWidth={1.75} className="text-text-secondary" />
              Nastavení kalendáře
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGoogleSync}
              loading={syncingGoogle}
              className="w-full justify-center"
            >
              Synchronizovat s Google Kalendářem
            </Button>
          </div>
        </div>
      </SidePanel>
    ) : panelMode === 'event' && slotModal ? (
      <SidePanel
        title={slotModal.mode === 'new' ? 'Nová událost' : 'Upravit událost'}
        onClose={closePanel}
        actions={
          slotModal.mode === 'edit' ? (
            <>
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
                  <Ban size={14} /> Řada
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" loading={cancelling} onClick={handleCancel} className="text-danger">
                <Ban size={14} /> Zrušit
              </Button>
            </>
          ) : undefined
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Název</span>
              <Input required autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Typ</span>
              <Combobox
                options={kindOptions}
                value={form.kind}
                onChange={(v) => set('kind', v)}
                onCreateOption={handleCreateKind}
                placeholder="Vybrat typ…"
              />
            </label>
            <label className="flex flex-col gap-1.5">
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

          <div className="flex flex-col gap-3 rounded-lg bg-inset p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Termín</h3>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Začátek</span>
              <div className="flex gap-2">
                <DatePicker className="min-w-0 flex-[1.4]" value={form.startDate} onChange={(v) => set('startDate', v)} />
                <Input
                  type="time"
                  className="w-[104px] shrink-0"
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                />
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Konec</span>
              <div className="flex gap-2">
                <DatePicker className="min-w-0 flex-[1.4]" value={form.endDate} onChange={(v) => set('endDate', v)} />
                <Input
                  type="time"
                  className="w-[104px] shrink-0"
                  value={form.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                />
              </div>
            </label>

            {slotModal.mode === 'new' && (
              <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
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
                    zatím appka neumí.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
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
          </div>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-border-default pt-4">
            <Button type="submit" loading={saving}>
              {slotModal.mode === 'new' ? 'Založit' : 'Uložit změny'}
            </Button>
            <Button type="button" variant="ghost" onClick={closePanel} disabled={saving}>
              Zrušit okno
            </Button>
          </div>
        </form>
      </SidePanel>
    ) : undefined

  return (
    <AppShell breadcrumb={[{ label: 'Kalendář' }]} fullBleed sidePanel={sidePanel}>
      <div className="flex h-full min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
          {error && (
            <p className="mb-3 shrink-0 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-surface-soft p-4 shadow-raised">
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
                scrollToTime={SCROLL_TO_TIME}
                style={{ height: '100%' }}
                selectable
                components={{
                  toolbar: (toolbarProps) => (
                    <CalendarToolbar
                      {...toolbarProps}
                      onNewEvent={() => openNew()}
                      onOpenSettings={() => setPanelMode((p) => (p === 'settings' ? 'none' : 'settings'))}
                      onOpenSearch={() => setPanelMode((p) => (p === 'search' ? 'none' : 'search'))}
                      settingsActive={panelMode === 'settings'}
                      searchActive={panelMode === 'search'}
                    />
                  ),
                  event: ({ event }: { event: CalendarItem }) => {
                    const subjects = resolveItemSubjects(subjectDirectory, event)
                    return (
                      <span className="flex items-center gap-1 overflow-hidden">
                        {subjects.length > 0 && <EventAvatarStack subjects={subjects} />}
                        <span className="truncate">{event.title}</span>
                      </span>
                    )
                  },
                }}
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
        </div>
      </div>
    </AppShell>
  )
}
