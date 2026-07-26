/**
 * titleRegistry/{uid} — REJSTŘÍK OBSAZENÝCH UID.
 *
 * Vzniklo z jedné Petrovy odpovědi („Zablokovat :-)") a z jedné tvrdé
 * překážky: metodika MPSV zakazuje, aby osoba pečující měla v daném čase
 * víc než jeden právní titul — jenže dnešní `firestore.rules` organizaci
 * NEDOVOLÍ přečíst cizí Dohodu (`sameOrg(resource.data.organizationId)`).
 * Systém tedy o cizím titulu neví a bez tohohle rejstříku ho nemá jak
 * zablokovat. Kontrola, která se dá obejít tím, že data nevidí, není
 * kontrola.
 *
 * ─── PROČ JE TO SAMOSTATNÁ KOLEKCE A NE POLE NA PĚSTOUNOVI ────────────
 *
 * `fosterPersons/{id}` čte jen organizace v `orgAccessList`. Přesně ta,
 * která se ptá „je tohle UID volné?", tam ještě není — a být nesmí,
 * protože se ptá dřív, než získá jakýkoli vztah k té osobě. Rejstřík je
 * proto samostatná, platformní kolekce s vlastními pravidly.
 *
 * ─── CO TU SCHVÁLNĚ NENÍ ──────────────────────────────────────────────
 *
 * ŽÁDNÉ OSOBNÍ ÚDAJE. Ani jméno, ani rodné číslo, ani id rodiny. Odpověď
 * zní „obsazeno / volno, kým a dokdy" — nic víc. Kdo se zeptá na cizí UID,
 * nesmí se dozvědět, komu patří. Proto se taky rejstřík nedá vylistovat
 * (`allow list: if false`) — jde jen sáhnout na konkrétní UID, které
 * tazatel už zná.
 */

/**
 * ─── OPRAVA: KONEC DOHODY NEZNAMENÁ VOLNO ─────────────────────────────
 *
 * Původně se tu titul uvolňoval SÁM, jakmile uplynulo `validTo` — s tím
 * odůvodněním, že zapomenutý zápis by jinak UID zablokoval napořád.
 * Petrův postup z 26. 7. tohle vyvrací a je to lepší:
 *
 *   Konec Dohody a vypořádání se starou organizací jsou DVĚ RŮZNÉ VĚCI.
 *
 * Dohoda může skončit a pěstoun pořád může mít s organizací nedořešené
 * věci (předávací protokoly, odhlášení pro OSPOD, vyúčtování). Teprve když
 * stará organizace řekne „vypořádáno", je pěstoun volný. To se nedá
 * odvodit z kalendáře, to musí někdo potvrdit.
 *
 * Pojistka proti zapomenutému uvolnění není časovač, ale TELEFON: nová
 * organizace uvidí, s kým se spojit, zavolá, a stará uvolní jedním
 * kliknutím. Člověk v té smyčce je záměr, ne nedodělek — je to jediné
 * místo, kde se pozná rozdíl mezi „je to pořád náš klient" a „zapomněli
 * jsme ho uvolnit".
 */
export type TitleState =
  /** Dohoda běží. Nová organizace nemůže podepsat. */
  | 'aktivni'
  /** Dohoda skončila, ale stará organizace pěstouna NEUVOLNILA. Blokuje. */
  | 'ukoncena'
  /** Stará organizace potvrdila vypořádání. Volné pro kohokoli. */
  | 'uvolneny'

export const TITLE_STATE_LABELS: Record<TitleState, string> = {
  aktivni: 'Aktivní dohoda',
  ukoncena: 'Dohoda ukončena — pěstoun zatím neuvolněn',
  uvolneny: 'Uvolněný',
}

export interface TitleRegistryDoc {
  /** UID osoby pečující. Zároveň document ID — sáhne se přímo, bez dotazu. */
  uid: string

  /**
   * Organizace, která titul drží.
   *
   * Bylo tu i pole pro subjekt MIMO náš systém (OSPOD). Zrušeno 26. 7.:
   * OSPOD uživatelem systému nikdy nebude, takže by ten údaj nikdo nikdy
   * nezapsal. Viz `lib/agreementLaw.ts` bod 4 — a důsledek, že pěstouna
   * doprovázeného OSPODem uvidíme jako volného.
   */
  holderOrgId: string | null

  validFrom: string
  /** `null` = běží. Vyplněné = titul skončil (nebo má konec naplánovaný). */
  validTo: string | null

  /**
   * Kdy stará organizace pěstouna VYPOŘÁDALA A UVOLNILA. `null` = neuvolněn.
   *
   * JEDINÉ uložené pole o uvolnění. Stav se z něj a z `validTo` dopočítá
   * (`titleState`), aby se dvě pole o téže věci nemohla rozejít — přesně
   * ta chyba, kterou u svěření hlídá `validateAssignmentConsistency`.
   */
  releasedAt?: string | null
  /** Kdo uvolnění provedl — do auditu i do hlášky „uvolnila organizace X". */
  releasedByOrgId?: string | null

  updatedAt: string
  /** Kdo zápis provedl — kvůli dohledatelnosti, ne kvůli přístupu. */
  updatedByOrgId: string
}

/** Běží samotná Dohoda k danému dni? Konec je VÝLUČNÝ. */
export function isTitleRunning(entry: TitleRegistryDoc, at: Date = new Date()): boolean {
  const day = at.toISOString()
  if (entry.validFrom > day) return false
  return !entry.validTo || entry.validTo > day
}

/**
 * Stav pěstouna v rejstříku. Jedna funkce, jedno pravidlo — nikde jinde
 * se to dopočítávat nesmí.
 *
 * Uvolnění PŘEBÍJÍ všechno ostatní: když stará organizace řekla
 * „vypořádáno", je volno, i kdyby v datech zůstalo `validTo` napřesrok.
 * Ten výrok je čerstvější a udělal ho člověk.
 */
export function titleState(entry: TitleRegistryDoc, at: Date = new Date()): TitleState {
  if (entry.releasedAt) return 'uvolneny'
  return isTitleRunning(entry, at) ? 'aktivni' : 'ukoncena'
}

/** Smí si na tohle UID sáhnout nová organizace? */
export function isAvailableForTakeover(entry: TitleRegistryDoc | null, at: Date = new Date()): boolean {
  return !entry || titleState(entry, at) === 'uvolneny'
}
