import { describe, expect, it } from 'vitest'
import { planTakeoverContact } from './takeoverFlow'
import { isAvailableForTakeover, titleState, type TitleRegistryDoc } from '@/types/titleRegistry'
import type { OrgDirectoryDoc } from '@/types/orgDirectory'

const NOW = new Date('2026-07-26T12:00:00.000Z')

function reg(over: Partial<TitleRegistryDoc> = {}): TitleRegistryDoc {
  return {
    uid: '1000000001',
    holderOrgId: 'org-A',
    externalSubjectName: null,
    validFrom: '2025-01-01T00:00:00.000Z',
    validTo: null,
    releasedAt: null,
    releasedByOrgId: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedByOrgId: 'org-A',
    ...over,
  }
}

const card: OrgDirectoryDoc = {
  organizationId: 'org-A',
  name: 'Doprovázení Jih, z. ú.',
  contactPersonName: 'Jana Nováková',
  phone: '+420 777 111 222',
  email: 'vedeni@jih.example',
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedByUid: 'admin-a',
}

/**
 * TOHLE JE TA OPRAVA. Dřív se titul uvolňoval sám, jakmile uplynulo
 * `validTo`. Konec Dohody a vypořádání se starou organizací jsou ale dvě
 * různé věci a jen ta druhá znamená volno.
 */
describe('konec Dohody NEZNAMENÁ uvolnění', () => {
  it('běžící Dohoda = aktivní', () => {
    expect(titleState(reg(), NOW)).toBe('aktivni')
  })

  it('prošlé validTo bez uvolnění = ukončena, NE volno', () => {
    const e = reg({ validTo: '2026-06-30T00:00:00.000Z' })
    expect(titleState(e, NOW)).toBe('ukoncena')
    expect(isAvailableForTakeover(e, NOW)).toBe(false)
  })

  it('teprve uvolnění dělá volno', () => {
    const e = reg({ validTo: '2026-06-30T00:00:00.000Z', releasedAt: '2026-07-01T00:00:00.000Z' })
    expect(titleState(e, NOW)).toBe('uvolneny')
    expect(isAvailableForTakeover(e, NOW)).toBe(true)
  })

  /** Výrok člověka je čerstvější než datum v datech. */
  it('uvolnění přebíjí i budoucí validTo', () => {
    const e = reg({ validTo: '2027-12-31T00:00:00.000Z', releasedAt: '2026-07-01T00:00:00.000Z' })
    expect(titleState(e, NOW)).toBe('uvolneny')
  })

  it('koho nevedeme, ten je volný', () => {
    expect(isAvailableForTakeover(null, NOW)).toBe(true)
  })
})

describe('co uvidí nová organizace', () => {
  it('neznámý pěstoun — zakládá se rovnou', () => {
    const g = planTakeoverContact(null, null, NOW)
    expect(g.outcome).toBe('volny')
    expect(g.canSign).toBe(true)
  })

  it('obsazený pěstoun — podepsat NE, zájemce ANO, kontakt ANO', () => {
    const g = planTakeoverContact(reg(), card, NOW)
    expect(g.outcome).toBe('kontaktovat')
    expect(g.canSign).toBe(false)
    expect(g.canSaveAsProspect).toBe(true)
    expect(g.contact?.phone).toBe('+420 777 111 222')
    expect(g.message).toContain('pravděpodobně')
    expect(g.message).toContain('Doprovázení Jih')
  })

  /**
   * „Aktivní" a „ukončená, ale neuvolněná" se ven NEROZLIŠUJÍ. Správný
   * krok je v obou případech telefonát a rozdíl mezi nimi je informace
   * o cizím klientovi.
   */
  it('ukončená neuvolněná vypadá zvenku stejně jako aktivní', () => {
    const aktivni = planTakeoverContact(reg(), card, NOW)
    const ukoncena = planTakeoverContact(reg({ validTo: '2026-06-30T00:00:00.000Z' }), card, NOW)
    expect(ukoncena.outcome).toBe(aktivni.outcome)
    expect(ukoncena.canSign).toBe(false)
    expect(ukoncena.message).toBe(aktivni.message)
  })

  it('po uvolnění jde podepsat hned', () => {
    const g = planTakeoverContact(reg({ releasedAt: '2026-07-01T00:00:00.000Z', releasedByOrgId: 'org-A' }), card, NOW)
    expect(g.outcome).toBe('uvolneny')
    expect(g.canSign).toBe(true)
    expect(g.message).toContain('UVOLNĚNÝ')
  })

  /** Zeď bez dveří: nová organizace nemá kam zavolat. Musí se to hlásit. */
  it('chybějící vizitka se ohlásí, ne zamlčí', () => {
    const g = planTakeoverContact(reg(), null, NOW)
    expect(g.contactMissing).toBe(true)
    expect(g.message).toContain('nemáme na ni kontakt')
  })

  it('neúplná vizitka (bez telefonu i e-mailu) je totéž co žádná', () => {
    const g = planTakeoverContact(reg(), { ...card, phone: '', email: '' }, NOW)
    expect(g.contactMissing).toBe(true)
  })

  it('doprovázení mimo systém (OSPOD) se pojmenuje jménem', () => {
    const g = planTakeoverContact(reg({ holderOrgId: null, externalSubjectName: 'OSPOD Praha 4' }), null, NOW)
    expect(g.outcome).toBe('kontaktovat')
    expect(g.message).toContain('OSPOD Praha 4')
  })
})
