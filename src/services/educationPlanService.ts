import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { EducationPlanDoc, EducationPlanItem, EducationPlanStatus } from '@/types/educationPlan'

/** Barrel service — M7 §B.2/§B.3. `estimatedCost` NIKDY sám nevytváří
 * spvpp/expenses — jen skutečný `cost` na `course` po absolvování. */

function plansCollection(fosterPersonId: string) {
  return collection(db, 'fosterPersons', fosterPersonId, 'educationPlans')
}

export async function createEducationPlan(
  fosterPersonId: string,
  organizationId: string,
  agreementRef: string,
  windowStart: string,
  windowEnd: string,
  items: EducationPlanItem[],
  proposedBy: string,
): Promise<string> {
  const ref = doc(plansCollection(fosterPersonId))
  const totalEstimatedCost = items.reduce((sum, i) => sum + (i.estimatedCost ?? 0), 0)
  const data: EducationPlanDoc = {
    organizationId,
    agreementRef,
    windowStart,
    windowEnd,
    items,
    totalEstimatedCost,
    status: 'navrzeno',
    proposedBy,
    proposedAt: new Date().toISOString(),
  }
  await setDoc(ref, data)
  return ref.id
}

export async function listEducationPlans(
  fosterPersonId: string,
): Promise<Array<{ docId: string; plan: EducationPlanDoc }>> {
  const snap = await getDocs(query(plansCollection(fosterPersonId), orderBy('proposedAt', 'desc')))
  return snap.docs.map((d) => ({ docId: d.id, plan: d.data() as EducationPlanDoc }))
}

async function updatePlanStatus(
  fosterPersonId: string,
  docId: string,
  status: EducationPlanStatus,
  extra: Partial<EducationPlanDoc> = {},
): Promise<void> {
  await updateDoc(doc(plansCollection(fosterPersonId), docId), { status, ...extra })
}

export const sendEducationPlanToManagement = (fosterPersonId: string, docId: string) =>
  updatePlanStatus(fosterPersonId, docId, 'ke_schvaleni_vedeni')

export const approveEducationPlan = (fosterPersonId: string, docId: string, approvedBy: string) =>
  updatePlanStatus(fosterPersonId, docId, 'schvaleno_vedenim', { approvedBy, approvedAt: new Date().toISOString() })

export const rejectEducationPlan = (fosterPersonId: string, docId: string, rejectionNote: string) =>
  updatePlanStatus(fosterPersonId, docId, 'zamitnuto', { rejectionNote })

export const fosterConfirmEducationPlan = (fosterPersonId: string, docId: string) =>
  updatePlanStatus(fosterPersonId, docId, 'potvrzeno_pestounem', { fosterConfirmedAt: new Date().toISOString() })

export const activateEducationPlan = (fosterPersonId: string, docId: string) =>
  updatePlanStatus(fosterPersonId, docId, 'aktivni')

export const closeEducationPlan = (fosterPersonId: string, docId: string) =>
  updatePlanStatus(fosterPersonId, docId, 'uzavreno')
