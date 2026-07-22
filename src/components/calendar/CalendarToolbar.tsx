import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ToolbarProps } from 'react-big-calendar'
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
 */
export function CalendarToolbar({ label, view, onNavigate, onView }: ToolbarProps<CalendarItem>) {
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
      <SegmentedTabs options={[...VIEW_OPTIONS]} value={view} onChange={onView} />
    </div>
  )
}
