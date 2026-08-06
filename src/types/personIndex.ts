import type { MatchKeyKind } from '@/lib/personMatch'

/**
 * personIndex/{hash} — VYHLEDÁVACÍ OTISKY.
 *
 * Jediný účel: z identifikátoru, který má nová organizace v ruce (rodné
 * číslo z dokladu, číslo rozsudku, jméno s adresou), zjistit UID osoby,
 * kterou už v systému vedeme. Odtud pak vede cesta do `titleRegistry`
 * a k telefonátu.
 *
 * Klíčem dokumentu je OTISK, ne hodnota — viz `lib/personMatch.ts` pro to,
 * co tím je a co není zajištěné. V dokumentu samotném pak nejsou žádné
 * osobní údaje, jen UID a druh klíče (kvůli tomu, aby šlo uživateli říct
 * „shoda podle rodného čísla" místo „shoda").
 */
export interface PersonIndexDoc {
  /** UID osoby v našem systému. */
  uid: string
  /** Podle čeho shoda vznikla — do hlášky, ne k dohledávání. */
  kind: MatchKeyKind
  createdAt: string
  /** Která organizace otisk založila. Kvůli dohledatelnosti. */
  createdByOrgId: string
}
