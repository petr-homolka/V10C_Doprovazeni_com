import { isReachable, type OrgDirectoryDoc } from '@/types/orgDirectory'
import { titleState, type TitleRegistryDoc } from '@/types/titleRegistry'

/**
 * CO SE STANE, KDYŽ NOVÁ ORGANIZACE ZADÁ PĚSTOUNA, KTERÉHO UŽ VEDEME.
 *
 * Postup Petr Homolka, 26. 7. Celý stojí na tom, že rozhodnutí NEDĚLÁ
 * systém, ale člověk ve staré organizaci —
 *
 *   1. Nová organizace zadá pěstouna. Systém pozná (přes otisky
 *      identifikátorů, viz `personMatch.ts`), že takového už máme.
 *   2. Zjistí, že má běžící Dohodu, a ŘEKNE JEN TOHLE: „pravděpodobně má
 *      Dohodu s organizací XYZ, spojte se s ní" + kontakt.
 *   3. Nová organizace zavolá. Stará se podívá k sobě a buď:
 *      a) potvrdí, že je to její klient → nová má smůlu, může si pěstouna
 *         uložit jen jako ZÁJEMCE, podepsat ne;
 *      b) zjistí, že Dohodu už ukončila a jen zapomněla uvolnit →
 *         jedním kliknutím uvolní a nová může podepsat.
 *
 * ─── PROČ TO ROZHODNUTÍ NESMÍ DĚLAT SYSTÉM ────────────────────────────
 *
 * Rozdíl mezi „je to pořád náš klient" a „zapomněli jsme ho uvolnit" v
 * datech není vidět. V obou případech je v rejstříku záznam. Rozhodnout
 * to umí jen ten, kdo se podívá do svého spisu — a proto tu není žádný
 * časovač, který by po X dnech uvolnil sám.
 *
 * ─── CO SE SMÍ PROZRADIT ──────────────────────────────────────────────
 *
 * Slovo „PRAVDĚPODOBNĚ" je záměr, ne opatrnost ve formulaci. Shoda otisku
 * není důkaz totožnosti (dva lidé můžou mít stejné jméno i adresu). A ven
 * jde VÝHRADNĚ název a kontakt organizace — nikdy nic o té osobě. Kdo
 * zadá cizí rodné číslo, nesmí se dozvědět, jestli tomu člověku patří,
 * jen to, na koho se má obrátit.
 */

export type TakeoverOutcome =
  /** Nikoho takového nevedeme (nebo je uvolněný) — zakládá se normálně. */
  | 'volny'
  /** Vedeme, ale je uvolněný — jde rovnou podepsat. */
  | 'uvolneny'
  /** Vedeme a je obsazený — nová organizace musí zavolat. */
  | 'kontaktovat'

export interface TakeoverGuidance {
  outcome: TakeoverOutcome
  /** Smí nová organizace uzavřít Dohodu? */
  canSign: boolean
  /** Smí si ho uložit aspoň jako zájemce? Vždycky ano — to nikomu nevadí. */
  canSaveAsProspect: boolean
  /** Hlavní věta pro obrazovku. */
  message: string
  /** Na koho zavolat. `null`, když není koho kontaktovat. */
  contact: OrgDirectoryDoc | null
  /**
   * Vizitka chybí nebo je neúplná. Pak nová organizace vidí zeď bez dveří
   * a musí to vyřešit provozovatel — proto se to hlásí zvlášť, ne mlčky.
   */
  contactMissing: boolean
}

export function planTakeoverContact(
  entry: TitleRegistryDoc | null,
  /** Vizitka držitele. Načítá volající, protože sáhne do jiné kolekce. */
  holderCard: OrgDirectoryDoc | null,
  now: Date = new Date(),
): TakeoverGuidance {
  if (!entry) {
    return {
      outcome: 'volny',
      canSign: true,
      canSaveAsProspect: true,
      message: 'Tohoto pěstouna zatím nikdo z organizací v systému nevede.',
      contact: null,
      contactMissing: false,
    }
  }

  const state = titleState(entry, now)

  if (state === 'uvolneny') {
    const by = entry.releasedByOrgId ? ` (uvolnila organizace ${entry.releasedByOrgId})` : ''
    return {
      outcome: 'uvolneny',
      canSign: true,
      canSaveAsProspect: true,
      message: `Pěstoun je vedený v systému a je UVOLNĚNÝ${by} — má vypořádané závazky a můžete s ním uzavřít Dohodu.`,
      contact: holderCard,
      contactMissing: false,
    }
  }

  // Zbývá 'aktivni' a 'ukoncena'. Ven se to NEROZLIŠUJE: v obou případech
  // je jediný správný krok telefonát a rozdíl mezi nimi je informace
  // o cizím klientovi, do které nové organizaci nic není.
  const holder = entry.externalSubjectName ?? entry.holderOrgId ?? 'jiná organizace'
  const reachable = isReachable(holderCard)

  return {
    outcome: 'kontaktovat',
    canSign: false,
    canSaveAsProspect: true,
    message: reachable
      ? `Tento pěstoun má pravděpodobně platnou Dohodu s organizací ${holderCard?.name ?? holder}. ` +
        'Spojte se s ní. Pokud u ní Dohoda skončila, uvolní vám pěstouna jedním kliknutím. ' +
        'Do té doby si ho můžete uložit jako zájemce.'
      : `Tento pěstoun má pravděpodobně platnou Dohodu s organizací ${holder}, ale nemáme na ni ` +
        'kontakt. Ozvěte se prosím provozovateli systému. Zatím si pěstouna můžete uložit jako zájemce.',
    contact: holderCard,
    contactMissing: !reachable,
  }
}
