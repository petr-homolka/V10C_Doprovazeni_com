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
export interface OrgDirectoryDoc {
  organizationId: string
  /** Název organizace, jak se má ukázat druhé straně. */
  name: string
  /** Jméno vedení / kontaktní osoby pro předávání spisů. */
  contactPersonName: string
  phone: string
  email: string
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
