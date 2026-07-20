/**
 * organizations/{orgId}/inspections/{id} — M7 §B.6. Bodový systém 0/1/2/3
 * dle §6 odst. 2 vyhlášky (3 výborně / 2 dobře / 1 částečně / 0 nesplněno).
 * `maxPossibleScore` se VŽDY počítá z reálného počtu `findings` (přílohy
 * 2/4 mají výjimky "kritérium se nehodnotí u..."), NIKDY z pevného počtu
 * kritérií v příloze — jinak by u typů s výjimkami vycházelo falešně nízké
 * procento.
 *
 * Sebehodnocení (druhá polovina §B.6, `checklistTemplates`/`checklistRuns`
 * se `qualityStandardRef`) je SEAM — čeká na M12 (obecný checklist engine),
 * zadání samo říká "nezávisí na M6", takže se nestaví v týhle dávce.
 * `scorePercentage` se počítá a zobrazuje, ale BEZ zabudované interpretace
 * (vyhovuje/nevyhovuje) — zadání samo přiznává, že práh/interpretaci
 * nemá k dispozici; číslo je k vlastnímu posouzení organizace.
 */
export type QualityStandardRef = 'priloha_2' | 'priloha_4'

export interface InspectionFinding {
  criterionCode: string
  score: 0 | 1 | 2 | 3
  deficiencyNote?: string
  correctiveAction?: string
  correctiveDeadline?: string | null
  correctiveCompletedAt?: string | null
}

export interface InspectionDoc {
  organizationId: string
  inspectionDateFrom: string
  inspectionDateTo: string
  inspectingAuthorityName: string
  subject: string
  standardRef: QualityStandardRef
  findings: InspectionFinding[]
  totalScore: number
  maxPossibleScore: number
  scorePercentage: number
  resultDocumentRef?: string | null
  createdBy: string
  createdAt: string
}
