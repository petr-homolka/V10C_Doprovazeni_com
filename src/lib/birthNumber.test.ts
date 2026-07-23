import { describe, expect, it } from 'vitest'
import { birthDateFromBirthNumber, resolveChildBirthDate } from './birthNumber'

describe('birthDateFromBirthNumber', () => {
  it('parses a standard male birth number (2000s)', () => {
    expect(birthDateFromBirthNumber('0501011234')).toBe('2005-01-01')
  })

  it('parses a female birth number (month +50)', () => {
    expect(birthDateFromBirthNumber('1160101234')).toBe('2011-10-10')
  })

  it('parses a male overflow birth number (month +20, post-2004)', () => {
    expect(birthDateFromBirthNumber('0521011234')).toBe('2005-01-01')
  })

  it('parses a female overflow birth number (month +70, post-2004)', () => {
    expect(birthDateFromBirthNumber('0571011234')).toBe('2005-01-01')
  })

  it('accepts a slash in the input and strips it', () => {
    expect(birthDateFromBirthNumber('050101/1234')).toBe('2005-01-01')
  })

  it('accepts the 9-digit pre-1954 format', () => {
    expect(birthDateFromBirthNumber('300101123')).toBe('1930-01-01')
  })

  it('rejects an invalid month', () => {
    expect(birthDateFromBirthNumber('0599011234')).toBeNull()
  })

  it('rejects an invalid day', () => {
    expect(birthDateFromBirthNumber('0501991234')).toBeNull()
  })

  it('rejects malformed length', () => {
    expect(birthDateFromBirthNumber('12345')).toBeNull()
  })

  it('never returns a date in the future', () => {
    // "99" resolves to neither 2099 (future) nor a valid 1999-02-30 — must
    // fall back to null rather than silently picking a future date.
    expect(birthDateFromBirthNumber('9902301234')).toBeNull()
  })
})

describe('resolveChildBirthDate', () => {
  it('prefers an explicitly stored birthDate over the derived one', () => {
    expect(resolveChildBirthDate({ birthDate: '1999-05-05', birthNumber: '0501011234' })).toBe('1999-05-05')
  })

  it('falls back to deriving from birthNumber when birthDate is unset', () => {
    expect(resolveChildBirthDate({ birthNumber: '0501011234' })).toBe('2005-01-01')
  })

  it('returns null when neither is available/derivable', () => {
    expect(resolveChildBirthDate({ birthNumber: 'invalid' })).toBeNull()
  })
})
