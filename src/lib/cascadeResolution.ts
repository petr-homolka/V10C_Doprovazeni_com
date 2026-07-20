import { getDocs, type CollectionReference } from 'firebase/firestore'

/**
 * Obecný resolver pro víceúrovňové, časově verzované kaskády (M7, §B.1/B.5/
 * B.5.1) — sazby (rateOverrides, 4 úrovně: pěstoun/dítě → Dohoda →
 * organizace → platforma) i politiky (policyOverrides, 5 úrovní: + klíčová
 * osoba mezi Dohodou a organizací) používají STEJNÝ mechanismus, liší se
 * jen v tom, kolik/jaké úrovně volající sestaví.
 *
 * Záměrně `getDocs(collectionRef)` BEZ jakéhokoli `where()` — čtení CELÉ
 * (malé, řádově jednotky záznamů) `history` podkolekce a filtrování/řazení
 * až klientsky se vyhne "list dotaz musí zrcadlit pole v pravidle" pasti
 * (§B.9, potkáno už 3× v projektu): žádný where() filtr = nic, co by
 * pravidlo muselo zrcadlit.
 */
export interface CascadeHistoryEntry<T> {
  value: T
  effectiveFrom: string
  effectiveTo: string | null
  setBy: string
  setAt: string
  note?: string
}

export async function resolveLatestHistoryEntry<T>(
  historyCollectionRef: CollectionReference,
  atDate: string,
): Promise<CascadeHistoryEntry<T> | null> {
  const snap = await getDocs(historyCollectionRef)
  const candidates = snap.docs
    .map((d) => d.data() as CascadeHistoryEntry<T>)
    .filter((e) => e.effectiveFrom <= atDate && (e.effectiveTo == null || e.effectiveTo >= atDate))
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  return candidates[0]
}

/** `refs` seřazené od NEJSPECIFIČTĚJŠÍ úrovně po NEJOBECNĚJŠÍ (platformní
 * vždy poslední) — první úroveň s platným záznamem k `atDate` vyhrává. */
export async function resolveCascade<T>(refs: CollectionReference[], atDate: string): Promise<T | null> {
  for (const ref of refs) {
    const entry = await resolveLatestHistoryEntry<T>(ref, atDate)
    if (entry) return entry.value
  }
  return null
}
