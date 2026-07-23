import { useEffect, useRef, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysInMonth, firstWeekdayOfMonth, formatDateValue, formatDisplay, parseDateValue } from '@/lib/dateGrid'

const WEEKDAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const MONTH_LABELS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
]

/**
 * Dvoukalendářový výběr ROZSAHU dat (od–do) — jedno rozbalení, dva měsíce
 * vedle sebe, klik na první den nastaví začátek, klik na druhý konec (dřív
 * vybraný den se přemaže, pokud klikneš na dřívější datum). Určeno pro
 * KRÁTKÁ období (dny až týdny/měsíce — respit, inspekce, IPPD okno,
 * OSPOD report) — pro víceleté rozsahy (Dohoda) by klikání přes desítky
 * měsíců bylo horší než automatický odhad + jedno pole na úpravu, viz
 * `src/lib/agreementDuration.ts` a `AgreementDetailPage.tsx`.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = 'Vybrat období',
  className,
  disabled,
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const fromParsed = parseDateValue(from)
  const [viewYear, setViewYear] = useState(fromParsed?.year ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(fromParsed?.month ?? today.getMonth())

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (open && fromParsed) {
      setViewYear(fromParsed.year)
      setViewMonth(fromParsed.month)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function shiftMonth(base: { year: number; month: number }, delta: number): { year: number; month: number } {
    const idx = base.year * 12 + base.month + delta
    return { year: Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 }
  }

  function goToPrevMonth() {
    const shifted = shiftMonth({ year: viewYear, month: viewMonth }, -1)
    setViewYear(shifted.year)
    setViewMonth(shifted.month)
  }
  function goToNextMonth() {
    const shifted = shiftMonth({ year: viewYear, month: viewMonth }, 1)
    setViewYear(shifted.year)
    setViewMonth(shifted.month)
  }

  function handleDayClick(v: string) {
    if (!from || (from && to)) {
      // Nic vybráno, nebo obojí už vybráno -> začni nový výběr.
      onChange({ from: v, to: '' })
    } else if (v < from) {
      // Klik před dřívějším začátkem -> ten se stává novým začátkem.
      onChange({ from: v, to: '' })
    } else {
      onChange({ from, to: v })
    }
  }

  function renderMonth(year: number, month: number) {
    const leading = firstWeekdayOfMonth(year, month)
    const total = daysInMonth(year, month)
    const cells: Array<number | null> = [...Array(leading).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
    const todayValue = formatDateValue(today.getFullYear(), today.getMonth(), today.getDate())

    return (
      <div key={`${year}-${month}`}>
        <p className="text-center text-sm font-medium text-text-primary">
          {MONTH_LABELS[month]} {year}
        </p>
        <div className="mt-2 grid grid-cols-7 gap-y-0.5 text-center">
          {WEEKDAY_LABELS.map((d) => (
            <span key={d} className="text-xs text-text-tertiary">
              {d}
            </span>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <span key={`empty-${i}`} />
            const v = formatDateValue(year, month, day)
            const isFrom = v === from
            const isTo = v === to
            const inRange = from && to && v > from && v < to
            const isToday = v === todayValue
            return (
              <button
                key={v}
                type="button"
                onClick={() => handleDayClick(v)}
                className={cn(
                  'mx-auto h-8 w-8 text-sm',
                  isFrom || isTo ? 'rounded-sm bg-primary text-primary-foreground' : 'rounded-sm text-text-primary hover:bg-overlay-active',
                  inRange && 'rounded-none bg-primary-soft text-text-primary hover:bg-primary-soft-hover',
                  isToday && !isFrom && !isTo && !inRange && 'font-semibold text-accent',
                )}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const nextMonthView = shiftMonth({ year: viewYear, month: viewMonth }, 1)
  const displayText = from && to ? `${formatDisplay(from)} – ${formatDisplay(to)}` : from ? `${formatDisplay(from)} – …` : placeholder

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-sm border border-border-medium bg-inset px-3 text-[16px] transition-shadow duration-150',
          from ? 'text-text-primary' : 'text-text-tertiary',
          'focus:border-accent focus:outline-none focus:shadow-focus disabled:opacity-50',
        )}
      >
        <span className="truncate">{displayText}</span>
        <CalendarIcon size={16} strokeWidth={1.75} className="ml-2 shrink-0 text-text-secondary" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-[36rem] max-w-[90vw] rounded-md border border-border-medium bg-surface-soft p-3 shadow-raised">
          <div className="flex items-center justify-between">
            <button type="button" onClick={goToPrevMonth} className="rounded-sm p-1 text-text-secondary hover:bg-overlay-active" aria-label="Předchozí měsíc">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-text-secondary">
              {!from ? 'Vyberte první den období' : !to ? 'Vyberte poslední den období' : 'Klikněte pro nový výběr'}
            </span>
            <button type="button" onClick={goToNextMonth} className="rounded-sm p-1 text-text-secondary hover:bg-overlay-active" aria-label="Následující měsíc">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-6">
            {renderMonth(viewYear, viewMonth)}
            {renderMonth(nextMonthView.year, nextMonthView.month)}
          </div>
        </div>
      )}
    </div>
  )
}
