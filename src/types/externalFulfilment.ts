import type { DataClassed } from '@/types/dataClass'

/**
 * fosterPersons/{id}/externalFulfilment/{id} — PLNĚNÍ ZÁKONNÝCH POVINNOSTÍ
 * MIMO NÁŠ SYSTÉM.
 *
 * Zadání Petr Homolka, 2026-07-26: „dokážeme dítěti i pěstounu započítat
 * plnění zákonných povinností mimo náš systém".
 *
 * PROČ to musí existovat: UID žije dál i v době, kdy ho žádná naše
 * organizace nespravuje (stav `spanek` — pěstoun mohl podepsat Dohodu
 * s organizací, která náš systém nepoužívá). Vzdělávání a respit v tom
 * období proběhly, jen o nich nemáme událost v kalendáři. Kdyby se
 * nezapočítaly, ukázal by systém po převzetí pěstouna nesplněnou zákonnou
 * povinnost, která ve skutečnosti splněná byla — a klíčová osoba by hnala
 * rodinu do školení, které už absolvovala.
 *
 * ROZDÍL PROTI BĚŽNÉ UDÁLOSTI: tohle NENÍ záznam o tom, co se stalo u nás.
 * Je to PŘEVZATÉ TVRZENÍ — někdo (nová organizace při přebírání spisu)
 * doložil, že se to stalo jinde. Proto se vždy eviduje, kdo to zapsal a
 * o co se opřel (`evidence`): při kontrole je rozdíl mezi „naše událost
 * v kalendáři" a „doložili nám potvrzením z jiné organizace" podstatný.
 */
export type ExternalFulfilmentKind =
  /** Hodiny povinného vzdělávání pěstouna. */
  | 'vzdelavani'
  /** Dny čerpané odlehčovací (respitní) péče. */
  | 'respit'

export const EXTERNAL_FULFILMENT_LABELS: Record<ExternalFulfilmentKind, string> = {
  vzdelavani: 'Vzdělávání',
  respit: 'Respitní péče',
}

export const EXTERNAL_FULFILMENT_UNITS: Record<ExternalFulfilmentKind, 'h' | 'dní'> = {
  vzdelavani: 'h',
  respit: 'dní',
}

export interface ExternalFulfilmentDoc extends DataClassed {
  kind: ExternalFulfilmentKind

  /**
   * Kolik — hodin u vzdělávání, dní u respitu. Do výpočtu limitů se
   * započítává podle `occurredAt`, ne podle data zápisu: povinnost se
   * plní tehdy, kdy se školení konalo.
   */
  amount: number
  occurredAt: string

  /** Čeho se to týkalo (název kurzu, typ pobytu). */
  title: string

  /**
   * U koho to proběhlo. Volný text schválně — může jít o organizaci,
   * která náš systém nepoužívá, takže tu není na co odkazovat.
   */
  provider?: string

  /**
   * Čím je to doložené (certifikát, potvrzení organizace, čestné
   * prohlášení). NEPOVINNÉ, ale prázdné pole je samo o sobě informace:
   * v přehledu je pak vidět, že tvrzení nemá oporu.
   */
  evidence?: string

  /** Kdo tvrzení do systému zanesl a kdy — tohle není záznam o události, ale o převzetí. */
  recordedByOrgId: string
  recordedByUid: string
  recordedAt: string
}
