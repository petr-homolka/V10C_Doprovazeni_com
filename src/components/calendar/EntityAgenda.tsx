import { useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { listCalendarEventsForStaff, listCalendarEventsForSubject } from '@/services/calendarEventService'
import { listEnumOptions } from '@/services/enumOptionsService'
import { loadSubjectDirectory } from '@/services/subjectDirectoryService'
import { CALENDAR_EVENT_KIND_LABELS } from '@/types/calendarEvent'
import { EmptyState } from '@/components/ui/empty-state'
import { EventAvatarStack } from '@/components/calendar/EventAvatarStack'
import { resolveItemSubjects, type SubjectDirectory } from '@/lib/eventSubjects'
import type { CalendarEventDoc } from '@/types/calendarEvent'
import type { SubjectRefKind } from '@/types/timelineEntry'

/**
 * Kalendář konkrétní entity (rodina/pěstoun/dítě/zaměstnanec) v jeho
 * profilu — ve zmenšené podobě, výchozí (a jediný) pohled AGENDA:
 * chronologický seznam událostí, které se té entity týkají, rozdělený na
 * nadcházející a proběhlé. Petrovo zadání: "Každá entita má svůj kalendář…
 * v profilu se zobrazuje ve zmenšené podobě a jeho defaultní pohled je AGENDA."
 *
 * Načítá ZÚŽENĚ (2026-07-24): dotaz přes denormalizované `subjectKeys`
 * (resp. `assignedToUid` u zaměstnance) vrátí jen události té entity, a
 * jména/fotky se dotahují jen pro entity, které se v nich skutečně
 * objevily. Dřív se stahovaly všechny události organizace plus celé
 * seznamy rodin/pěstounů/dětí — u větší organizace tisíce dokumentů kvůli
 * pár řádkům agendy.
 */
export function EntityAgenda({
  organizationId,
  subjectKind,
  subjectId,
}: {
  organizationId: string
  /** `staff` = kalendář zaměstnance, tedy události PŘIŘAZENÉ jemu
   * (`assignedToUid`) — zaměstnanec není `subjectRefs` subjekt, události se
   * ho netýkají jako klienta, ale jako řešitele. */
  subjectKind: SubjectRefKind | 'staff'
  subjectId: string
}) {
  const [events, setEvents] = useState<Array<{ docId: string; event: CalendarEventDoc }> | null>(null)
  /** Typ události je OTEVŘENÝ číselník (organizace si přidává vlastní, viz
   * `enumOptionsService`) — bez tohohle by se u vlastního typu zobrazil
   * technický klíč („navsteva-rodiny") místo popisku. */
  const [kindLabels, setKindLabels] = useState<Record<string, string>>(CALENDAR_EVENT_KIND_LABELS)
  /** Jména + fotky subjektů načtených událostí — událost se často týká víc
   * lidí než jen té entity, v jejímž profilu jsme, a avatary se zobrazují vždy. */
  const [directory, setDirectory] = useState<SubjectDirectory | null>(null)

  useEffect(() => {
    let cancelled = false
    const load =
      subjectKind === 'staff'
        ? listCalendarEventsForStaff(organizationId, subjectId)
        : listCalendarEventsForSubject(organizationId, subjectKind, subjectId)
    load
      .then(async (mine) => {
        if (cancelled) return
        setEvents(mine)
        // Adresář se staví z toho, co v načtených událostech reálně je —
        // ne z celé organizace.
        const refs = mine.flatMap(({ event }) => [
          ...(event.subjectRefs ?? []),
          ...(event.familyDocId ? [{ kind: 'family', id: event.familyDocId }] : []),
        ])
        const dir = await loadSubjectDirectory(refs)
        if (!cancelled) setDirectory(dir)
      })
      .catch(() => { if (!cancelled) setEvents([]) })
    listEnumOptions(organizationId, 'calendarEventKind')
      .then((opts) => {
        if (cancelled) return
        setKindLabels({ ...CALENDAR_EVENT_KIND_LABELS, ...Object.fromEntries(opts.map((o) => [o.key, o.label])) })
      })
      .catch(() => { /* vlastní typy se nenačetly — zabudované popisky pořád platí */ })
    return () => { cancelled = true }
  }, [organizationId, subjectKind, subjectId])

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    // Filtr na entitu už proběhl v dotazu; tady zbývá jen odfiltrovat
    // zrušené a rozdělit na nadcházející/proběhlé.
    const mine = (events ?? [])
      .filter(({ event }) => event.status === 'planovano')
      .sort((a, b) => a.event.start.localeCompare(b.event.start))
    return {
      upcoming: mine.filter(({ event }) => new Date(event.end).getTime() >= now),
      past: mine.filter(({ event }) => new Date(event.end).getTime() < now).reverse(),
    }
  }, [events])

  if (events === null) return <p className="text-sm text-text-secondary">Načítám kalendář…</p>
  if (upcoming.length === 0 && past.length === 0) {
    return <EmptyState icon={CalendarDays} text="Žádné události v kalendáři téhle entity." />
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      {upcoming.length > 0 && (
        <AgendaGroup title="Nadcházející" rows={upcoming} kindLabels={kindLabels} directory={directory} />
      )}
      {past.length > 0 && (
        <AgendaGroup title="Proběhlé" rows={past} kindLabels={kindLabels} directory={directory} muted />
      )}
    </div>
  )
}

function AgendaGroup({
  title,
  rows,
  kindLabels,
  directory,
  muted,
}: {
  title: string
  rows: Array<{ docId: string; event: CalendarEventDoc }>
  kindLabels: Record<string, string>
  directory: SubjectDirectory | null
  muted?: boolean
}) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{title}</h3>
      <div className="flex flex-col gap-2">
        {rows.map(({ docId, event }) => {
          const start = new Date(event.start)
          const end = new Date(event.end)
          const subjects = directory ? resolveItemSubjects(directory, { event }) : []
          return (
            <div
              key={docId}
              className={`flex items-center gap-3 rounded-lg bg-surface-soft p-3 shadow-raised ${muted ? 'opacity-70' : ''}`}
            >
              <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-inset px-2 py-1 text-center">
                <span className="text-[10px] uppercase text-text-tertiary">
                  {start.toLocaleDateString('cs-CZ', { month: 'short' })}
                </span>
                <span className="text-base font-semibold leading-tight text-text-primary">{start.getDate()}</span>
              </div>
              {subjects.length > 0 && <EventAvatarStack subjects={subjects} size={24} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{event.title}</p>
                <p className="text-xs text-text-secondary">
                  {start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  {'–'}
                  {end.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {kindLabels[event.kind] ?? event.kind}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
