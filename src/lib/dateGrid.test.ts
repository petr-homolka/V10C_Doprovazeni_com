import { describe, expect, it } from 'vitest'
import { daysInMonth, firstWeekdayOfMonth, formatDateValue, formatDisplay, monthGridCells, parseDateValue } from './dateGrid'

describe('parseDateValue / formatDateValue', () => {
  it('round-trips a valid date', () => {
    expect(parseDateValue('2026-07-21')).toEqual({ year: 2026, month: 6, day: 21 })
    expect(formatDateValue(2026, 6, 21)).toBe('2026-07-21')
  })

  it('pads single-digit month/day', () => {
    expect(formatDateValue(2026, 0, 5)).toBe('2026-01-05')
  })

  it('rejects malformed input', () => {
    expect(parseDateValue('21.7.2026')).toBeNull()
    expect(parseDateValue('')).toBeNull()
  })
})

describe('formatDisplay', () => {
  it('formats as D. M. YYYY (Czech convention)', () => {
    expect(formatDisplay('2026-07-21')).toBe('21. 7. 2026')
  })

  it('returns empty string for an unparseable value', () => {
    expect(formatDisplay('')).toBe('')
  })
})

describe('firstWeekdayOfMonth', () => {
  it('2026-07-01 is a Wednesday -> index 2 (Monday=0)', () => {
    expect(firstWeekdayOfMonth(2026, 6)).toBe(2)
  })

  it('2026-06-01 is a Monday -> index 0', () => {
    expect(firstWeekdayOfMonth(2026, 5)).toBe(0)
  })
})

describe('daysInMonth', () => {
  it('handles a leap February', () => {
    expect(daysInMonth(2028, 1)).toBe(29)
  })

  it('handles a non-leap February', () => {
    expect(daysInMonth(2026, 1)).toBe(28)
  })

  it('handles 30 vs 31 day months', () => {
    expect(daysInMonth(2026, 3)).toBe(30) // April
    expect(daysInMonth(2026, 6)).toBe(31) // July
  })
})

describe('monthGridCells', () => {
  it('leading nulls match firstWeekdayOfMonth, followed by 1..N', () => {
    const cells = monthGridCells(2026, 6) // July 2026, starts Wednesday (index 2)
    expect(cells.slice(0, 2)).toEqual([null, null])
    expect(cells[2]).toBe(1)
    expect(cells.at(-1)).toBe(31)
    expect(cells).toHaveLength(2 + 31)
  })
})
