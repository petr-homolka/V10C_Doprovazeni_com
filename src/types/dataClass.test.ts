import { describe, expect, it } from 'vitest'
import { dataClassOf, isTestData } from './dataClass'

/**
 * Jediná vlastnost, na které tady záleží: CO NENÍ OZNAČENÉ, JE OSTRÉ.
 *
 * Kdyby se chybějící pole četlo jako testovací, znamenala by jedna
 * zapomenutá migrace, že skutečné spisy dětí ztratí ochranu retenčními
 * pravidly. Proto je výchozí hodnota `live` a proto to má vlastní test.
 */
describe('dataClassOf', () => {
  it('bez pole → ostrá data', () => {
    expect(dataClassOf({})).toBe('live')
    expect(dataClassOf(null)).toBe('live')
    expect(dataClassOf(undefined)).toBe('live')
  })

  it('výslovné „test" → testovací', () => {
    expect(dataClassOf({ dataClass: 'test' })).toBe('test')
    expect(isTestData({ dataClass: 'test' })).toBe(true)
  })

  it('výslovné „live" → ostrá', () => {
    expect(dataClassOf({ dataClass: 'live' })).toBe('live')
    expect(isTestData({ dataClass: 'live' })).toBe(false)
  })

  it('nesmyslná hodnota se chová jako ostrá, ne jako testovací', () => {
    expect(dataClassOf({ dataClass: 'neco' as never })).toBe('live')
    expect(isTestData({ dataClass: '' as never })).toBe(false)
  })
})
