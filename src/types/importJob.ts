/**
 * organizations/{orgId}/importJobs/{jobId} — ZADANI §5.5 "Společný
 * mechanismus pro cesty A–C: staging → report → commit → undo". Data
 * NIKDY nejdou přímo do produkčních kolekcí — vždy přes tenhle kanál.
 *
 * M1.5 staví plně jen cestu B (šablona) — žádná AI/API závislost, čistě
 * klient-side parsování nahraného .xlsx. Cesty A (AI-asistovaný) a C
 * (profesionální import přes API) sdílí STEJNÝ `importJobs`/
 * `stagingRecords` mechanismus (proto `method` pole existuje už teď), ale
 * jejich vlastní "přední dveře" (AI mapování sloupců / autentizovaný
 * batch endpoint) čekají na backend infrastrukturu (Cloud Function +
 * AI API klíč / dokumentovaný API kontrakt), kterou tenhle build zatím
 * nemá nasazenou — SEAM, ne implementováno naslepo.
 */
export type ImportMethod = 'ai_assisted' | 'template' | 'professional_api'
export type ImportJobStatus =
  | 'staging'
  | 'reviewing'
  | 'confirmed'
  | 'committed'
  | 'rolled_back'
  | 'failed'

export interface ImportSummary {
  fostersDetected: number
  childrenDetected: number
  agreementsDetected: number
  warnings: string[]
  errors: string[]
}

/**
 * Manifest Firestore document ID vytvořených entit při `commit` — jediný
 * způsob, jak `rollback` může spolehlivě smazat PŘESNĚ to, co import
 * založil, ne "doufat, že se nic nepokazilo" (§5.5).
 *
 * Šablona (cesta B) je HROMADNÝ import — jeden soubor typicky zakládá
 * MNOHO rodin najednou (řádky se seskupují podle "ID rodiny" napříč
 * listy), proto `familyDocIds` (pole, ne jeden dokument).
 *
 * `agreementFamilyDocIds` je podmnožina `familyDocIds` (jen ty rodiny, co
 * měly v souboru čistý řádek na listu "Dohody") — Dohoda má deterministické
 * ID (= organizationId, viz AgreementDoc), takže k jejímu smazání stačí
 * vědět KTEROU rodinu, ne ukládat samotné ID Dohody znovu.
 */
export interface ImportManifest {
  familyDocIds: string[]
  fosterPersonDocIds: string[]
  childDocIds: string[]
  agreementFamilyDocIds: string[]
}

export const ROLLBACK_WINDOW_DAYS = 30

export interface ImportJobDoc {
  organizationId: string
  method: ImportMethod
  status: ImportJobStatus
  summary?: ImportSummary
  manifest?: ImportManifest
  committedAt?: string | null
  rollbackDeadline?: string | null
  createdBy: string
  createdAt: string
}
