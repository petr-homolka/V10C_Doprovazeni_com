import { describe, expect, it } from 'vitest'
import {
  RETENTION_CHILD_CARE_YEARS,
  RETENTION_RULES,
  isRetentionReviewDue,
  retentionReviewDueDate,
  describeRetention,
  isPastRetention,
  retentionCutoff,
  summarizeRetention,
  type RetentionRule,
} from './retentionPolicy'

const activeRule: RetentionRule = {
  key: 'test',
  label: 'Test',
  what: '',
  path: '',
  anchor: 'createdAt',
  keepMonths: 3,
  action: 'delete',
  basis: '',
  status: 'active',
}

const undecidedRule: RetentionRule = { ...activeRule, key: 'test2', keepMonths: null, status: 'needs_decision' }

const TODAY = new Date('2026-07-25T12:00:00.000Z')

describe('retentionCutoff', () => {
  it('odečte měsíce od dneška', () => {
    expect(retentionCutoff(activeRule, TODAY)?.slice(0, 10)).toBe('2026-04-25')
  })

  it('nerozhodnutá lhůta nemá hranici', () => {
    expect(retentionCutoff(undecidedRule, TODAY)).toBeNull()
  })
})

describe('isPastRetention', () => {
  it('starší záznam je za lhůtou', () => {
    expect(isPastRetention(activeRule, '2026-01-01T00:00:00.000Z', TODAY)).toBe(true)
  })

  it('novější záznam za lhůtou není', () => {
    expect(isPastRetention(activeRule, '2026-07-01T00:00:00.000Z', TODAY)).toBe(false)
  })

  /**
   * Tohle je ta nejdůležitější vlastnost celého souboru: dokud lhůta není
   * rozhodnutá, NIC není za lhůtou — ani záznam starý deset let. Systém
   * v pochybnostech drží, nemaže.
   */
  it('bez rozhodnuté lhůty není za lhůtou NIC, ani deset let starý záznam', () => {
    expect(isPastRetention(undecidedRule, '2016-01-01T00:00:00.000Z', TODAY)).toBe(false)
  })

  it('chybějící kotevní datum se nikdy nemaže', () => {
    expect(isPastRetention(activeRule, null, TODAY)).toBe(false)
    expect(isPastRetention(activeRule, undefined, TODAY)).toBe(false)
  })
})

describe('skutečná politika', () => {
  it('každé pravidlo bez lhůty je označené jako nerozhodnuté (a naopak)', () => {
    for (const rule of RETENTION_RULES) {
      expect(rule.keepMonths === null).toBe(rule.status === 'needs_decision')
    }
  })

  it('každé pravidlo má vysvětlení, proč zrovna tak', () => {
    for (const rule of RETENTION_RULES) {
      expect(rule.basis.length).toBeGreaterThan(30)
    }
  })

  it('klíče jsou jedinečné', () => {
    const keys = RETENTION_RULES.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('souhrn sedí', () => {
    const s = summarizeRetention()
    expect(s.total).toBe(RETENTION_RULES.length)
    expect(s.active + s.needsDecision).toBe(s.total)
  })
})

/**
 * Zadání 2026-07-25: 30 let je MINIMÁLNÍ doba uchování, po které se systém
 * ZEPTÁ — ne lhůta, po které maže. Tyhle testy hlídají přesně ten rozdíl,
 * protože záměna „review" za „delete" by znamenala automatické mazání
 * spisů dětí.
 */
describe('archivační doba dokumentace o dítěti', () => {
  it('je 30 let', () => {
    expect(RETENTION_CHILD_CARE_YEARS).toBe(30)
  })

  it('pravidlo pro ukončený spis se po lhůtě PTÁ, nemaže', () => {
    const rule = RETENTION_RULES.find((r) => r.key === 'closed_case_file')
    expect(rule?.action).toBe('review')
    expect(rule?.keepMonths).toBe(30 * 12)
    expect(rule?.status).toBe('active')
  })

  it('žádné pravidlo nemaže spis dítěte automaticky', () => {
    const rule = RETENTION_RULES.find((r) => r.key === 'closed_case_file')
    expect(rule?.action).not.toBe('delete')
    expect(rule?.action).not.toBe('anonymize')
  })

  it('termín revize je konec Dohody + 30 let', () => {
    expect(retentionReviewDueDate('2026-07-25T00:00:00.000Z').slice(0, 10)).toBe('2056-07-25')
  })

  it('revize se hlásí až po termínu', () => {
    const today = new Date('2026-07-25T12:00:00.000Z')
    expect(isRetentionReviewDue('2026-07-24T00:00:00.000Z', today)).toBe(true)
    expect(isRetentionReviewDue('2056-07-25T00:00:00.000Z', today)).toBe(false)
    expect(isRetentionReviewDue(null, today)).toBe(false)
    expect(isRetentionReviewDue(undefined, today)).toBe(false)
  })
})

describe('describeRetention', () => {
  it('měsíce', () => {
    expect(describeRetention(activeRule)).toBe('3 měsíce od vzniku záznamu')
  })

  it('roky', () => {
    expect(describeRetention({ ...activeRule, keepMonths: 24, anchor: 'agreementEnded' })).toBe(
      '2 roky od skončení Dohody',
    )
  })

  it('třicet let se řekne jako „30 let"', () => {
    expect(describeRetention({ ...activeRule, keepMonths: 360, anchor: 'agreementEnded' })).toBe(
      '30 let od skončení Dohody',
    )
  })

  it('nerozhodnuto se řekne nahlas', () => {
    expect(describeRetention(undecidedRule)).toContain('není rozhodnutá')
  })
})
