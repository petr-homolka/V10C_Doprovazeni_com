import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, CalendarClock, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { BottomSheet } from '@/components/mobile/BottomSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { listStaff } from '@/services/staffService'
import { listActiveAgreementsForOrg } from '@/services/agreementService'
import { listFamiliesWithDocIds } from '@/services/familyService'
import {
  cancelCalendarEvent,
  createCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '@/services/calendarEventService'
import { agreementToNextVisitItem, calendarEventToItem, type CalendarItem } from '@/lib/calendarAggregation'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { CALENDAR_EVENT_KIND_LABELS, type CalendarEventKind } from '@/types/calendarEvent'
import type { UserDoc } from '@/types/user'
import type { FamilyDoc } from '@/types/family'
import type { AgreementDoc } from '@/types/agreement'

const STAFF_PALETTE = ['#4F69F2', '#E0507A', '#2E9E6D', '#D97706', '#7C3AED', '#0EA5E9', '#DC2626', '#65A30D']
function staffColor(uid: string): string {
  let hash = 0
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0
  return STAFF_PALETTE[Math.abs(hash) % STAFF_PALETTE.length]
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfDay(d: Date): Date {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

const DAY_STRIP_RADIUS = 10 // ±10 dní kolem "dnes"

const EMPTY_FORM = { title: '', kind: 'schuzka' as CalendarEventKind, time: '09:00', familyDocId: '' }

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
  const [events, setEvents] = useState<Array<{ docId: string; event: import('@/types/calendarEvent').CalendarEventDoc }>>([])
  const [agreementsByFamilyId, setAgreementsByFamilyId] = useState<Record<string, AgreementDoc>>({})
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [hiddenStaffUids, setHiddenStaffUids] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const [sheet, setSheet] = useState<{ mode: 'new' | 'edit'; docId?: string } | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const { loading: saving, run: runSave } = useAsyncSubmit()
  const { loading: cancelling, run: runCancel } = useAsyncSubmit()
  const selectedDayRef = useRef<HTMLButtonElement | null>(null)

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
      const [staff, fams, evts, agreements] = await Promise.all([
        listStaff(organizationId),
        listFamiliesWithDocIds(organizationId),
        listCalendarEvents(organizationId),
        listActiveAgreementsForOrg(organizationId),
      ])
      setStaffList(staff)
      setFamilies(fams)
      setEvents(evts)
      setAgreementsByFamilyId(agreements)
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
    setForm({ ...EMPTY_FORM })
    setSheet({ mode: 'new' })
  }

  function openEdit(item: CalendarItem) {
    if (item.source !== 'calendarEvent' || !item.docId || !item.event) {
      if (item.deepLink) navigate(item.deepLink)
      return
    }
    const d = new Date(item.event.start)
    const pad = (n: number) => String(n).padStart(2, '0')
    setForm({
      title: item.event.title,
      kind: item.event.kind,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      familyDocId: item.event.familyDocId ?? '',
    })
    setSheet({ mode: 'edit', docId: item.docId })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!organizationId || !userDoc || !sheet) return
    setError(null)
    const start = new Date(selectedDate)
    const [h, m] = form.time.split(':').map(Number)
    start.setHours(h, m, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const fam = form.familyDocId ? familyLabel.get(form.familyDocId) : undefined
    try {
      await runSave(async () => {
        if (sheet.mode === 'new') {
          await createCalendarEvent({
            organizationId,
            createdByUid: userDoc.uid,
            assignedToUid: userDoc.uid,
            title: form.title.trim(),
            kind: form.kind,
            start: start.toISOString(),
            end: end.toISOString(),
            familyDocId: form.familyDocId || null,
            familyUid: fam?.uid ?? null,
          })
        } else if (sheet.docId) {
          await updateCalendarEvent({
            organizationId,
            docId: sheet.docId,
            title: form.title.trim(),
            kind: form.kind,
            assignedToUid: userDoc.uid,
            start: start.toISOString(),
            end: end.toISOString(),
            familyDocId: form.familyDocId || null,
            familyUid: fam?.uid ?? null,
          })
        }
        await reload()
      })
      setSheet(null)
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

  return (
    <MobileShell>
      <div className="flex flex-col pb-24 pt-6">
        <h1 className="px-5 text-2xl font-normal text-text-primary">Kalendář</h1>

        {staffList.length > 1 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1">
            {staffList.map((s) => {
              const hidden = hiddenStaffUids.has(s.uid)
              return (
                <button
                  key={s.uid}
                  type="button"
                  onClick={() => toggleStaff(s.uid)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
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
                onClick={() => setSelectedDate(d)}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-2 ${
                  selected ? 'bg-primary text-primary-foreground' : 'text-text-primary'
                }`}
              >
                <span className={`text-[11px] uppercase ${selected ? 'text-primary-foreground/70' : 'text-text-tertiary'}`}>
                  {d.toLocaleDateString('cs-CZ', { weekday: 'short' })}
                </span>
                <span className={`text-base font-medium ${!selected && isToday ? 'text-accent' : ''}`}>{d.getDate()}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 flex items-center justify-between px-5">
          <button type="button" onClick={() => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })}>
            <ChevronLeft size={20} className="text-text-secondary" />
          </button>
          <p className="text-sm font-medium text-text-primary">
            {selectedDate.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <button type="button" onClick={() => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })}>
            <ChevronRight size={20} className="text-text-secondary" />
          </button>
        </div>

        {error && (
          <p className="mt-3 px-5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 px-5">
          {dayItems.length === 0 ? (
            <EmptyState icon={CalendarClock} text="Pro tenhle den nemáte žádné události." />
          ) : (
            dayItems.map((item) => {
              const color = item.source === 'agreementVisit' ? '#9CA3AF' : staffColor(item.staffUid ?? '')
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openEdit(item)}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface-soft p-4 text-left"
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <span className="w-14 shrink-0 text-sm font-medium text-text-primary">
                    {item.allDay ? 'Celý den' : item.start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">{item.title}</span>
                </button>
              )
            })
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={openNew}
        aria-label="Nová událost"
        className="fixed bottom-24 right-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-overlay"
      >
        <Plus size={26} strokeWidth={2} />
      </button>

      {sheet && (
        <BottomSheet onClose={() => setSheet(null)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 pb-6 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-normal text-text-primary">
                {sheet.mode === 'new' ? 'Nová událost' : 'Upravit událost'}
              </h2>
              {sheet.mode === 'edit' && (
                <Button type="button" variant="ghost" size="sm" loading={cancelling} onClick={handleCancel} className="text-danger">
                  <Ban size={14} /> Zrušit
                </Button>
              )}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Název</span>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="h-12 text-base"
              />
            </label>
            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Typ</span>
                <Select
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as CalendarEventKind }))}
                  className="h-12 text-base"
                >
                  {Object.entries(CALENDAR_EVENT_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex w-28 flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Čas</span>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className="h-12 text-base"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Rodina (volitelné)</span>
              <Select
                value={form.familyDocId}
                onChange={(e) => setForm((f) => ({ ...f, familyDocId: e.target.value }))}
                className="h-12 text-base"
              >
                <option value="">Bez vazby na rodinu</option>
                {families.map(({ docId, family }) => (
                  <option key={docId} value={docId}>
                    {resolveFamilyDisplayName(family, null) || family.address || docId}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" loading={saving} className="h-14 text-base">
              {sheet.mode === 'new' ? 'Založit' : 'Uložit změny'}
            </Button>
          </form>
        </BottomSheet>
      )}
    </MobileShell>
  )
}
