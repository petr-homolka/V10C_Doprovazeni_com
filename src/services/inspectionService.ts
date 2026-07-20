import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { InspectionDoc, InspectionFinding } from '@/types/inspection'

/** Barrel service — M7 §B.6 (jen evidence inspekcí — sebehodnocení je SEAM,
 * čeká na M12 checklist engine, viz types/inspection.ts komentář).
 * `maxPossibleScore` VŽDY z reálného počtu `findings`, ne z pevné konstanty. */

function inspectionsCollection(organizationId: string) {
  return collection(db, 'organizations', organizationId, 'inspections')
}

export async function createInspection(
  organizationId: string,
  input: Omit<InspectionDoc, 'totalScore' | 'maxPossibleScore' | 'scorePercentage' | 'organizationId' | 'createdAt'>,
  createdBy: string,
): Promise<string> {
  const totalScore = input.findings.reduce((sum, f) => sum + f.score, 0)
  const maxPossibleScore = input.findings.length * 3
  const ref = doc(inspectionsCollection(organizationId))
  const data: InspectionDoc = {
    ...input,
    organizationId,
    createdBy,
    totalScore,
    maxPossibleScore,
    scorePercentage: maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0,
    createdAt: new Date().toISOString(),
  }
  await setDoc(ref, data)
  return ref.id
}

export async function listInspections(organizationId: string): Promise<Array<{ docId: string; inspection: InspectionDoc }>> {
  const snap = await getDocs(query(inspectionsCollection(organizationId), orderBy('inspectionDateFrom', 'desc')))
  return snap.docs.map((d) => ({ docId: d.id, inspection: d.data() as InspectionDoc }))
}

export async function markCorrectiveActionCompleted(
  organizationId: string,
  docId: string,
  criterionCode: string,
  findings: InspectionFinding[],
): Promise<void> {
  const updated = findings.map((f) =>
    f.criterionCode === criterionCode ? { ...f, correctiveCompletedAt: new Date().toISOString() } : f,
  )
  await updateDoc(doc(inspectionsCollection(organizationId), docId), { findings: updated })
}

/** §B.8 dashboard hlídání — inspekce s aspoň jedním prošlým/blížícím se
 * `correctiveDeadline`, ve kterém `correctiveCompletedAt` ještě chybí. */
export function findOverdueCorrectiveActions(
  inspections: Array<{ docId: string; inspection: InspectionDoc }>,
  today: Date = new Date(),
): Array<{ docId: string; criterionCode: string; correctiveDeadline: string; overdue: boolean }> {
  const result: Array<{ docId: string; criterionCode: string; correctiveDeadline: string; overdue: boolean }> = []
  for (const { docId, inspection } of inspections) {
    for (const f of inspection.findings) {
      if (f.correctiveDeadline && !f.correctiveCompletedAt) {
        result.push({
          docId,
          criterionCode: f.criterionCode,
          correctiveDeadline: f.correctiveDeadline,
          overdue: new Date(f.correctiveDeadline) < today,
        })
      }
    }
  }
  return result
}
