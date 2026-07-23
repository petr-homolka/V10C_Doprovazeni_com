import { CalendarPlus, ChevronLeft, ChevronRight, PanelRight } from 'lucide-react'
import type { ToolbarProps } from 'react-big-calendar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import type { CalendarItem } from '@/lib/calendarAggregation'

const VIEW_OPTIONS = [
  { value: 'month', label: 'Měsíc' },
  { value: 'week', label: 'Týden' },
  { value: 'day', label: 'Den' },
  { value: 'agenda', label: 'Agenda' },
] as const

/**
 * Vlastní toolbar (nahrazuje defaultní `.rbc-toolbar` úplně, viz
 * `calendar-overrides.css` doc komentář) — znovupoužívá `Button`/
 * `SegmentedTabs`, ať kalendář vypadá jako SOUČÁST appky, ne jako
 * vložený cizí widget se svým vlastním stylem tlačítek.
 *
 * `onOpenSettings`/`onNewEvent` (2026-07-23) — jediné dva ovládací prvky,
 * co teď kalendáři zbyly NAD mřížkou (zbytek — filtr zaměstnanců, odkaz
 * na Nastavení, Google sync — se přesunul do pravého `SidePanel`u, ať je
 * mřížka co nejméně vyrušená chromem, viz `CalendarPage.tsx`).
 */
export function CalendarToolbar({
  label,
  view,
  onNavigate,
  onView,
  onOpenSettings,
  onNewEvent,
  settingsActive,
}: ToolbarProps<CalendarItem> & {
  onOpenSettings?: () => void
  onNewEvent?: () => void
  settingsActive?: boolean
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => onNavigate('TODAY')}>
          Dnes
        </Button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onNavigate('PREV')}
            aria-label="Předchozí"
            className="flex size-8 items-center justify-center rounded-sm text-text-secondary transition-colors duration-150 hover:bg-overlay-active hover:text-text-primary"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('NEXT')}
            aria-label="Další"
            className="flex size-8 items-center justify-center rounded-sm text-text-secondary transition-colors duration-150 hover:bg-overlay-active hover:text-text-primary"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </div>
        <h2 className="text-lg font-normal capitalize leading-tight text-text-primary">{label}</h2>
      </div>
      <div className="flex items-center gap-3">
        <SegmentedTabs options={[...VIEW_OPTIONS]} value={view} onChange={onView} />
        <div className="flex items-center gap-1 border-l border-border-subtle pl-3">
          {onNewEvent && (
            <Button size="sm" onClick={onNewEvent}>
              <CalendarPlus size={16} /> Nová událost
            </Button>
          )}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Nastavení a napojení kalendáře"
              aria-pressed={settingsActive}
              title="Nastavení a napojení kalendáře"
              className={cn(
                'flex size-9 items-center justify-center rounded-sm transition-colors duration-150',
                settingsActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-text-secondary hover:bg-overlay-active hover:text-text-primary',
              )}
            >
              <PanelRight size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
