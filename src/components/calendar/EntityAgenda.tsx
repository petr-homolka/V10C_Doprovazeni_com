import { useEffect, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { listCalendarEvents } from '@/services/calendarEventService'
import { listEnumOptions } from '@/services/enumOptionsService'
import { CALENDAR_EVENT_KIND_LABELS } from '@/types/calendarEvent'
import { EmptyState } from '@/components/ui/empty-state'
import type { CalendarEventDoc } from '@/types/calendarEvent'
import type { SubjectRefKind } from '@/types/timelineEntry'

/**
 * Kalendář konkrétní entity (rodina/pěstoun/dítě) v jeho profilu — ve
 * zmenšené podobě, výchozí (a jediný) pohled AGENDA: chronologický seznam
 * událostí, které se té entity týkají (`subjectRefs`), rozdělený na
 * nadcházející a proběhlé. Petrovo zadání: "Každá entita má svůj kalendář…
 * v profilu se zobrazuje ve zmenšené podobě a jeho defaultní pohled je AGENDA."
 */
export function EntityAgenda({
  organizationId,
  subjectKind,
  subjectId,
}: {
  organizationId: string
  subjectKind: SubjectRefKind
  subjectId: string
}) {
  const [events, setEvents] = useState<Array<{ docId: string; event: CalendarEventDoc }> | null>(null)
  /** Typ události je OTEVŘENÝ číselník (organizace si přidává vlastní, viz
   * `enumOptionsService`) — bez tohohle by se u vlastního typu zobrazil
   * technický klíč („navsteva-rodiny") místo popisku. */
  const [kindLabels, setKindLabels] = useState<Record<string, string>>(CALENDAR_EVENT_KIND_LABELS)

  useEffect(() => {
    let cancelled = false
    listCalendarEvents(organizationId)
      .then((all) => { if (!cancelled) setEvents(all) })
      .catch(() => { if (!cancelled) setEvents([]) })
    listEnumOptions(organizationId, 'calendarEventKind')
      .then((opts) => {
        if (cancelled) return
        setKindLabels({ ...CALENDAR_EVENT_KIND_LABELS, ...Object.fromEntries(opts.map((o) => [o.key, o.label])) })
      })
      .catch(() => { /* vlastní typy se nenačetly — zabudované popisky pořád platí */ })
    return () => { cancelled = true }
  }, [organizationId])

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const mine = (events ?? [])
      .filter(({ event }) => event.status === 'planovano')
      .filter(({ event }) =>
        (event.subjectRefs ?? []).some((r) => r.kind === subjectKind && r.id === subjectId) ||
        (subjectKind === 'family' && event.familyDocId === subjectId),
      )
      .sort((a, b) => a.event.start.localeCompare(b.event.start))
    return {
      upcoming: mine.filter(({ event }) => new Date(event.end).getTime() >= now),
      past: mine.filter(({ event }) => new Date(event.end).getTime() < now).reverse(),
    }
  }, [events, subjectKind, subjectId])

  if (events === null) return <p className="text-sm text-text-secondary">Načítám kalendář…</p>
  if (upcoming.length === 0 && past.length === 0) {
    return <EmptyState icon={CalendarDays} text="Žádné události v kalendáři téhle entity." />
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      {upcoming.length > 0 && (
        <AgendaGroup title="Nadcházející" rows={upcoming} kindLabels={kindLabels} />
      )}
      {past.length > 0 && (
        <AgendaGroup title="Proběhlé" rows={past} kindLabels={kindLabels} muted />
      )}
    </div>
  )
}

function AgendaGroup({
  title,
  rows,
  kindLabels,
  muted,
}: {
  title: string
  rows: Array<{ docId: string; event: CalendarEventDoc }>
  kindLabels: Record<string, string>
  muted?: boolean
}) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{title}</h3>
      <div className="flex flex-col gap-2">
        {rows.map(({ docId, event }) => {
          const start = new Date(event.start)
          const end = new Date(event.end)
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
