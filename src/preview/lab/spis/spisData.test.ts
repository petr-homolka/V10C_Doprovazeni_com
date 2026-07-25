import { describe, expect, it } from 'vitest'
import { buildLimits, buildPeople, buildSpis, dayCount, nextVisitDue } from './spisData'

/**
 * Návrh profilu stojí na čtyřech ČÍSLECH (lhůta návštěvy, hodiny vzdělávání,
 * „naposledy osobně" u každého člověka, jeden tok času). Kdyby se počítala
 * špatně, obrazovka by lhala — a to je horší než ošklivá obrazovka, protože
 * se to nepozná pohledem. Proto jsou v `spisData.ts` čisté funkce a proto
 * mají testy, i když je to (zatím) jen designový náhled.
 */
describe('dayCount', () => {
  it('skloňuje dny podle češtiny', () => {
    expect(dayCount(1)).toBe('1 den')
    expect(dayCount(2)).toBe('2 dny')
    expect(dayCount(4)).toBe('4 dny')
    expect(dayCount(5)).toBe('5 dní')
    expect(dayCount(60)).toBe('60 dní')
  })

  it('bere i zápornou hodnotu (po termínu) a nekreslí minus', () => {
    expect(dayCount(-3)).toBe('3 dny')
  })
})

describe('nextVisitDue', () => {
  it('spočítá termín z poslední návštěvy a intervalu z Dohody', () => {
    const due = nextVisitDue()
    // Vzorová data: poslední návštěva 58 dní zpět, interval 60 dní.
    expect(due.overdue).toBe(false)
    expect(due.daysLeft).toBeGreaterThan(0)
    expect(due.daysLeft).toBeLessThanOrEqual(3)
  })
})

describe('buildPeople', () => {
  const people = buildPeople()

  it('vrátí všechny pěstouny i děti rodiny', () => {
    expect(people.map((p) => p.name)).toEqual([
      'Jana Novotná',
      'Petr Novotný',
      'Adélka Novotná',
      'Dominik Novotný',
    ])
  })

  it('u dítěte bez jmenovité návštěvy je „naposledy osobně" starší než u ostatních', () => {
    const adelka = people.find((p) => p.name === 'Adélka Novotná')!
    const dominik = people.find((p) => p.name === 'Dominik Novotný')!
    expect(adelka.lastSeen).not.toBeNull()
    expect(dominik.lastSeen).not.toBeNull()
    // Adélka je v poslední návštěvě uvedená, Dominik až v té předchozí —
    // právě tenhle rozdíl má obrazovka ukázat.
    expect(adelka.lastSeen!.getTime()).toBeGreaterThan(dominik.lastSeen!.getTime())
  })

  it('pěstounům se počítá každá návštěva v rodině', () => {
    const jana = people.find((p) => p.name === 'Jana Novotná')!
    const adelka = people.find((p) => p.name === 'Adélka Novotná')!
    expect(jana.lastSeen?.getTime()).toBe(adelka.lastSeen?.getTime())
  })
})

describe('buildLimits', () => {
  const limits = buildLimits()

  it('vrátí tři lhůty v pořadí návštěva → vzdělávání → zápis', () => {
    expect(limits.map((l) => l.id)).toEqual(['navsteva', 'vzdelavani', 'zapis'])
  })

  it('hodiny vzdělávání sečte z DÉLKY vzdělávacích událostí', () => {
    const education = limits.find((l) => l.id === 'vzdelavani')!
    // 8 h (blok 1) + 6 h (blok 2) z posledních 12 měsíců, limit 24 h.
    expect(education.done).toBe(14)
    expect(education.target).toBe(24)
    expect(education.state).toBe('chybí 10 h')
  })

  it('u splněné lhůty je tón klidný, i když je pruh plný', () => {
    const note = limits.find((l) => l.id === 'zapis')!
    expect(note.state).toBe('splněno')
    expect(note.tone).toBe('ok')
  })
})

describe('buildSpis', () => {
  const spis = buildSpis()

  it('řadí celý spis od nejnovějšího', () => {
    const times = spis.map((i) => new Date(i.at).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('obsahuje i lhůtu návštěvy — budoucí bod, který nikde jinde není', () => {
    expect(spis.some((i) => i.kind === 'lhuta')).toBe(true)
  })

  it('nepustí do spisu záznamy jiné rodiny', () => {
    expect(spis.some((i) => i.title.includes('Supervize'))).toBe(false)
  })
})
