/**
 * families/{familyId}/agreements/{agreementId}/ippd/{ippdId} — M7 §B.4.
 * Per Dohoda (díky `agreementId=organizationId`, M2), ne per pěstoun.
 * Checklist engine zvažován a zamítnut jako základ — jednorázové vyplnění
 * vs. živý měsíce trvající stav.
 */
export interface IppdGoalStep {
  id: string
  description: string
  dueDate?: string | null
  done: boolean
}

export interface IppdGoal {
  id: string
  description: string
  responsibleRef: { kind: 'fosterPerson' | 'staff' | 'child'; id: string }
  steps: IppdGoalStep[]
  status: 'aktivni' | 'splneno' | 'zruseno'
  carriedFromGoalId?: string | null
}

export interface IppdEvaluation {
  dueDate: string
  completedAt?: string | null
  completedBy?: string | null
  summary?: string | null
  resultingDocumentRef?: string | null
}

export interface IppdDoc {
  organizationId: string
  periodFrom: string
  periodTo: string
  previousIppdRef?: string | null
  goals: IppdGoal[]
  evaluation: IppdEvaluation | null
  status: 'aktivni' | 'vyhodnoceno' | 'uzavreno'
  createdBy: string
  createdAt: string
}
