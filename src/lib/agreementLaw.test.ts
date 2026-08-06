import { describe, expect, it } from 'vitest'
import {
  AGREEMENT_DEADLINE_DAYS,
  WIND_DOWN_DAYS,
  canOpenNewTitle,
  planAgreementEnd,
  daysToTitleDeadline,
  halfYearEnd,
  isWithinWindDown,
  nextHalfYearEnd,
  nextTitleStartDate,
  terminationEffectiveDate,
  titleDeadline,
  windDownEnd,
  type LegalTitleState,
} from './agreementLaw'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const day = (date: Date) => date.toISOString().slice(0, 10)

describe('pololetí', () => {
  it('první pololetí končí 30. 6., druhé 31. 12.', () => {
    expect(day(halfYearEnd(d('2026-02-10')))).toBe('2026-06-30')
    expect(day(halfYearEnd(d('2026-06-30')))).toBe('2026-06-30')
    expect(day(halfYearEnd(d('2026-07-01')))).toBe('2026-12-31')
    expect(day(halfYearEnd(d('2026-12-31')))).toBe('2026-12-31')
  })

  it('následující pololetí přechází i přes rok', () => {
    expect(day(nextHalfYearEnd(d('2026-02-10')))).toBe('2026-12-31')
    expect(day(nextHalfYearEnd(d('2026-08-10')))).toBe('2027-06-30')
  })
})

/**
 * § 47c odst. 5, 6. Tohle je to pravidlo, kvůli kterému se přechod
 * k jiné organizaci nedá „stihnout do měsíce" — a kvůli kterému padl
 * náš dřívější předpoklad o volném převodu kdykoli.
 */
describe('kdy dohoda skutečně zanikne', () => {
  it('výpověď v dostatečném předstihu ukončí dohodu k témuž pololetí', () => {
    expect(day(terminationEffectiveDate(d('2026-03-01')))).toBe('2026-06-30')
    expect(day(terminationEffectiveDate(d('2026-10-01')))).toBe('2026-12-31')
  })

  it('přesně 30 dnů předem ještě stačí', () => {
    expect(day(terminationEffectiveDate(d('2026-05-31')))).toBe('2026-06-30')
  })

  it('o den později už se konec posouvá o celé pololetí', () => {
    expect(day(terminationEffectiveDate(d('2026-06-01')))).toBe('2026-12-31')
  })

  it('kdo podá výpověď v polovině června, končí až na Silvestra', () => {
    expect(day(terminationEffectiveDate(d('2026-06-15')))).toBe('2026-12-31')
  })

  it('pozdní výpověď na konci roku přetéká do dalšího roku', () => {
    expect(day(terminationEffectiveDate(d('2026-12-20')))).toBe('2027-06-30')
  })

  it('nová dohoda navazuje hned dalším dnem', () => {
    expect(day(nextTitleStartDate(d('2026-06-30')))).toBe('2026-07-01')
    expect(day(nextTitleStartDate(d('2026-12-31')))).toBe('2027-01-01')
  })
})

describe('lhůta na uzavření právního titulu', () => {
  it('je 30 dnů od právní moci', () => {
    expect(AGREEMENT_DEADLINE_DAYS).toBe(30)
    expect(day(titleDeadline(d('2026-07-01')))).toBe('2026-07-31')
  })

  it('odpočet umí i zápornou hodnotu, když je po termínu', () => {
    expect(daysToTitleDeadline(d('2026-07-01'), d('2026-07-20'))).toBe(11)
    expect(daysToTitleDeadline(d('2026-07-01'), d('2026-08-10'))).toBe(-10)
  })
})

/**
 * NEJDŮLEŽITĚJŠÍ PRAVIDLO CELÉHO SOUBORU. Metodika MPSV: „Osoba pečující
 * nebo osoba v evidenci může mít v daném čase uzavřenu pouze jednu dohodu
 * s jedním doprovázejícím subjektem."
 *
 * Vyvrací to dřívější zadání, podle kterého mohl pěstoun podepsat dohodu
 * na každé dítě zvlášť s jinou organizací.
 */
describe('nejvýš jeden aktivní právní titul', () => {
  const bezici: LegalTitleState = { organizationId: 'org-A', validFrom: '2025-01-01T00:00:00.000Z', validTo: null }
  const skonceny: LegalTitleState = {
    organizationId: 'org-A',
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo: '2025-12-31T00:00:00.000Z',
  }
  const NOW = d('2026-07-26')

  it('bez běžícího titulu jde uzavřít nový', () => {
    expect(canOpenNewTitle([], false, NOW).ok).toBe(true)
    expect(canOpenNewTitle([skonceny], false, NOW).ok).toBe(true)
  })

  it('s běžícím titulem to NEJDE — ani pro jiné dítě', () => {
    const check = canOpenNewTitle([bezici], false, NOW)
    expect(check.ok).toBe(false)
    expect(check.conflictingOrgId).toBe('org-A')
    expect(check.reason).toContain('změnou stávající dohody')
  })

  /** Jediná výjimka z metodiky — a musí se výslovně potvrdit. */
  it('manželé žijící odděleně, každý s dítětem ve výlučné péči, mít dva tituly mohou', () => {
    expect(canOpenNewTitle([bezici], true, NOW).ok).toBe(true)
  })

  it('výjimka se neuplatní sama od sebe', () => {
    expect(canOpenNewTitle([bezici], false, NOW).ok).toBe(false)
  })

})

/**
 * Dokončovací lhůta NENÍ druhá aktivní dohoda — dvě současně existovat
 * nemohou. Je to přístup k vlastním datům, aby stará organizace dopsala
 * předávací protokoly a odhlášení pro OSPOD.
 */
describe('dokončovací lhůta po zániku dohody', () => {
  it('trvá 90 dní od zániku', () => {
    expect(WIND_DOWN_DAYS).toBe(90)
    expect(day(windDownEnd(d('2026-06-30')))).toBe('2026-09-28')
  })

  it('během ní stará organizace ještě dopisuje', () => {
    expect(isWithinWindDown(d('2026-06-30'), d('2026-08-01'))).toBe(true)
  })

  it('po ní už ne', () => {
    expect(isWithinWindDown(d('2026-06-30'), d('2026-10-01'))).toBe(false)
  })
})

/**
 * ZPŮSOBY ZÁNIKU. Pololetní kalendář platí JEN u výpovědi — dohodou stran
 * se dá skončit kdykoli. Splácnout to do jednoho pravidla by buď zakázalo
 * zákonný postup, nebo pustilo nezákonný.
 */
describe('plán zániku dohody', () => {
  it('u výpovědi rozhoduje zákon, ne zadané datum', () => {
    const plan = planAgreementEnd({
      reason: 'vypoved',
      noticeDeliveredAt: '2026-06-15T00:00:00.000Z',
      chosenDate: '2026-07-01T00:00:00.000Z',
    })
    expect(plan.effectiveDate.slice(0, 10)).toBe('2026-12-31')
    expect(plan.overriddenByLaw).toBe(true)
    expect(plan.explanation).toContain('30. 6. nebo 31. 12.')
  })

  it('včasná výpověď končí týmž pololetím a nic nepřepisuje', () => {
    const plan = planAgreementEnd({
      reason: 'vypoved',
      noticeDeliveredAt: '2026-03-01T00:00:00.000Z',
      chosenDate: '2026-06-30T00:00:00.000Z',
    })
    expect(plan.effectiveDate.slice(0, 10)).toBe('2026-06-30')
    expect(plan.overriddenByLaw).toBe(false)
  })

  it('dohodou stran jde skončit kdykoli', () => {
    const plan = planAgreementEnd({ reason: 'dohodou', chosenDate: '2026-08-15T00:00:00.000Z' })
    expect(plan.effectiveDate.slice(0, 10)).toBe('2026-08-15')
    expect(plan.overriddenByLaw).toBe(false)
    expect(plan.explanation).toContain('neuplatní')
  })

  it('bez data to u dohody stran neprojde', () => {
    expect(() => planAgreementEnd({ reason: 'dohodou' })).toThrow()
  })
})
