import { describe, expect, it } from 'vitest'
import { checkEmail, checkPhone } from './contactValidation'

describe('checkEmail', () => {
  it('trims and lowercases a valid address', () => {
    expect(checkEmail('  Jmeno@Priklad.CZ  ')).toEqual({ value: 'jmeno@priklad.cz', ok: true })
  })

  it('allows empty (required-ness is a separate concern)', () => {
    expect(checkEmail('   ')).toEqual({ value: '', ok: true })
  })

  it('rejects a missing @ with a friendly message', () => {
    const result = checkEmail('jmeno.priklad.cz')
    expect(result.ok).toBe(false)
    expect(result.message).toBeTruthy()
  })
})

describe('checkPhone', () => {
  it('adds missing +420 to a bare 9-digit number', () => {
    expect(checkPhone('601234567')).toEqual({ value: '+420 601 234 567', ok: true })
  })

  it('strips spaces/dashes and reformats', () => {
    expect(checkPhone('601-234 567')).toEqual({ value: '+420 601 234 567', ok: true })
  })

  it('normalizes an explicit +420 number', () => {
    expect(checkPhone('+420601234567')).toEqual({ value: '+420 601 234 567', ok: true })
  })

  it('converts a leading 00 to +', () => {
    expect(checkPhone('00420601234567')).toEqual({ value: '+420 601 234 567', ok: true })
  })

  it('leaves a plausible foreign number alone', () => {
    expect(checkPhone('+421 901 234 567')).toEqual({ value: '+421901234567', ok: true })
  })

  it('allows empty (required-ness is a separate concern)', () => {
    expect(checkPhone('  ')).toEqual({ value: '', ok: true })
  })

  it('rejects too few digits with a friendly message', () => {
    const result = checkPhone('12345')
    expect(result.ok).toBe(false)
    expect(result.message).toBeTruthy()
  })

  it('rejects too many digits with a friendly message', () => {
    const result = checkPhone('601234567890123')
    expect(result.ok).toBe(false)
    expect(result.message).toBeTruthy()
  })
})
