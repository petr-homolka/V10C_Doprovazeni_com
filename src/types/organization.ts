/**
 * organizations/{orgId} — ZADANI §4.1/§4.3. `orgCode` je 4místný OOOO
 * segment UID (přiděleno jednorázově při registraci, viz
 * src/lib/orgCode.ts) — jiná věc než Firestore document ID `orgId`.
 *
 * `koCapacityThreshold` — §6 A9 kapacita KO, DOPLNENI_ZADANI-DO-M5 §1:
 * orientační práh (NIKDY tvrdý limit), prostřední úroveň tříúrovňové
 * kaskády (per-KO `capacityThresholdOverride` > tohle > platformní
 * `platformDefaults.koCapacityThreshold`). Volitelné a NEVYPLŇUJE se
 * automaticky při registraci (na rozdíl od dřívějšího
 * `capacityWarningThreshold`, které tohle pole nahrazuje) — nenastavené
 * pole znamená "spadni na platformní výchozí", ne "25".
 */
export interface OrganizationDoc {
  orgCode: string
  name: string
  createdByUid: string
  createdAt: string
  koCapacityThreshold?: number
  /** Výchozí délka Dohody v měsících pro tuhle organizaci — prostřední
   * úroveň kaskády (per-Dohoda ruční datum > tohle > platformní
   * `platformDefaults.agreementDefaultDurationMonths`), viz
   * src/lib/agreementDuration.ts. Nenastavené pole = "spadni na
   * platformní výchozí", stejný vzor jako `koCapacityThreshold`. */
  agreementDefaultDurationMonths?: number
  /** §5.8 — nikdy dosud postavené v kódu (M0-M5 ho jen předjímalo). `plan`
   * samotný zůstává SEAM (`tier`/`billingNote` bez UI — "byznysové
   * rozhodnutí padne později", potvrzeno v NOVE-ZADANI-M6-AZ-KONEC.md) —
   * jen `entitlements` mapa se teď skutečně používá, a jen pro dva nové
   * M7 klíče (`qualityStandardsSelfAssessment`, `fosterProspectPipeline`).
   * Chybějící klíč = `false` (kromě `fosterProspectPipeline`, jehož
   * chybějící hodnota se čte jako `true`, dle zadání "výchozí true"). */
  plan?: {
    tier?: 'zakladni' | 'premium'
    entitlements?: Partial<Record<EntitlementKey, boolean>>
    billingNote?: string
  }
}

export const ENTITLEMENT_KEYS = [
  'aiAssistedImport',
  'scanExtraction',
  'serviceCatalog',
  'checklistFramework',
  'customTerminology',
  'accountingExport',
  'qualityStandardsSelfAssessment',
  'fosterProspectPipeline',
] as const
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number]
