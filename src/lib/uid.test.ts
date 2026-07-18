import { describe, expect, it } from 'vitest'
import { buildUid, ean13CheckDigit, isValidUid, uidEntityTypeCode } from './uid'

describe('ean13CheckDigit', () => {
  it('matches the known EAN-13 example (400638133393 -> 1)', () => {
    // Standard textbook EAN-13 example, used as an independent cross-check
    // that the weighting (odd=1, even=3, left-to-right) is implemented
    // the standard way, not just self-consistently.
    expect(ean13CheckDigit('400638133393')).toBe(1)
  })

  it('rejects a base that is not exactly 12 digits', () => {
    expect(() => ean13CheckDigit('123')).toThrow()
    expect(() => ean13CheckDigit('12345678901234')).toThrow()
  })
})

describe('buildUid / isValidUid', () => {
  it('builds a 13-digit UID starting with the entity type code', () => {
    const uid = buildUid('child', '4827', 42)
    expect(uid).toHaveLength(13)
    expect(uid.startsWith('20')).toBe(true)
    expect(uidEntityTypeCode(uid)).toBe('20')
  })

  it('round-trips through isValidUid', () => {
    const uid = buildUid('familyFile', '4827', 999999)
    expect(isValidUid(uid)).toBe(true)
  })

  it('never starts with 0 for any defined entity type', () => {
    const types = ['fosterPerson', 'child', 'keyWorker', 'staffMember',
      'externalCollaborator', 'externalOrganization', 'educationProvider',
      'childServiceProvider', 'agreement', 'familyFile'] as const
    for (const t of types) {
      const uid = buildUid(t, '0001', 1)
      expect(uid[0]).not.toBe('0')
    }
  })

  it('detects a corrupted check digit', () => {
    const uid = buildUid('child', '4827', 42)
    const corrupted = uid.slice(0, 12) + String((Number(uid[12]) + 1) % 10)
    expect(isValidUid(corrupted)).toBe(false)
  })

  it('rejects out-of-range sequence numbers', () => {
    expect(() => buildUid('child', '4827', 0)).toThrow()
    expect(() => buildUid('child', '4827', 1_000_000)).toThrow()
  })
})
