/**
 * Vzdělávání pěstounů — původní ZADANI §4.4.A, teprve teď (M7) skutečně
 * postavené. `fosterPersons/{fosterId}.educationOfficial` je COMPLIANCE
 * počítadlo (resetuje se s každou novou Dohodou, §47a odst. 3 ZSPOD
 * "bankuje" přebytek do dalšího okna) — `educationLifetimeHours` je
 * NEZÁVISLÝ, nikdy se nenuluje, čistě informační součet napříč
 * organizacemi/Dohodami.
 */
export interface EducationOfficialWindow {
  agreementRef: string
  windowStart: string
  windowEnd: string
  hoursRequired: number // 24 (zprostředkovaná) / 18 (nezprostředkovaná)
  hoursCompletedInWindow: number
  hoursBankedFromPrevious: number
}

export interface BenefitCheckEntry {
  status: 'chodi' | 'nechodi' | 'nezjisteno'
  needsHelp: boolean
  note?: string
  updatedAt: string
}

/** §3.1 — POUZE stav (chodí/nechodí + potřebuje pomoc), NIKDY částka. */
export interface StateBenefitsMap {
  odmenaPestouna: BenefitCheckEntry
  prispevekPriPP: BenefitCheckEntry
  prispevekPriPrevzeti: BenefitCheckEntry
  prispevekNaVozidlo: BenefitCheckEntry
  zaopatrovaciPrispevek: BenefitCheckEntry
}

/** fosterPersons/{fosterId}/courses/{courseId} — TRVALÁ historie, nikdy se nemaže. */
export interface CourseDoc {
  organizationId: string
  title: string
  providerRef?: string | null // → institutions/{id}, TT=70
  type: 'prezencne' | 'online' | 'hybrid'
  hours: number
  occurredAt: string
  cost?: number | null // Kč, volitelné — pro SPVPP koš
  certificateFileRef?: string | null
  countsTowardOfficial: boolean
  /** DOPLNENI_ZADANI-DO-M5 §B.10.3 — supervize pěstouna je DVOJÍ věc se
   * stejným slovem: 'vzdelavaci' (počítá se do 24/18h, koš `vzdelavani`)
   * vs. 'podpurna' (nepočítá se, patří spíš do `supportExpenses.
   * supervizePodpurna`) — sketch, ještě "nedomyšleno" dle zadání, jen
   * rozlišující pole na záznamu, kde by supervize obsahově vypadala
   * jako vzdělávací kurz. */
  supervisionKind?: 'vzdelavaci' | 'podpurna' | null
  createdAt: string
}

/** fosterPersons/{fosterId}/benefitChecks/{id} — append-only audit, §3.1/§4.4.D. */
export interface BenefitCheckLogDoc {
  organizationId: string
  checkedAt: string
  checkedByUid: string
  findings: Partial<Record<keyof StateBenefitsMap, BenefitCheckEntry['status']>>
  needsIntervention: boolean
  note?: string
}

/**
 * fosterPersons/{fosterId}/courseEnrollments/{id} — §6 A10a, rigidní
 * 11-krokový tok (dvojí e-mailové potvrzení bez loginu, platba VŽDY
 * poskytovateli). §6 A10a/A10b anti-fraud pravidlo: `isFosterReimbursement`
 * je VÝJIMKA, ne alternativní cesta, vynucená na service layer
 * (courseEnrollmentService.ts), ne jen v UI.
 *
 * DOPLNENI_ZADANI-DO-M5 rozšíření (§A.2.1/A.2.4/B.5):
 * `travelReimbursement` VŽDY povoleno (samostatná kategorie, nezávislá na
 * politice refundace kurzovného). `multiDayAccommodation`/
 * `isFosterReimbursement`/`reimbursement*` jsou nové.
 */
export type CourseEnrollmentStatus =
  | 'navrzeno_KO'
  | 'zajem_pestoun'
  | 'ke_schvaleni_vedeni'
  | 'schvaleno_vedenim'
  | 'potvrzeno_pestounem'
  | 'potvrzeno_poskytovatelem'
  | 'absolvovano'
  | 'faktura_nahrana'
  | 'ukonceno'
  | 'zaplaceno'
  | 'zamitnuto'
  | 'zruseno'

export interface CourseEnrollmentDoc {
  organizationId: string
  serviceRef?: string | null // → institutions/{id}/services/{id}, TT=70
  initiatedBy: 'foster' | 'ko'
  status: CourseEnrollmentStatus
  koSentBy?: string | null
  koSentAt?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  rejectionNote?: string | null
  fosterConfirmToken?: string | null
  fosterConfirmedAt?: string | null
  providerConfirmToken?: string | null
  providerConfirmedAt?: string | null
  completedByProviderUid?: string | null
  completedAt?: string | null
  certificateFileRef?: string | null
  invoiceDocumentRef?: string | null
  invoiceUploadedAt?: string | null
  closedBy?: string | null
  closedAt?: string | null
  paidBy?: string | null
  paidAt?: string | null
  educationHoursApplied: boolean
  /** Plán vzdělávání (§B.2) — volitelné propojení, schvalovací gate zůstává oddělený. */
  planItemRef?: string | null
  /** §A.2.1 — cestovní náklady, VŽDY povoleno, nezávisle na politice refundace kurzovného. */
  travelReimbursement?: {
    amount: number
    kmDriven?: number | null
    documentedAt: string
  } | null
  /** §A.2.4 — ubytování pěstouna na vícedenním vzdělávání, 6h/den pravidlo. */
  multiDayAccommodation?: {
    nights: Array<{ date: string; hoursCompletedThatDay: number; hoursCompletedNextDay: number }>
    accommodationCost: number
    reimbursableAmount: number
  } | null
  /** §B.5.1 — smí být true JEN pokud policyResolutionService v okamžiku
   * vzniku vrátí 'povoleno' pro daný kontext. Vynuceno v service layer. */
  isFosterReimbursement?: boolean
  reimbursementReceiptRef?: string | null
  reimbursementReason?: string | null
  reimbursementApprovedBy?: string | null
  reimbursementApprovedAt?: string | null
  createdAt: string
}
