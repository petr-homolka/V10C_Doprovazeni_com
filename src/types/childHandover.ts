/**
 * families/{familyId}/childHandovers/{id} — M7 §B.10.2, jednorázové
 * PŘEDÁVÁNÍ dítěte (ne opakující se asistovaný styk) — přechod z
 * přechodné pěstounské péče do biologické či jiné náhradní rodiny.
 *
 * UX zpětná vazba 2026-07-21: spravuje se na PROFILU DÍTĚTE (ne rodiny —
 * předání je vždy o konkrétním dítěti), přes drawer, editovatelně. Model
 * rozšířen o čas + místo + jména předávajícího/přebírajícího + vztah
 * přebírajícího k dítěti, aby řádek dával lidský smysl
 * ("kdy/kde · kdo → komu (vztah) · důvod"). `toWhom` zůstává jako kategorie
 * pro nárok na proplacení dopravy/ubytování (PPPD).
 */
export interface ChildHandoverDoc {
  organizationId: string
  childRef: string
  handoverDate: string // ISO datetime — nově včetně času
  place?: string
  fromPersonName?: string
  toPersonName?: string
  toPersonRelation?: string // vztah přebírajícího k dítěti (matka, teta, …)
  toWhom: 'biologicka_rodina' | 'jina_nahradni_rodina'
  transportCost?: number
  accommodationNights?: number // MAX 5, jen u osob v evidenci (PPPD)
  accommodationCost?: number
  reason: string // odůvodněnost = vzdálenost bydliště / rozsudek č. …
  createdBy: string
  createdAt: string
  updatedAt?: string
}
