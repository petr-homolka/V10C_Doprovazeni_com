/**
 * families/{familyId}/documents/{docId} — ZADANI §4.1/§6 A1/§4.5. MINIMÁLNÍ
 * typ pro M2 (jen `createdByOrgId`/`status` scoping a §4.5 rules test
 * fixtures) — plný schvalovací automat (koncept → pěstoun → vedení →
 * uzavření → odeslání, verze, audit) přichází s M5. Nerozšiřuj tenhle typ
 * dopředu nad rámec toho, co M2 potřebuje pro rules.
 */
export type FamilyDocumentStatus =
  | 'koncept'
  | 'ceka_na_schvaleni'
  | 'uzavreno'
  | 'odeslano_ospod'
  | 'odeslano_soud'

export interface FamilyDocumentDoc {
  createdByOrgId: string
  status: FamilyDocumentStatus
  title: string
}
