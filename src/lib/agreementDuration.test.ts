import { describe, expect, it } from 'vitest'
import { addMonthsToDateValue, computeEffectiveAgreementDurationMonths } from './agreementDuration'

describe('computeEffectiveAgreementDurationMonths', () => {
  it('uses the org override when set', () => {
    expect(computeEffectiveAgreementDurationMonths(36, 24)).toBe(36)
  })

  it('falls back to the platform default when org has none', () => {
    expect(computeEffectiveAgreementDurationMonths(null, 24)).toBe(24)
    expect(computeEffectiveAgreementDurationMonths(undefined, 24)).toBe(24)
  })
})

describe('addMonthsToDateValue', () => {
  it('adds whole months within the same year', () => {
    expect(addMonthsToDateValue('2026-01-15', 2)).toBe('2026-03-15')
  })

  it('rolls over into the next year', () => {
    expect(addMonthsToDateValue('2026-11-01', 3)).toBe('2027-02-01')
  })

  it('handles the standard 24-month default', () => {
    expect(addMonthsToDateValue('2026-07-21', 24)).toBe('2028-07-21')
  })

  it('clamps day-of-month overflow to the shorter target month (31 Jan + 1mo -> 28/29 Feb)', () => {
    expect(addMonthsToDateValue('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsToDateValue('2028-01-31', 1)).toBe('2028-02-29') // leap year
  })

  it('handles negative months (going backwards)', () => {
    expect(addMonthsToDateValue('2026-03-15', -2)).toBe('2026-01-15')
  })

  it('returns the input unchanged for an unparseable value', () => {
    expect(addMonthsToDateValue('', 24)).toBe('')
    expect(addMonthsToDateValue('bogus', 24)).toBe('bogus')
  })
})
