/**
 * families/{familyId}/timeline/{id} — ZADANI §4.1/§7/§4.5. MINIMÁLNÍ typ
 * pro M2 (jen `createdByOrgId` scoping a §4.5 rules test fixtures) — plný
 * tvar (GPS, `subjectRefs[]`, `sharingLevel`, `voice_entry.originalTranscript`
 * atd.) přichází s M3, kdy vzniká i skutečný zápisník/UI. Nerozšiřuj tenhle
 * typ dopředu nad rámec toho, co M2 potřebuje pro rules.
 */
export type TimelineEntryKind = 'note' | 'visit' | 'voice_entry' | 'system' | 'document'

export interface TimelineEntryDoc {
  type: TimelineEntryKind
  createdByOrgId: string
  occurredAt: string
}
