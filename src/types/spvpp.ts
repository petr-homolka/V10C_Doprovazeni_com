/**
 * organizations/{orgId}/spvpp/{year} — původní ZADANI §4.4.C, vyhláška
 * 477/2024 Sb. §5c. Procenta košů se ČTOU z `legislativeParameters`
 * (viz `legislativeParameterService.getSpvppBucketRange`), nejsou tady
 * natvrdo — pole `buckets.*.minPct/maxPct` je jen DENORMALIZOVANÝ snímek
 * platný v okamžiku posledního přepočtu, pro rychlé zobrazení bez dalšího
 * čtení.
 */
export type SpvppStatus = 'planned' | 'requested' | 'disbursed' | 'reported' | 'closed'

export interface SpvppBucketSnapshot {
  minPct: number
  maxPct: number
  plannedAmount: number
  actualAmount: number
}

export interface SpvppDoc {
  agreementsCountBasis: number
  requestedAmount?: number | null
  disbursedAmount?: number | null
  status: SpvppStatus
  deadlines: { requestBy: string; reportBy: string; returnBy: string }
  buckets: {
    osobniPeceARespit: SpvppBucketSnapshot
    poradenstviPsychoKontakt: SpvppBucketSnapshot
    vzdelavani: SpvppBucketSnapshot
    provozMzdy: { actualAmount: number } // zbytek, bez % stropu
  }
}

/** organizations/{orgId}/spvpp/{year}/expenses/{id} — append-only, tři způsoby vzniku. */
export interface SpvppExpenseDoc {
  bucket: 'osobniPeceARespit' | 'poradenstviPsychoKontakt' | 'vzdelavani' | 'provozMzdy'
  amount: number
  date: string
  note?: string
  documentRef?: string | null // POVINNÝ, je-li sourceRef i childRef prázdné
  sourceRef?: string | null // volitelný odkaz na respitEvent/course/supportExpense
  childRef?: string | null // jen pro dohledatelnost, nezobrazuje se agregovaně na dítěti
  createdBy: string
  createdAt: string
}
