/**
 * families/{familyId}/childHandovers/{id} — M7 §B.10.2, jednorázové
 * PŘEDÁVÁNÍ dítěte (ne opakující se asistovaný styk) — přechod z
 * přechodné pěstounské péče do biologické či jiné náhradní rodiny.
 */
export interface ChildHandoverDoc {
  organizationId: string
  childRef: string
  handoverDate: string
  toWhom: 'biologicka_rodina' | 'jina_nahradni_rodina'
  transportCost?: number
  accommodationNights?: number // MAX 5, jen u osob v evidenci (PPPD)
  accommodationCost?: number
  reason: string // odůvodněnost = vzdálenost bydliště
  createdBy: string
  createdAt: string
}
