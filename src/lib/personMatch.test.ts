import { describe, expect, it } from 'vitest'
import { buildMatchKeys, matchKeyHash, matchKeyMaterial, normalizeToken } from './personMatch'

describe('srovnání zápisu', () => {
  it('diakritika a interpunkce nerozhodují o tom, jestli se člověk najde', () => {
    expect(normalizeToken('Jiří')).toBe('jiri')
    expect(normalizeToken('900101/1234')).toBe('9001011234')
    expect(normalizeToken('  Nováková ')).toBe('novakova')
  })
})

describe('materiál klíče', () => {
  it('druh klíče je jeho součástí — stejné číslo jako občanka a jako pas se nesmí potkat', () => {
    const op = matchKeyMaterial('obcansky_prukaz', ['123456789'])
    const pas = matchKeyMaterial('cestovni_pas', ['123456789'])
    expect(op).not.toBe(pas)
  })

  it('rodné číslo se najde bez ohledu na lomítko', () => {
    expect(matchKeyMaterial('rodne_cislo', ['900101/1234'])).toBe(
      matchKeyMaterial('rodne_cislo', ['9001011234']),
    )
  })

  /** Krátká hodnota se snadno uhodne a stejně nikoho neurčí. */
  it('příliš krátká hodnota klíč nedá', () => {
    expect(matchKeyMaterial('obcansky_prukaz', ['12'])).toBeNull()
  })

  it('chybějící část skládaného klíče ho zruší celý', () => {
    expect(matchKeyMaterial('jmeno_adresa', ['Jana', 'Nováková', ''])).toBeNull()
  })
})

describe('otisk', () => {
  it('je stabilní a pro různé vstupy různý', async () => {
    const a = await matchKeyHash('rodne_cislo', ['900101/1234'])
    const b = await matchKeyHash('rodne_cislo', ['9001011234'])
    const c = await matchKeyHash('rodne_cislo', ['900101/1235'])
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  /** Otisk je jednosměrný — v indexu nesmí být hodnota čitelná. */
  it('hodnota se v otisku neobjeví', async () => {
    const hash = await matchKeyHash('rodne_cislo', ['9001011234'])
    expect(hash).not.toContain('9001011234')
  })
})

describe('sada klíčů pro jednu osobu', () => {
  it('organizace nemá vždycky totéž — proto klíčů víc', async () => {
    const keys = await buildMatchKeys({
      firstName: 'Jana',
      lastName: 'Nováková',
      birthNumber: '9001011234',
      address: 'Dlouhá 5, Praha',
      courtFileNumbers: ['12 P 45/2023'],
      childNames: ['Petr Novák'],
    })
    expect(keys.map((k) => k.kind).sort()).toEqual(
      ['cislo_rozsudku', 'jmeno_adresa', 'jmeno_dite', 'rodne_cislo'].sort(),
    )
    expect(new Set(keys.map((k) => k.hash)).size).toBe(keys.length)
  })

  it('ze samotného jména se klíč nedělá — to by spojovalo cizí lidi', async () => {
    const keys = await buildMatchKeys({ firstName: 'Jana', lastName: 'Nováková' })
    expect(keys).toEqual([])
  })

  it('stačí i jediný identifikátor', async () => {
    const keys = await buildMatchKeys({ birthNumber: '9001011234' })
    expect(keys).toHaveLength(1)
    expect(keys[0].kind).toBe('rodne_cislo')
  })
})
