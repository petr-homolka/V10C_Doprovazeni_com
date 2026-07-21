import { formatDateValue, parseDateValue } from './dateGrid'

/**
 * Předpokládaná délka Dohody — kaskáda (§47b zákona 359/1999 Sb.: reálná
 * doba platnosti závisí na typu péče — dlouhodobí pěstouni typicky po
 * dobu svěření konkrétního dítěte, přechodní pěstouni max. 3 roky dle
 * evidence KÚ — appka NEMŮŽE vědět, který případ nastane, proto jen
 * nabízí rozumný výchozí odhad k předvyplnění, nikdy nevynucuje):
 * per-organizace `agreementDefaultDurationMonths` → platformní
 * `platformDefaults.agreementDefaultDurationMonths`. KO/vedení může
 * navržené "Platí do" na Dohodě kdykoli přepsat ručně.
 */
export function computeEffectiveAgreementDurationMonths(
  orgDurationMonths: number | null | undefined,
  platformDurationMonths: number,
): number {
  return orgDurationMonths ?? platformDurationMonths
}

/** Přičte N měsíců k datu (`YYYY-MM-DD`) — přetečení dne do kratšího
 * měsíce ořízne na jeho poslední den (např. 31. 1. + 1 měsíc → 28./29. 2.,
 * ne 3. 3.), stejné chování jako běžné kalendářní "o měsíc později". */
export function addMonthsToDateValue(value: string, months: number): string {
  const parsed = parseDateValue(value)
  if (!parsed) return value
  const targetMonthIndex = parsed.year * 12 + parsed.month + months
  const targetYear = Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  const day = Math.min(parsed.day, lastDayOfTargetMonth)
  return formatDateValue(targetYear, targetMonth, day)
}
