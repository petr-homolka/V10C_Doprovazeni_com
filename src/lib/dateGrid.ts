/** Čistá kalendářní logika pro DatePicker — odděleno od komponenty, aby šlo
 * otestovat bez DOM. Hodnoty appky jsou vždy 'YYYY-MM-DD' (stejný formát
 * jako nativní `<input type="date">`, který nahrazujeme), VŽDY počítáno
 * z místních Y/M/D složek, nikdy přes `new Date('YYYY-MM-DD')` (ten
 * parsuje jako UTC půlnoc a v západních časových pásmech by posunul den
 * o jeden zpátky při zobrazení). */

export interface DateParts {
  year: number
  month: number // 0-11
  day: number
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function parseDateValue(value: string): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) }
}

export function formatDateValue(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

export function formatDisplay(value: string): string {
  const parsed = parseDateValue(value)
  if (!parsed) return ''
  return `${parsed.day}. ${parsed.month + 1}. ${parsed.year}`
}

/** Pondělí = 0 ... neděle = 6 (na rozdíl od `Date#getDay()`, kde je to neděle = 0). */
export function firstWeekdayOfMonth(year: number, month: number): number {
  const jsDay = new Date(year, month, 1).getDay()
  return (jsDay + 6) % 7
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Mřížka pro kalendář — `null` = prázdná buňka před 1. dnem měsíce. */
export function monthGridCells(year: number, month: number): Array<number | null> {
  const leading = firstWeekdayOfMonth(year, month)
  const total = daysInMonth(year, month)
  return [...Array(leading).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
}
