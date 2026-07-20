/**
 * fosterProspects/{id} — M7 §B.7. Obyčejné Firestore ID (ne UID systém —
 * 001-IDENTITY_MODEL.md se na tohle nevztahuje, jde o pipeline PŘED
 * vznikem Dohody, ne evidovanou entitu). Anglický název kolekce záměrně,
 * ať nekoliduje s vyhláškovým "zájemce" (§2a-d, krajská evidence
 * žadatelů o osvojení/PP) — explicitně mimo rozsah (§J.1).
 */
export type FosterProspectExistingStatus =
  | 'jiz_pestoun_jinde'
  | 'jiz_pestoun_bez_do'
  | 'noveschvaleny_bez_do'
  | 'neznamo'

export type FosterProspectStatus =
  | 'v_jednani'
  | 'vznik_dohody'
  | 'odmitnuto_organizaci'
  | 'odmitnuto_zajemcem'
  | 'uspany'

export interface FosterProspectDoc {
  organizationId: string
  name: string
  contactEmail?: string
  contactPhone?: string
  source?: string
  existingFosterStatus: FosterProspectExistingStatus
  assignedTo?: string | null
  status: FosterProspectStatus
  resultingFamilyRef?: string | null
  lastContactAt?: string | null
  dormantSince?: string | null
  createdAt: string
}

export interface FosterProspectNoteDoc {
  authorUid: string
  text: string
  createdAt: string
}
