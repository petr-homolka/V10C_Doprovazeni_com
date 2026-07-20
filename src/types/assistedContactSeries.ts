/**
 * families/{familyId}/assistedContactSeries/{seriesId} — M7 §B.10.2.
 * Asistovaný kontakt s biologickou rodinou (§47a odst. 2 písm. e) ZSPOD) —
 * tři fáze (příprava/asistence/vyhodnocení), vyhodnocení POVINNÉ (Instrukce
 * bod 7 to výslovně žádá, ne volitelný krok). `participantRefs` odkazuje
 * na existující `external_participants` (§5.1) — biologický rodič/osoba
 * blízká NENÍ druhá identita, jen odkaz.
 */
export interface AssistedContactScheduleRecurrence {
  frequency: 'weekly' | 'biweekly' | 'monthly'
  interval: number
}

export interface AssistedContactSeriesDoc {
  organizationId: string
  childRef: string
  participantRefs: Array<{ kind: 'externalParticipant'; id: string }>
  purpose: string
  schedule: {
    startDate: string
    endDate?: string | null
    recurrence: AssistedContactScheduleRecurrence
  }
  defaultLocation?: string
  defaultAssistingStaffUid?: string
  linkedIppdGoalId?: string | null
  status: 'aktivni' | 'ukoncena' | 'prerusena'
  createdBy: string
  createdAt: string
}

export type AssistedContactOccurrenceStatus = 'planovano' | 'priprava_hotova' | 'probehlo' | 'neprobehlo' | 'zruseno'

export interface AssistedContactOccurrenceDoc {
  plannedDate: string
  status: AssistedContactOccurrenceStatus
  preparation?: { staffUid: string; completedAt: string; note?: string } | null
  assistance?: { staffUid: string; actualDate: string; location: string; note?: string } | null
  /** POVINNÉ dle Instrukce, jakmile status='probehlo' — ne volitelný krok. */
  evaluation?: { evaluatedBy: string; evaluatedAt: string; summary: string; doporuceniProPristi?: string } | null
  costs?: {
    locationCost?: number
    transportChildCost?: number
    transportFosterCost?: number
    reason: string // POVINNÉ, pokud jakýkoli cost > 0
  } | null
  cancelReason?: string | null
}
