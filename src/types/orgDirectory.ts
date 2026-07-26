/**
 * orgDirectory/{orgId} — VEŘEJNÁ VIZITKA ORGANIZACE.
 *
 * Petrův postup předání stojí na telefonátu: nová organizace zjistí, že
 * pěstoun pravděpodobně má Dohodu jinde, uvidí S KÝM SE SPOJIT, zavolá,
 * a stará organizace pěstouna buď potvrdí jako svého klienta, nebo ho
 * jedním kliknutím uvolní.
 *
 * Bez kontaktu je celý ten postup nepoužitelný — a `organizations/{orgId}`
 * ho nejen nemá, ale hlavně ho čte VÝHRADNĚ ta organizace sama
 * (`sameOrg`). Otevřít to pravidlo by odkrylo i kapacitní prahy, tarif
 * a fakturační poznámku. Proto samostatná kolekce s jedinou náplní:
 * na koho zavolat.
 *
 * Údaje jsou PRACOVNÍ KONTAKT NA ORGANIZACI, ne osobní údaj zaměstnance —
 * jméno vedení, firemní telefon, firemní e-mail. Nic dalšího sem nepatří,
 * i kdyby se to hodilo.
 */
/**
 * Kraje. Podle nich se bude pěstounovi nabízet místně příslušná
 * organizace, dřív než bude mapa — a je to údaj, který se dá vyplnit
 * spolehlivě, na rozdíl od souřadnic.
 */
export const REGIONS = [
  'Praha',
  'Středočeský',
  'Jihočeský',
  'Plzeňský',
  'Karlovarský',
  'Ústecký',
  'Liberecký',
  'Královéhradecký',
  'Pardubický',
  'Vysočina',
  'Jihomoravský',
  'Olomoucký',
  'Zlínský',
  'Moravskoslezský',
] as const

export type Region = (typeof REGIONS)[number]

export interface OrgDirectoryDoc {
  organizationId: string
  /** Název organizace, jak se má ukázat druhé straně. */
  name: string
  /** Jméno vedení / kontaktní osoby pro předávání spisů. */
  contactPersonName: string
  phone: string
  email: string

  /**
   * Kde organizace působí. Zatím jen pro lidské čtení a pro budoucí
   * nabídku „místně příslušná organizace"; souřadnice tu schválně nejsou —
   * geokódovat adresu jde kdykoli později, vymýšlet si polohu ne.
   */
  address?: string
  region?: Region | ''
  website?: string
  /** IČO — jediný spolehlivý veřejný identifikátor organizace. */
  ico?: string

  updatedAt: string
  updatedByUid: string
}

/**
 * Dá se na tuhle organizaci vůbec dovolat? Neúplná vizitka je horší než
 * žádná — nová organizace by koukala na prázdné pole a nevěděla, jestli
 * je to chyba, nebo tam opravdu nic není.
 */
export function isReachable(card: OrgDirectoryDoc | null): boolean {
  return !!card && !!card.name && (!!card.phone || !!card.email)
}
