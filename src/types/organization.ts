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
}
