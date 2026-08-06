import {
  CalendarPlus, ChevronLeft, ChevronRight, Clock, List, PanelRight, Search, ViewMonth, ViewWeek,
} from '@/components/ui/icons'
import type { ToolbarProps } from 'react-big-calendar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/tabs'
import type { CalendarItem } from '@/lib/calendarAggregation'

/* Přepínač pohledu = ZÁLOŽKY s ikonou, jako jejich `Board | List`. Dřív to
   byly tmavé pilulky, které křičely stejně jako „Nová událost". */
const VIEW_TABS = [
  { key: 'month', label: 'Měsíc', icon: ViewMonth },
  { key: 'week', label: 'Týden', icon: ViewWeek },
  { key: 'day', label: 'Den', icon: Clock },
  { key: 'agenda', label: 'Agenda', icon: List },
]

/**
 * Vlastní toolbar (nahrazuje defaultní `.rbc-toolbar` úplně, viz
 * `calendar-overrides.css`) — znovupoužívá `Button` a `Tabs`, ať kalendář
 * vypadá jako SOUČÁST appky, ne jako vložený cizí widget. Přepínač pohledu
 * jsou od 2026-07-25 ZÁLOŽKY (jedna komponenta pro celou appku), ne tmavé
 * pilulky: pilulka na „Týden" křičela stejně jako „Nová událost".
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
  onOpenSearch,
  onNewEvent,
  settingsActive,
  searchActive,
}: ToolbarProps<CalendarItem> & {
  onOpenSettings?: () => void
  onOpenSearch?: () => void
  onNewEvent?: () => void
  settingsActive?: boolean
  searchActive?: boolean
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
        <Tabs items={VIEW_TABS} active={view} onSelect={(key) => onView(key as typeof view)} className="border-b-0" />
        <div className="flex items-center gap-1 border-l border-border-subtle pl-3">
          {onNewEvent && (
            <Button size="sm" onClick={onNewEvent}>
              <CalendarPlus size={16} /> Nová událost
            </Button>
          )}
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Hledat mezi entitami"
              aria-pressed={searchActive}
              title="Hledat mezi entitami"
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-sm transition-colors duration-150',
                searchActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-text-secondary hover:bg-overlay-active hover:text-text-primary',
              )}
            >
              <Search size={18} strokeWidth={1.75} />
            </button>
          )}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Nastavení a napojení kalendáře"
              aria-pressed={settingsActive}
              title="Nastavení a napojení kalendáře"
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-sm transition-colors duration-150',
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
