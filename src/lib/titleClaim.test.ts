import { describe, expect, it } from 'vitest'
import { isAvailableForTakeover, type TitleRegistryDoc } from '@/types/titleRegistry'

/**
 * ROZHODOVACÍ PRAVIDLO TRANSAKČNÍHO ZÁBORU.
 *
 * Samotnou transakci otestovat bez Firestore nejde, ale rozhodnutí uvnitř
 * ní ano — a právě to je ta část, kde se dá udělat chyba. Pravidlo musí
 * být identické s předkontrolou (`assertCanOpenTitle`), jinak by uživatel
 * dostal zelenou od kontroly a červenou od transakce.
 */
function claimDecision(
  entry: TitleRegistryDoc | null,
  openingOrgId: string,
  spousesLivingApart: boolean,
  now: Date,
): 'zabrat' | 'konflikt' {
  if (isAvailableForTakeover(entry, now)) return 'zabrat'
  if (!entry) return 'zabrat'
  if (entry.holderOrgId === openingOrgId) return 'zabrat'
  if (spousesLivingApart) return 'zabrat'
  return 'konflikt'
}

const NOW = new Date('2026-07-26T12:00:00.000Z')

function reg(over: Partial<TitleRegistryDoc> = {}): TitleRegistryDoc {
  return {
    uid: '1000000001',
    holderOrgId: 'org-A',
    validFrom: '2025-01-01T00:00:00.000Z',
    validTo: null,
    releasedAt: null,
    releasedByOrgId: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedByOrgId: 'org-A',
    ...over,
  }
}

describe('rozhodnutí uvnitř transakčního záboru', () => {
  it('volné UID se zabere', () => {
    expect(claimDecision(null, 'org-B', false, NOW)).toBe('zabrat')
  })

  it('uvolněný pěstoun se zabere', () => {
    expect(claimDecision(reg({ releasedAt: '2026-07-01T00:00:00.000Z' }), 'org-B', false, NOW)).toBe('zabrat')
  })

  /** Tohle je ta blokace, kterou Petr chtěl tvrdou. */
  it('cizí běžící titul = konflikt', () => {
    expect(claimDecision(reg(), 'org-B', false, NOW)).toBe('konflikt')
  })

  /** Konec Dohody bez uvolnění pořád blokuje — viz TitleState. */
  it('cizí ukončený, ale neuvolněný titul = pořád konflikt', () => {
    expect(claimDecision(reg({ validTo: '2026-06-30T00:00:00.000Z' }), 'org-B', false, NOW)).toBe('konflikt')
  })

  /** Další dítě u téže organizace je změna dohody, ne nová — nesmí blokovat. */
  it('vlastní běžící titul se zabere znovu', () => {
    expect(claimDecision(reg(), 'org-A', false, NOW)).toBe('zabrat')
  })

  it('zákonná výjimka pro odděleně žijící manžele projde', () => {
    expect(claimDecision(reg(), 'org-B', true, NOW)).toBe('zabrat')
  })
})
