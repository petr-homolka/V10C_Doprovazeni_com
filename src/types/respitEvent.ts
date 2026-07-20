import type { SubjectRef } from './timelineEntry'

/**
 * families/{familyId}/respitEvents/{id} — původní ZADANI §4.4.B (respit,
 * min. 14 kalendářních dní/rok, §47a odst. 2 písm. b) ZSPOD, "i hodina =
 * celý den") + rozšíření pro Pobyt (§4.4.B.2), OPRAVENÉ dle
 * NOVE-ZADANI-M6-AZ-KONEC.md §B.5 proti Instrukci VŘ SRP a SS č. 3/2025:
 *
 * **Směr platby u Pobytu (str. 6 Instrukce): RODINA platí stravu/ubytování
 * dítěte z příspěvku na úhradu potřeb dítěte (JINÁ dávka než SPVPP) — NE
 * organizace. §5f strop je maximum, co smí organizace RODINĚ ÚČTOVAT, ne
 * maximum, co smí organizace přispět.** `organizaceDoplaci` (dopočet nad
 * strop) je to, co se JEDINÉ počítá do SPVPP koše — rodinin podíl do
 * SPVPP vůbec nevstupuje (jiný rozpočet, jiný příjemce).
 */
export type RespitEventKind = 'celodenni_pece' | 'pobyt'

export interface RespitStravaUbytovani {
  skutecneNaklady: number
  rodinaPrispivaCastka: number // MAX capped na resolved strop × dny
  organizaceDoplaci: number // = skutecneNaklady - rodinaPrispivaCastka
}

export interface RespitEventDoc {
  organizationId: string
  kind: RespitEventKind // výchozí 'celodenni_pece'
  subjectRefs: SubjectRef[] // vždy kind:'child'
  dateFrom: string
  dateTo: string
  daysCount: number // (dateTo-dateFrom)+1, min. 1
  calendarYear: number // odvozeno z dateFrom — kalendářní rok, NE rolující
  providerRef?: string | null // → institutions/{id}, TT=80
  reason?: string // POVINNÉ, pokud součet za rok > 14
  cost?: number | null // Kč, volitelné — pro SPVPP koš (jen 'celodenni_pece')
  /** jen kind='pobyt' — vedení řeší mimo systém, zapisuje záznam a doklady. */
  organizedWith?: { koUid: string; fosterAcknowledgedAt?: string | null } | null
  costCoveredByOrg?: number | null // vlastní péče/program pobytu — v SPVPP koši
  stravaUbytovani?: RespitStravaUbytovani | null
  invoiceDocumentRef?: string | null
  paymentProofDocumentRef?: string | null
  daysCounted?: number | null
  createdBy: string
  createdAt: string
}
