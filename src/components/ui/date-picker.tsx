import { useEffect, useRef, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { daysInMonth, firstWeekdayOfMonth, formatDateValue, formatDisplay, parseDateValue } from '@/lib/dateGrid'

const WEEKDAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const MONTH_LABELS = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
]

/**
 * Vlastní kalendářový výběr data — náhrada nativního `<input type="date">`,
 * jehož vzhled se liší prohlížeč od prohlížeče/OS a nesedí do designu.
 * Hodnota/formát ('YYYY-MM-DD') je stejný jako u nativního inputu, takže
 * je to přímá náhrada beze změny okolní logiky/serializace. Funguje čistě
 * na klik/klepnutí (žádné hover-only ovládání) — důležité pro PWA/mobil.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Vybrat datum',
  className,
  disabled,
  min,
  max,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  min?: string
  max?: string
}) {
  const [open, setOpen] = useState(false)
  const parsed = parseDateValue(value)
  const today = new Date()
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth())
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (open && parsed) {
      setViewYear(parsed.year)
      setViewMonth(parsed.month)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const minParsed = min ? parseDateValue(min) : null
  const maxParsed = max ? parseDateValue(max) : null

  function isDisabledDay(year: number, month: number, day: number): boolean {
    const v = formatDateValue(year, month, day)
    if (minParsed && v < formatDateValue(minParsed.year, minParsed.month, minParsed.day)) return true
    if (maxParsed && v > formatDateValue(maxParsed.year, maxParsed.month, maxParsed.day)) return true
    return false
  }

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }
  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const leading = firstWeekdayOfMonth(viewYear, viewMonth)
  const total = daysInMonth(viewYear, viewMonth)
  const cells: Array<number | null> = [...Array(leading).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
  const todayValue = formatDateValue(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-sm border border-transparent bg-field px-3 text-lg transition-shadow duration-150',
          value ? 'text-text-primary' : 'text-text-tertiary',
          'focus:border-accent focus:outline-none focus:shadow-focus disabled:opacity-50',
        )}
      >
        <span className="truncate">{value ? formatDisplay(value) : placeholder}</span>
        <CalendarIcon size={16} strokeWidth={1.75} className="ml-2 shrink-0 text-text-secondary" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 rounded-md border border-border-medium bg-surface-soft p-3 shadow-raised">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="rounded-sm p-1 text-text-secondary hover:bg-overlay-active"
              aria-label="Předchozí měsíc"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-text-primary">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="rounded-sm p-1 text-text-secondary hover:bg-overlay-active"
              aria-label="Následující měsíc"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-y-0.5 text-center">
            {WEEKDAY_LABELS.map((d) => (
              <span key={d} className="text-xs text-text-tertiary">
                {d}
              </span>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <span key={`empty-${i}`} />
              const v = formatDateValue(viewYear, viewMonth, day)
              const isSelected = v === value
              const isToday = v === todayValue
              const dayDisabled = isDisabledDay(viewYear, viewMonth, day)
              return (
                <button
                  key={v}
                  type="button"
                  disabled={dayDisabled}
                  onClick={() => {
                    onChange(v)
                    setOpen(false)
                  }}
                  className={cn(
                    'mx-auto h-8 w-8 rounded-sm text-sm',
                    isSelected ? 'bg-primary text-primary-foreground' : 'text-text-primary hover:bg-overlay-active',
                    isToday && !isSelected ? 'font-semibold text-accent' : '',
                    dayDisabled ? 'cursor-not-allowed opacity-30 hover:bg-transparent' : '',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
