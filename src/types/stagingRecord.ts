/**
 * organizations/{orgId}/importJobs/{jobId}/stagingRecords/{id} — ZADANI
 * §5.5. Šablona (cesta B) má tři listy (Pěstouni/Děti/Dohody) — každý
 * řádek nese sloupec "ID rodiny" (`externalFamilyRef`, volný text z
 * originálního souboru organizace), který slouží VÝHRADNĚ ke SPÁROVÁNÍ
 * řádků do jedné rodiny při `commit` (§4.1 Spis nemá trvalé pole na
 * externí ref — po commitu se zahazuje, není to totéž jako `externalId`
 * idempotence z cesty C, to je jiný, přísnější požadavek jen pro
 * profesionální API import).
 */
export type StagingEntityType = 'fosterPerson' | 'child' | 'agreement'

export interface StagingFosterPersonFields {
  externalFamilyRef: string
  firstName: string
  lastName: string
  phone?: string
  email?: string
}

export interface StagingChildFields {
  externalFamilyRef: string
  firstName: string
  lastName: string
  birthNumber: string
}

export interface StagingAgreementFields {
  externalFamilyRef: string
  careType: 'zprostredkovana' | 'nezprostredkovana'
  validFrom: string
}

export type StagingMappedEntity =
  | { type: 'fosterPerson'; fields: StagingFosterPersonFields }
  | { type: 'child'; fields: StagingChildFields }
  | { type: 'agreement'; fields: StagingAgreementFields }

export interface StagingRecordDoc {
  rawRow: Record<string, string>
  mappedEntity: StagingMappedEntity
  /** Jen cesta A (AI-asistovaný) — cesta B má vždy 1 (sloupce už sedí). */
  confidence: number
  issues: string[]
}
