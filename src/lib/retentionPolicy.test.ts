import { describe, expect, it } from 'vitest'
import {
  RETENTION_CHILD_CARE_YEARS,
  RETENTION_RULES,
  applyRetentionOverrides,
  describeRetention,
  isPastRetention,
  isRetentionReviewDue,
  retentionCutoff,
  retentionReviewDueDate,
  summarizeRetention,
  type RetentionRule,
  validateRetentionOverride,
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

/**
 * NASTAVITELNÉ LHŮTY. Katalog v kódu drží význam kategorií, nastavení drží
 * čísla. Tyhle testy hlídají hlavně jednu věc: aby se z nastavení nedalo
 * omylem vyrobit mazání.
 */
describe('nastavení retenčních lhůt', () => {
  const NOW = new Date('2026-07-26T00:00:00.000Z')

  it('bez nastavení platí katalog', () => {
    expect(applyRetentionOverrides(null)).toEqual(RETENTION_RULES)
    expect(applyRetentionOverrides({})).toEqual(RETENTION_RULES)
  })

  it('nastavená lhůta pravidlo aktivuje', () => {
    const rules = applyRetentionOverrides({
      audit_log: { keepMonths: 60, action: 'delete', decidedAt: NOW.toISOString(), decidedByUid: 'super' },
    })
    const rule = rules.find((r) => r.key === 'audit_log')!
    expect(rule.keepMonths).toBe(60)
    expect(rule.status).toBe('active')
  })

  /** Rozhodnuté „nevím" je pořád nerozhodnuto — a nerozhodnuto nemaže. */
  it('prázdná lhůta vrací pravidlo do nerozhodnutého stavu', () => {
    const rules = applyRetentionOverrides({
      import_staging: { keepMonths: null, action: 'delete', decidedAt: NOW.toISOString(), decidedByUid: 'super' },
    })
    const rule = rules.find((r) => r.key === 'import_staging')!
    expect(rule.status).toBe('needs_decision')
    expect(retentionCutoff(rule, NOW)).toBeNull()
  })

  /** Přejmenovaná kategorie nesmí oživit mazání něčeho jiného. */
  it('nastavení pro neexistující klíč se ignoruje', () => {
    const rules = applyRetentionOverrides({
      uz_neexistuje: { keepMonths: 1, action: 'delete', decidedAt: NOW.toISOString(), decidedByUid: 'super' },
    })
    expect(rules).toEqual(RETENTION_RULES)
  })

  it('vlastní odůvodnění nahradí to z katalogu, prázdné ne', () => {
    const base = RETENTION_RULES.find((r) => r.key === 'messages')!
    const withNote = applyRetentionOverrides({
      messages: { keepMonths: 24, action: 'delete', note: 'Podle směrnice z 1. 8.', decidedAt: '', decidedByUid: 's' },
    }).find((r) => r.key === 'messages')!
    expect(withNote.basis).toBe('Podle směrnice z 1. 8.')

    const blankNote = applyRetentionOverrides({
      messages: { keepMonths: 24, action: 'delete', note: '   ', decidedAt: '', decidedByUid: 's' },
    }).find((r) => r.key === 'messages')!
    expect(blankNote.basis).toBe(base.basis)
  })

  it('nesmyslná lhůta neprojde validací', () => {
    expect(validateRetentionOverride({ keepMonths: 0, action: 'delete' })).toContain('aspoň jeden')
    expect(validateRetentionOverride({ keepMonths: -5, action: 'delete' })).toContain('aspoň jeden')
    expect(validateRetentionOverride({ keepMonths: 1.5, action: 'delete' })).toContain('celý počet')
    expect(validateRetentionOverride({ keepMonths: 5000, action: 'delete' })).toContain('překlep')
    expect(validateRetentionOverride({ keepMonths: null, action: 'review' })).toBeNull()
    expect(validateRetentionOverride({ keepMonths: 360, action: 'review' })).toBeNull()
  })
})
