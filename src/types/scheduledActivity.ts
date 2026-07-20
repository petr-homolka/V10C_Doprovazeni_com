/**
 * children/{childId}/scheduledActivities/{id} — původní ZADANI §4.4.B.1.
 * `isRespit` je VŽDY explicitní volba (kritérium = platí to organizace?),
 * NIKDY odvozeno z `activityType` — jen `isRespit=true` aktivity vstupují
 * do SPVPP koše (§4.4.C) a evidence výdajů dítěte (§4.4.E), MVP hranice.
 *
 * `osobniPeceDuvod` — DOPLNENI_ZADANI-DO-M5 §B.10.1, lehký sketch (žádná
 * počítající logika, jen rozlišující pole — "domluvíme se dál").
 */
export type ScheduledActivityType = 'doucovani' | 'hlidani' | 'krouzek' | 'jine'
export type ScheduledActivityProviderKind = 'interni' | 'externi'
export type ScheduledActivityConfirmationMode = 'potvrzuje_se' | 'presumuje_se'
export type ScheduledActivityOccurrenceStatus = 'planovano' | 'probehlo' | 'neprobehlo' | 'presumovano'

export interface ScheduledActivityDoc {
  organizationId: string
  activityType: ScheduledActivityType
  providerKind: ScheduledActivityProviderKind
  internalStaffUid?: string | null
  externalInstitutionRef?: string | null
  isRespit: boolean
  confirmationMode: ScheduledActivityConfirmationMode
  schedule: {
    startDate: string
    endDate?: string | null
    recurrence: { frequency: 'weekly' | 'daily'; daysOfWeek: number[]; durationMinutes: number }
  }
  rate: { amountPerHour: number }
  rateWasOverridden: boolean
  osobniPeceDuvod?: 'docasna_pn' | 'osetreni_osoby_blizke' | 'narozeni_ditete' | 'vzdelavani' | 'umrti_osoby_blizke' | null
  createdBy: string
  createdAt: string
}

export interface ScheduledActivityOccurrenceDoc {
  date: string
  status: ScheduledActivityOccurrenceStatus
  confirmedBy?: string | null
  confirmedAt?: string | null
}
