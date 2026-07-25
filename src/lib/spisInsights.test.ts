import { describe, expect, it } from 'vitest'
import {
  ageYears, buildCareLimits, dayCount, daysAgo, educationHoursInLastYear, lastSeenInPerson, nextVisitDue,
} from './spisInsights'
import type { AgreementDoc } from '@/types/agreement'
import type { CalendarEventDoc } from '@/types/calendarEvent'
import type { TimelineEntryDoc } from '@/types/timelineEntry'

const NOW = new Date('2026-07-25T09:30:00')

function visit(occurredAt: string, subjectRefs: TimelineEntryDoc['subjectRefs'] = [], body = 'Zápis.') {
  return { entry: { type: 'visit', occurredAt, subjectRefs, body } as unknown as TimelineEntryDoc }
}

function note(occurredAt: string) {
  return { entry: { type: 'note', occurredAt, subjectRefs: [], body: 'x' } as unknown as TimelineEntryDoc }
}

const agreement = {
  careType: 'zprostredkovana',
  status: 'active',
  validFrom: '2025-09-27T00:00:00.000Z',
  visitIntervalDays: 60,
  noteDeadlineHours: 72,
  lastVisitAt: '2026-05-27T10:00:00.000Z',
} as AgreementDoc

describe('dayCount', () => {
  it('skloňuje dny', () => {
    expect(dayCount(1)).toBe('1 den')
    expect(dayCount(3)).toBe('3 dny')
    expect(dayCount(9)).toBe('9 dní')
  })

  it('u záporné hodnoty (po termínu) nekreslí minus', () => {
    expect(dayCount(-2)).toBe('2 dny')
  })
})

describe('daysAgo', () => {
  it('počítá dny do minulosti', () => {
    expect(daysAgo('2026-07-22T10:00:00', NOW)).toBe(3)
  })
})

describe('ageYears', () => {
  it('počítá věk a bere v potaz, že letos ještě neměl narozeniny', () => {
    expect(ageYears('1979-04-12', NOW)).toBe(47)
    expect(ageYears('1979-11-02', NOW)).toBe(46)
  })

  it('bez data narození vrátí null (v profilu bude pomlčka)', () => {
    expect(ageYears(null, NOW)).toBeNull()
    expect(ageYears('', NOW)).toBeNull()
    expect(ageYears('nesmysl', NOW)).toBeNull()
  })
})

describe('lastSeenInPerson', () => {
  const entries = [
    visit('2026-07-22T10:00:00.000Z', [{ kind: 'child', id: 'c1' }]),
    visit('2026-05-27T10:00:00.000Z', [{ kind: 'child', id: 'c2' }]),
    note('2026-07-24T10:00:00.000Z'),
  ]

  it('dítěti se počítá jen návštěva, kde je uvedené jmenovitě', () => {
    expect(lastSeenInPerson(entries, { kind: 'child', id: 'c1' })).toBe('2026-07-22T10:00:00.000Z')
    expect(lastSeenInPerson(entries, { kind: 'child', id: 'c2' })).toBe('2026-05-27T10:00:00.000Z')
  })

  it('dítě, které v žádné návštěvě není, nemá datum', () => {
    expect(lastSeenInPerson(entries, { kind: 'child', id: 'c9' })).toBeNull()
  })

  it('pěstounovi se počítá každá návštěva v rodině', () => {
    expect(lastSeenInPerson(entries, { kind: 'fosterPerson', id: 'fp1' })).toBe('2026-07-22T10:00:00.000Z')
  })

  it('poznámka ani telefonát nejsou osobní kontakt', () => {
    expect(lastSeenInPerson([note('2026-07-24T10:00:00.000Z')], { kind: 'fosterPerson', id: 'fp1' })).toBeNull()
  })
})

describe('educationHoursInLastYear', () => {
  function event(start: string, end: string, kind = 'vzdelavani', status = 'planovano') {
    return { event: { kind, status, start, end } as unknown as CalendarEventDoc }
  }

  it('sečte délku vzdělávacích událostí', () => {
    const hours = educationHoursInLastYear(
      [
        event('2026-03-27T09:00:00.000Z', '2026-03-27T17:00:00.000Z'),
        event('2026-06-08T10:00:00.000Z', '2026-06-08T16:00:00.000Z'),
      ],
      NOW,
    )
    expect(hours).toBe(14)
  })

  it('nepočítá jiné typy, zrušené, ani starší než rok', () => {
    const hours = educationHoursInLastYear(
      [
        event('2026-06-08T10:00:00.000Z', '2026-06-08T16:00:00.000Z', 'schuzka'),
        event('2026-06-09T10:00:00.000Z', '2026-06-09T16:00:00.000Z', 'vzdelavani', 'zruseno'),
        event('2024-06-08T10:00:00.000Z', '2024-06-08T16:00:00.000Z'),
      ],
      NOW,
    )
    expect(hours).toBe(0)
  })
})

describe('nextVisitDue', () => {
  it('poslední návštěva + interval z Dohody', () => {
    const due = nextVisitDue(agreement, NOW)!
    expect(due.at.toISOString().slice(0, 10)).toBe('2026-07-26')
    expect(due.daysLeft).toBe(1)
    expect(due.overdue).toBe(false)
  })

  it('bez poslední návštěvy termín neexistuje', () => {
    expect(nextVisitDue({ visitIntervalDays: 60, lastVisitAt: null }, NOW)).toBeNull()
  })

  it('propadlý termín pozná', () => {
    const due = nextVisitDue({ visitIntervalDays: 60, lastVisitAt: '2026-01-01T10:00:00.000Z' }, NOW)!
    expect(due.overdue).toBe(true)
  })
})

describe('buildCareLimits', () => {
  const entries = [visit('2026-07-22T10:00:00.000Z')]

  it('bez Dohody nejsou lhůty (nemá je z čeho počítat)', () => {
    expect(buildCareLimits({ agreement: null, entries, educationHours: 0, now: NOW })).toEqual([])
  })

  it('vrátí návštěvu, vzdělávání a zápis', () => {
    const limits = buildCareLimits({ agreement, entries, educationHours: 14, now: NOW })
    expect(limits.map((l) => l.id)).toEqual(['navsteva', 'vzdelavani', 'zapis'])
  })

  it('u návštěvy počítá spotřebovanou část intervalu', () => {
    const [visitLimit] = buildCareLimits({ agreement, entries, educationHours: 14, now: NOW })
    expect(visitLimit.done).toBe(59)
    expect(visitLimit.target).toBe(60)
    expect(visitLimit.state).toBe('zbývá 1 den')
    expect(visitLimit.tone).toBe('blizko')
  })

  it('propadlá návštěva je červená a řekne o kolik', () => {
    const [visitLimit] = buildCareLimits({
      agreement: { ...agreement, lastVisitAt: '2026-05-01T10:00:00.000Z' },
      entries,
      educationHours: 14,
      now: NOW,
    })
    expect(visitLimit.tone).toBe('po')
    expect(visitLimit.state).toBe('po termínu o 25 dní')
  })

  it('cíl hodin bere z Dohody, jinak ze zákona podle typu péče', () => {
    const [, education] = buildCareLimits({ agreement, entries, educationHours: 14, now: NOW })
    expect(education.target).toBe(24)
    expect(education.state).toBe('chybí 10 h')

    const [, kinship] = buildCareLimits({
      agreement: { ...agreement, careType: 'nezprostredkovana' },
      entries,
      educationHours: 14,
      now: NOW,
    })
    expect(kinship.target).toBe(18)
  })

  it('splněné vzdělávání je klidné', () => {
    const [, education] = buildCareLimits({ agreement, entries, educationHours: 30, now: NOW })
    expect(education.state).toBe('splněno')
    expect(education.tone).toBe('ok')
    // Pruh se nepřeteče přes limit.
    expect(education.done).toBe(24)
  })

  it('napsaný zápis z poslední návštěvy je splněná lhůta', () => {
    const [, , note] = buildCareLimits({ agreement, entries, educationHours: 14, now: NOW })
    expect(note.state).toBe('splněno')
    expect(note.tone).toBe('ok')
  })

  it('chybějící zápis po lhůtě je červený', () => {
    const limits = buildCareLimits({
      agreement,
      entries: [visit('2026-07-20T10:00:00.000Z', [], '')],
      educationHours: 14,
      now: NOW,
    })
    const note = limits.find((l) => l.id === 'zapis')!
    expect(note.tone).toBe('po')
  })

  it('bez jediné návštěvy se lhůta zápisu neukazuje', () => {
    const limits = buildCareLimits({ agreement, entries: [], educationHours: 14, now: NOW })
    expect(limits.some((l) => l.id === 'zapis')).toBe(false)
  })
})
