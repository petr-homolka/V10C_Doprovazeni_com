import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
  BenefitCheckLogDoc,
  CourseDoc,
  CourseEnrollmentDoc,
  EducationOfficialWindow,
  StateBenefitsMap,
} from '@/types/course'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import { resolvePolicy } from '@/services/legislativeParameterService'

/**
 * Barrel service — M7 §4.4.A (vzdělávání) + §6 A10a (courseEnrollments).
 * Provider portál (`/poskytovatel/*`, magic-link bez loginu) je SEAM,
 * VĚDOMĚ mimo rozsah týhle dávky (NOVE-ZADANI-M6-AZ-KONEC.md ho jen
 * zmiňuje jako kontext k anti-fraud principu, neptá se na jeho stavbu) —
 * status přechody tady řídí přímo KO/vedení v hlavní appce, ne
 * neautentizovaný poskytovatel e-mailem. Datový model (status enum,
 * tokeny) je ale úplný a dopředu kompatibilní, kdyby portál přišel později.
 */

function coursesCollection(fosterPersonId: string) {
  return collection(db, 'fosterPersons', fosterPersonId, 'courses')
}
function benefitChecksCollection(fosterPersonId: string) {
  return collection(db, 'fosterPersons', fosterPersonId, 'benefitChecks')
}
function courseEnrollmentsCollection(fosterPersonId: string) {
  return collection(db, 'fosterPersons', fosterPersonId, 'courseEnrollments')
}

const HOURS_REQUIRED_BY_CARE_TYPE: Record<'zprostredkovana' | 'nezprostredkovana', number> = {
  zprostredkovana: 24,
  nezprostredkovana: 18,
}

/** §47a odst. 3 ZSPOD — nová Dohoda spouští reset okna, přebytek se
 * "bankuje" do nového. Volá se z `agreementService.createAgreement` pro
 * KAŽDÉHO pěstouna rodiny. */
export async function resetEducationWindowForNewAgreement(
  fosterPersonId: string,
  agreementRef: string,
  careType: 'zprostredkovana' | 'nezprostredkovana',
  windowStart: string,
): Promise<void> {
  const ref = doc(db, 'fosterPersons', fosterPersonId)
  const snap = await getDoc(ref)
  const existing = snap.data() as FosterPersonDoc | undefined
  const prevWindow = existing?.educationOfficial
  const surplus = prevWindow ? Math.max(0, prevWindow.hoursCompletedInWindow - prevWindow.hoursRequired) : 0
  const windowEnd = new Date(windowStart)
  windowEnd.setFullYear(windowEnd.getFullYear() + 1)
  const newWindow: EducationOfficialWindow = {
    agreementRef,
    windowStart,
    windowEnd: windowEnd.toISOString(),
    hoursRequired: HOURS_REQUIRED_BY_CARE_TYPE[careType],
    hoursCompletedInWindow: 0,
    hoursBankedFromPrevious: surplus,
  }
  await updateDoc(ref, { educationOfficial: newWindow })
}

export interface AddCourseInput {
  fosterPersonId: string
  organizationId: string
  title: string
  providerRef?: string | null
  type: CourseDoc['type']
  hours: number
  occurredAt: string
  cost?: number | null
  certificateFileRef?: string | null
  countsTowardOfficial: boolean
  supervisionKind?: CourseDoc['supervisionKind']
}

/** Transakčně inkrementuje `educationLifetimeHours` VŽDY a
 * `educationOfficial.hoursCompletedInWindow` JEN pokud `countsTowardOfficial`
 * a kurz spadá do aktuálního okna. */
export async function addCourse(input: AddCourseInput): Promise<string> {
  const courseRef = doc(coursesCollection(input.fosterPersonId))
  const fosterRef = doc(db, 'fosterPersons', input.fosterPersonId)
  const courseData: CourseDoc = {
    organizationId: input.organizationId,
    title: input.title,
    providerRef: input.providerRef ?? null,
    type: input.type,
    hours: input.hours,
    occurredAt: input.occurredAt,
    cost: input.cost ?? null,
    certificateFileRef: input.certificateFileRef ?? null,
    countsTowardOfficial: input.countsTowardOfficial,
    supervisionKind: input.supervisionKind ?? null,
    createdAt: new Date().toISOString(),
  }
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(fosterRef)
    const fp = snap.data() as FosterPersonDoc
    const lifetimeHours = (fp.educationLifetimeHours ?? 0) + input.hours
    const update: Partial<FosterPersonDoc> = { educationLifetimeHours: lifetimeHours }
    if (input.countsTowardOfficial && fp.educationOfficial) {
      const w = fp.educationOfficial
      const withinWindow = input.occurredAt >= w.windowStart && input.occurredAt <= w.windowEnd
      if (withinWindow) {
        update.educationOfficial = { ...w, hoursCompletedInWindow: w.hoursCompletedInWindow + input.hours }
      }
    }
    tx.set(courseRef, courseData)
    tx.update(fosterRef, update)
  })
  return courseRef.id
}

export async function listCourses(fosterPersonId: string): Promise<Array<{ docId: string; course: CourseDoc }>> {
  const snap = await getDocs(query(coursesCollection(fosterPersonId), orderBy('occurredAt', 'desc')))
  return snap.docs.map((d) => ({ docId: d.id, course: d.data() as CourseDoc }))
}

/** §3.1/§4.4.D — POUZE stav dávek, append-only audit log. */
export async function recordBenefitCheck(
  fosterPersonId: string,
  organizationId: string,
  checkedByUid: string,
  findings: BenefitCheckLogDoc['findings'],
  needsIntervention: boolean,
  note: string | undefined,
  updatedStateBenefits: StateBenefitsMap,
): Promise<void> {
  const logRef = doc(benefitChecksCollection(fosterPersonId))
  const logData: BenefitCheckLogDoc = {
    organizationId,
    checkedAt: new Date().toISOString(),
    checkedByUid,
    findings,
    needsIntervention,
    note,
  }
  await setDoc(logRef, logData)
  await updateDoc(doc(db, 'fosterPersons', fosterPersonId), { stateBenefits: updatedStateBenefits })
}

// ---- courseEnrollments (§6 A10a) ----------------------------------------

export interface CreateCourseEnrollmentInput {
  fosterPersonId: string
  organizationId: string
  initiatedBy: 'foster' | 'ko'
  serviceRef?: string | null
  planItemRef?: string | null
}

export async function createCourseEnrollment(input: CreateCourseEnrollmentInput): Promise<string> {
  const ref = doc(courseEnrollmentsCollection(input.fosterPersonId))
  const data: CourseEnrollmentDoc = {
    organizationId: input.organizationId,
    serviceRef: input.serviceRef ?? null,
    initiatedBy: input.initiatedBy,
    status: input.initiatedBy === 'foster' ? 'zajem_pestoun' : 'navrzeno_KO',
    educationHoursApplied: false,
    planItemRef: input.planItemRef ?? null,
    createdAt: new Date().toISOString(),
  }
  await setDoc(ref, data)
  return ref.id
}

export async function listCourseEnrollments(
  fosterPersonId: string,
): Promise<Array<{ docId: string; enrollment: CourseEnrollmentDoc }>> {
  const snap = await getDocs(courseEnrollmentsCollection(fosterPersonId))
  return snap.docs.map((d) => ({ docId: d.id, enrollment: d.data() as CourseEnrollmentDoc }))
}

async function updateEnrollment(fosterPersonId: string, docId: string, patch: Partial<CourseEnrollmentDoc>): Promise<void> {
  await updateDoc(doc(courseEnrollmentsCollection(fosterPersonId), docId), patch)
}

export const sendCourseEnrollmentToManagement = (fosterPersonId: string, docId: string, koUid: string) =>
  updateEnrollment(fosterPersonId, docId, { status: 'ke_schvaleni_vedeni', koSentBy: koUid, koSentAt: new Date().toISOString() })

export const approveCourseEnrollment = (fosterPersonId: string, docId: string, approverUid: string) =>
  updateEnrollment(fosterPersonId, docId, { status: 'schvaleno_vedenim', approvedBy: approverUid, approvedAt: new Date().toISOString() })

export const rejectCourseEnrollment = (fosterPersonId: string, docId: string, note: string) =>
  updateEnrollment(fosterPersonId, docId, { status: 'zamitnuto', rejectionNote: note })

export const confirmCourseEnrollmentByFoster = (fosterPersonId: string, docId: string) =>
  updateEnrollment(fosterPersonId, docId, { status: 'potvrzeno_pestounem', fosterConfirmedAt: new Date().toISOString() })

export const confirmCourseEnrollmentByProvider = (fosterPersonId: string, docId: string) =>
  updateEnrollment(fosterPersonId, docId, { status: 'potvrzeno_poskytovatelem', providerConfirmedAt: new Date().toISOString() })

/** Krok 8: absolvováno → OKAMŽITÝ odpočet hodin (ne až po faktuře),
 * zakládá trvalý `courses/{id}` záznam. `educationHoursApplied` hlídá
 * jednorázovost. */
export async function markCourseEnrollmentCompleted(
  fosterPersonId: string,
  docId: string,
  organizationId: string,
  completedByProviderUid: string,
  courseInput: { title: string; hours: number; type: CourseDoc['type']; occurredAt: string },
  certificateFileRef?: string,
): Promise<void> {
  const enrollmentRef = doc(courseEnrollmentsCollection(fosterPersonId), docId)
  const snap = await getDoc(enrollmentRef)
  const enrollment = snap.data() as CourseEnrollmentDoc
  if (enrollment.educationHoursApplied) return
  await addCourse({
    fosterPersonId,
    organizationId,
    title: courseInput.title,
    type: courseInput.type,
    hours: courseInput.hours,
    occurredAt: courseInput.occurredAt,
    countsTowardOfficial: true,
  })
  await updateEnrollment(fosterPersonId, docId, {
    status: 'absolvovano',
    completedByProviderUid,
    completedAt: new Date().toISOString(),
    certificateFileRef: certificateFileRef ?? null,
    educationHoursApplied: true,
  })
}

export const uploadCourseEnrollmentInvoice = (fosterPersonId: string, docId: string, invoiceDocumentRef: string) =>
  updateEnrollment(fosterPersonId, docId, { status: 'faktura_nahrana', invoiceDocumentRef, invoiceUploadedAt: new Date().toISOString() })

export const closeCourseEnrollment = (fosterPersonId: string, docId: string, closedBy: string) =>
  updateEnrollment(fosterPersonId, docId, { status: 'ukonceno', closedBy, closedAt: new Date().toISOString() })

export const markCourseEnrollmentPaid = (fosterPersonId: string, docId: string, paidBy: string) =>
  updateEnrollment(fosterPersonId, docId, { status: 'zaplaceno', paidBy, paidAt: new Date().toISOString() })

/** §A.2.1 — cestovní náklady VŽDY povoleno, nezávisle na politice refundace kurzovného. */
export const setCourseEnrollmentTravelReimbursement = (
  fosterPersonId: string,
  docId: string,
  travel: NonNullable<CourseEnrollmentDoc['travelReimbursement']>,
) => updateEnrollment(fosterPersonId, docId, { travelReimbursement: travel })

/** §A.2.4 — ubytování na vícedenním vzdělávání, 6h/den pravidlo:
 * proplatitelné jsou jen noci, kde OBA sousední dny mají >=6 hodin. */
export function computeReimbursableAccommodation(
  nights: NonNullable<CourseEnrollmentDoc['multiDayAccommodation']>['nights'],
  accommodationCost: number,
  ratePerNight: number,
): { validNights: number; reimbursableAmount: number } {
  const validNights = nights.filter((n) => n.hoursCompletedThatDay >= 6 && n.hoursCompletedNextDay >= 6).length
  const reimbursableAmount = Math.min(accommodationCost, ratePerNight * validNights)
  return { validNights, reimbursableAmount }
}

/**
 * §B.5.1/§6 A10b anti-fraud pravidlo, VYNUCENO TADY (ne jen v UI): zápis
 * `isFosterReimbursement=true` bez `reimbursementReason` MUSÍ selhat, a
 * politika MUSÍ být 'povoleno' v okamžiku vzniku — jinak throw, žádné
 * tiché zamítnutí.
 */
export async function setCourseEnrollmentFosterReimbursement(
  fosterPersonId: string,
  docId: string,
  organizationId: string,
  context: { familyId?: string; koUid?: string },
  input: { receiptRef: string; reason: string; approvedBy: string },
): Promise<void> {
  if (!input.reason.trim()) {
    throw new Error('Refundace pěstounovi vyžaduje zdůvodnění (reimbursementReason).')
  }
  const policy = await resolvePolicy('kurzovneRefundace', {
    fosterPersonId,
    familyId: context.familyId,
    koUid: context.koUid,
    organizationId,
  })
  if (policy !== 'povoleno') {
    throw new Error('Refundace kurzovného přímo pěstounovi není pro tenhle kontext povolená politikou.')
  }
  await updateEnrollment(fosterPersonId, docId, {
    isFosterReimbursement: true,
    reimbursementReceiptRef: input.receiptRef,
    reimbursementReason: input.reason,
    reimbursementApprovedBy: input.approvedBy,
    reimbursementApprovedAt: new Date().toISOString(),
  })
}
