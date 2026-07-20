/**
 * fosterPersons/{fosterId}/educationPlans/{planId} — M7 §B.2. `estimatedCost`
 * NIKDY sám nevytváří `spvpp/expenses` — jen skutečný `cost` na `course` po
 * absolvování (přes `courseEnrollments.planItemRef` propojení, §B.3).
 */
export type EducationPlanStatus =
  | 'navrzeno'
  | 'ke_schvaleni_vedeni'
  | 'schvaleno_vedenim'
  | 'potvrzeno_pestounem'
  | 'aktivni'
  | 'uzavreno'
  | 'zamitnuto'

export interface EducationPlanItem {
  id: string
  categoryCode: string // → EDUCATION_TOPIC_CATEGORIES kód (a-g, jine)
  topicName: string
  needReason: string
  childRef?: string | null
  plannedHours: number
  estimatedCost?: number | null
  status: 'planovano' | 'objednano' | 'absolvovano' | 'zruseno'
  courseEnrollmentRef?: string | null
}

export interface EducationPlanDoc {
  organizationId: string
  agreementRef: string // = organizationId (deterministické ID Dohody)
  windowStart: string
  windowEnd: string
  items: EducationPlanItem[]
  totalEstimatedCost: number
  status: EducationPlanStatus
  proposedBy: string
  proposedAt: string
  approvedBy?: string | null
  approvedAt?: string | null
  rejectionNote?: string | null
  fosterConfirmedAt?: string | null
}
