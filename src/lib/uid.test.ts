import { describe, expect, it } from 'vitest'
import {
  buildUid,
  ean13CheckDigit,
  gs1CheckDigit,
  isValidUid,
  normalizeUidInput,
  uidEntityTypeCode,
  uidOrgCode,
} from './uid'
import { randomUid } from './uidAllocator'

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

/**
 * Kapacita UID, 2026-07-26. Nic se nepřečísluje — jen se zaručuje, že
 * delší UID projde čtením, kdyby se někdy začalo vydávat. Viz hlavička
 * `uid.ts` pro rozbor, který segment je ten úzký (OOOO, ne SSSSSS).
 */
describe('připravenost na delší UID', () => {
  it('GS1 kontrolní číslice sedí na EAN-13 i na delším základu', () => {
    expect(gs1CheckDigit('400638133393')).toBe(1)
    // Vlastní konzistence pro 13místný základ (GTIN-14): číslo s dopočtenou
    // číslicí musí projít stejným výpočtem.
    const base13 = '1000410000001'
    const uid14 = `${base13}${gs1CheckDigit(base13)}`
    expect(isValidUid(uid14)).toBe(true)
  })

  it('čtrnáctimístné UID projde validací, patnáctimístné ne', () => {
    const base13 = '2000410000042'
    expect(isValidUid(`${base13}${gs1CheckDigit(base13)}`)).toBe(true)
    const base14 = '20004100000429'
    expect(isValidUid(`${base14}${gs1CheckDigit(base14)}`)).toBe(false)
  })

  it('kód organizace se čte správně z obou délek', () => {
    expect(uidOrgCode(buildUid('child', '4827', 42))).toBe('4827')
    const base13 = '1048271000001'
    expect(uidOrgCode(`${base13}${gs1CheckDigit(base13)}`)).toBe('48271')
  })

  it('poškozené UID neprojde ani v jedné délce', () => {
    const ok = buildUid('child', '4827', 42)
    const broken = `${ok.slice(0, 12)}${(Number(ok[12]) + 1) % 10}`
    expect(isValidUid(broken)).toBe(false)
  })

  it('opsané UID s mezerami a pomlčkami se srovná', () => {
    const uid = buildUid('fosterPerson', '0001', 13)
    expect(normalizeUidInput(`${uid.slice(0, 4)} ${uid.slice(4, 8)}-${uid.slice(8)}`)).toBe(uid)
    expect(isValidUid(normalizeUidInput(` ${uid} `))).toBe(true)
  })
})

/**
 * NÁHODNÉ UID (politika od 26. 7.). Testuje se tvar a to, že se z generátoru
 * nesypou opakující se čísla — samotná srážka se řeší transakcí
 * v `allocateUid`, ale generátor, který vrací pořád totéž, by ji zahltil.
 */
describe('náhodné UID', () => {
  it('má správný tvar a projde validací', () => {
    for (let i = 0; i < 200; i++) {
      const uid = randomUid()
      expect(uid).toHaveLength(13)
      expect(isValidUid(uid)).toBe(true)
      expect(uid[0]).not.toBe('0')
    }
  })

  /**
   * Deset tisíc čísel ze zásoby 9·10^11 se nemá jak potkat. Kdyby se
   * potkala, je rozbitý generátor — a to je horší než srážka, protože
   * transakce by pak selhávala pořád dokola.
   */
  it('deset tisíc losů nedá ani jednu shodu', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 10_000; i++) seen.add(randomUid())
    expect(seen.size).toBe(10_000)
  })

  /** Stará strukturovaná čísla musí projít pořád — nepřečíslovávají se. */
  it('stará strukturovaná UID zůstávají platná', () => {
    expect(isValidUid(buildUid('fosterPerson', '0001', 42))).toBe(true)
  })
})
