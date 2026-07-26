import { describe, expect, it } from 'vitest'
import {
  activeAssignments,
  agreementCoversChild,
  assignmentsWithoutAgreement,
  childrenInCareOf,
  isActiveFosterParent,
  isEffective,
  isFosterIn,
  organizationsAccompanyingChild,
  validateAssignmentConsistency,
  validateFosterCount,
} from './custody'
import type { AgreementSubjectDoc, CustodyAssignmentDoc } from '@/types/custody'

const NOW = new Date('2026-07-26T12:00:00.000Z')

function assignment(over: Partial<CustodyAssignmentDoc> & Pick<CustodyAssignmentDoc, 'id' | 'childId'>): CustodyAssignmentDoc {
  return {
    courtDecisionId: 'rozsudek-1',
    fosterPersonIds: ['pest-A'],
    form: 'vyhradni',
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo: null,
    status: 'aktivni',
    createdAt: '2024-01-01T00:00:00.000Z',
    createdByOrgId: 'org-A',
    ...over,
  } as CustodyAssignmentDoc
}

function subject(
  agreementId: string,
  custodyAssignmentId: string,
  fosterPersonId: string,
  validTo: string | null = null,
): AgreementSubjectDoc {
  return {
    agreementId,
    custodyAssignmentId,
    fosterPersonId,
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo,
  }
}

describe('časová platnost', () => {
  it('den ukončení už neplatí — konec je výlučný', () => {
    expect(isEffective({ validFrom: '2024-01-01T00:00:00.000Z', validTo: null }, NOW)).toBe(true)
    expect(isEffective({ validFrom: '2027-01-01T00:00:00.000Z', validTo: null }, NOW)).toBe(false)
    expect(
      isEffective({ validFrom: '2024-01-01T00:00:00.000Z', validTo: '2026-01-01T00:00:00.000Z' }, NOW),
    ).toBe(false)
  })
})

describe('pěstoun ve svěření', () => {
  it('na pořadí v poli nezáleží', () => {
    const a = assignment({ id: 's1', childId: 'dite-1', fosterPersonIds: ['pest-A', 'pest-B'], form: 'spolecna' })
    expect(isFosterIn(a, 'pest-A')).toBe(true)
    expect(isFosterIn(a, 'pest-B')).toBe(true)
    expect(isFosterIn(a, 'pest-C')).toBe(false)
  })
})

/**
 * SCÉNÁŘ 1 — jeden pěstoun, dvě děti ze dvou rozsudků, DVĚ RŮZNÉ
 * organizace. Přesně ten případ, kvůli kterému starý model nestačil:
 * dřív by obě organizace viděly obě děti, protože rozhodovala domácnost.
 */
describe('pěstoun se dvěma dětmi u dvou organizací', () => {
  const s1 = assignment({ id: 's1', childId: 'dite-1', courtDecisionId: 'rozsudek-1' })
  const s2 = assignment({ id: 's2', childId: 'dite-2', courtDecisionId: 'rozsudek-2' })
  const subjects = [subject('dohoda-A', 's1', 'pest-A'), subject('dohoda-B', 's2', 'pest-A')]
  const orgByAgreement = { 'dohoda-A': 'org-A', 'dohoda-B': 'org-B' }

  it('každé dítě doprovází jen jeho organizace', () => {
    expect(organizationsAccompanyingChild('dite-1', [s1, s2], subjects, orgByAgreement, NOW)).toEqual(['org-A'])
    expect(organizationsAccompanyingChild('dite-2', [s1, s2], subjects, orgByAgreement, NOW)).toEqual(['org-B'])
  })

  it('Dohoda organizace A nepokrývá dítě organizace B', () => {
    expect(agreementCoversChild('dohoda-A', 'dite-2', [s1, s2], subjects, NOW)).toBe(false)
    expect(agreementCoversChild('dohoda-A', 'dite-1', [s1, s2], subjects, NOW)).toBe(true)
  })

  it('pěstoun má v péči obě děti, i když je každé jinde', () => {
    expect(childrenInCareOf('pest-A', [s1, s2], NOW).sort()).toEqual(['dite-1', 'dite-2'])
  })
})

/**
 * SCÉNÁŘ 2 — společná péče manželů. Jedno svěření, dva pěstouni,
 * JEDNA Dohoda a v ní dva předměty (za každého manžela jeden).
 */
describe('společná péče manželů', () => {
  const s = assignment({
    id: 's1',
    childId: 'dite-1',
    fosterPersonIds: ['pest-A', 'pest-B'],
    form: 'spolecna',
  })
  const subjects = [subject('dohoda-A', 's1', 'pest-A'), subject('dohoda-A', 's1', 'pest-B')]

  it('oba manželé jsou aktivní pěstouni', () => {
    expect(isActiveFosterParent('pest-A', [s], NOW)).toBe(true)
    expect(isActiveFosterParent('pest-B', [s], NOW)).toBe(true)
  })

  it('dítě doprovází jedna organizace, ne dvě', () => {
    expect(organizationsAccompanyingChild('dite-1', [s], subjects, { 'dohoda-A': 'org-A' }, NOW)).toEqual(['org-A'])
  })
})

/**
 * SCÉNÁŘ 3 — ROZVOD. Soud zruší společnou péči a svěří dítě jen
 * pěstounovi A. Pěstoun B přestává být pěstounem a Dohodu už nepotřebuje;
 * pěstoun A si může vybrat i jinou organizaci.
 */
describe('rozvod pěstounů', () => {
  const puvodni = assignment({
    id: 's1',
    childId: 'dite-1',
    fosterPersonIds: ['pest-A', 'pest-B'],
    form: 'spolecna',
    validTo: '2026-06-30T00:00:00.000Z',
    status: 'ukonceno',
    endedByCourtDecisionId: 'rozsudek-2',
  })
  const nove = assignment({
    id: 's2',
    childId: 'dite-1',
    courtDecisionId: 'rozsudek-2',
    fosterPersonIds: ['pest-A'],
    form: 'vyhradni',
    validFrom: '2026-07-01T00:00:00.000Z',
  })

  it('pěstoun A pěstounem zůstává', () => {
    expect(isActiveFosterParent('pest-A', [puvodni, nove], NOW)).toBe(true)
  })

  it('pěstoun B pěstounem být přestal — už žádnou Dohodu nepotřebuje', () => {
    expect(isActiveFosterParent('pest-B', [puvodni, nove], NOW)).toBe(false)
  })

  it('historie se nemaže: k dřívějšímu dni byl pěstounem i B', () => {
    const drive = new Date('2026-01-01T00:00:00.000Z')
    expect(isActiveFosterParent('pest-B', [puvodni, nove], drive)).toBe(true)
  })

  it('platí jen nové svěření', () => {
    expect(activeAssignments([puvodni, nove], NOW).map((a) => a.id)).toEqual(['s2'])
  })

  /** Pěstoun A může přejít k jiné organizaci — nové svěření zatím Dohodu nemá. */
  it('nové svěření bez Dohody se ukáže jako nepokryté', () => {
    const stareSubjekty = [subject('dohoda-A', 's1', 'pest-A'), subject('dohoda-A', 's1', 'pest-B')]
    const nepokryta = assignmentsWithoutAgreement([puvodni, nove], stareSubjekty, NOW)
    expect(nepokryta.map((a) => a.id)).toEqual(['s2'])
  })
})

/**
 * `status` a `validTo` jsou dvě pole o téže věci — musí si odpovídat.
 */
describe('soulad status a validTo', () => {
  it('ukončené svěření bez data ukončení je chyba', () => {
    expect(validateAssignmentConsistency({ status: 'ukonceno', validTo: null })).toContain('datum ukončení')
  })

  it('aktivní svěření s datem ukončení je chyba', () => {
    expect(validateAssignmentConsistency({ status: 'aktivni', validTo: '2026-01-01T00:00:00.000Z' })).toContain(
      'aktivní',
    )
  })

  it('soudržné kombinace projdou', () => {
    expect(validateAssignmentConsistency({ status: 'aktivni', validTo: null })).toBeNull()
    expect(validateAssignmentConsistency({ status: 'ukonceno', validTo: '2026-01-01T00:00:00.000Z' })).toBeNull()
  })
})

/**
 * Zákonná podmínka: společnými pěstouny mohou být jen manželé. Validace
 * hlídá počet, protože tvar dat (pole) ho sám o sobě neomezuje.
 */
describe('kolik pěstounů smí být ve svěření', () => {
  it('tři pěstouni neprojdou', () => {
    expect(validateFosterCount({ fosterPersonIds: ['a', 'b', 'c'], form: 'spolecna' })).toContain('nejvýš dva')
  })

  it('žádný pěstoun neprojde', () => {
    expect(validateFosterCount({ fosterPersonIds: [], form: 'vyhradni' })).toContain('aspoň jednoho')
  })

  it('společná péče chce přesně dva', () => {
    expect(validateFosterCount({ fosterPersonIds: ['a'], form: 'spolecna' })).toContain('dva pěstouny')
    expect(validateFosterCount({ fosterPersonIds: ['a', 'b'], form: 'spolecna' })).toBeNull()
  })

  it('výhradní péče chce přesně jednoho', () => {
    expect(validateFosterCount({ fosterPersonIds: ['a', 'b'], form: 'vyhradni' })).toContain('jednoho pěstouna')
    expect(validateFosterCount({ fosterPersonIds: ['a'], form: 'vyhradni' })).toBeNull()
  })
})
