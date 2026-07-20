import { collection, collectionGroup, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AgreementDoc } from '@/types/agreement'
import type { IppdDoc, IppdGoal } from '@/types/ippd'

/** Barrel service — M7 §B.4. Per Dohoda (agreementId=organizationId, M2),
 * ne per pěstoun. */

function ippdCollection(familyId: string, organizationId: string) {
  return collection(db, 'families', familyId, 'agreements', organizationId, 'ippd')
}

export async function createIppd(
  familyId: string,
  organizationId: string,
  periodFrom: string,
  periodTo: string,
  goals: IppdGoal[],
  createdBy: string,
  previousIppdRef?: string,
): Promise<string> {
  const ref = doc(ippdCollection(familyId, organizationId))
  const data: IppdDoc = {
    organizationId,
    periodFrom,
    periodTo,
    previousIppdRef: previousIppdRef ?? null,
    goals,
    // Termín vyhodnocení = konec platnosti plánu (`periodTo`) — IPPD nemá
    // vlastní "termín vyhodnocení" vstup při založení, `dueDate` je tak
    // odvozené hned tady, ne dopočítávané až v `evaluateIppd` (do té doby
    // by `evaluation` bylo `null` a §B.8 hlídání by nemělo co sledovat).
    evaluation: { dueDate: periodTo, completedAt: null, completedBy: null, summary: null, resultingDocumentRef: null },
    status: 'aktivni',
    createdBy,
    createdAt: new Date().toISOString(),
  }
  await setDoc(ref, data)
  return ref.id
}

export async function listIppds(familyId: string, organizationId: string): Promise<Array<{ docId: string; ippd: IppdDoc }>> {
  const snap = await getDocs(query(ippdCollection(familyId, organizationId), orderBy('periodFrom', 'desc')))
  return snap.docs.map((d) => ({ docId: d.id, ippd: d.data() as IppdDoc }))
}

export async function getActiveIppd(familyId: string, organizationId: string): Promise<{ docId: string; ippd: IppdDoc } | null> {
  const all = await listIppds(familyId, organizationId)
  return all.find((r) => r.ippd.status === 'aktivni') ?? null
}

export async function updateIppdGoals(
  familyId: string,
  organizationId: string,
  docId: string,
  goals: IppdGoal[],
): Promise<void> {
  await updateDoc(doc(ippdCollection(familyId, organizationId), docId), { goals })
}

/** §B.8 — vyhodnocení generuje report stejným vzorem jako A2 (M6), žádný
 * nový generátor — volající (UI) po zavolání tohohle použije stejnou
 * `ospodReportService.createReportDocument` cestu s vlastním markdownem. */
export async function evaluateIppd(
  familyId: string,
  organizationId: string,
  docId: string,
  evaluatedBy: string,
  summary: string,
  resultingDocumentRef?: string,
): Promise<void> {
  const ref = doc(ippdCollection(familyId, organizationId), docId)
  const snap = await getDoc(ref)
  const ippd = snap.data() as IppdDoc
  await updateDoc(ref, {
    status: 'vyhodnoceno',
    evaluation: {
      ...ippd.evaluation,
      completedAt: new Date().toISOString(),
      completedBy: evaluatedBy,
      summary,
      resultingDocumentRef: resultingDocumentRef ?? null,
    },
  })
}

export async function closeIppd(familyId: string, organizationId: string, docId: string): Promise<void> {
  await updateDoc(doc(ippdCollection(familyId, organizationId), docId), { status: 'uzavreno' })
}

export interface IppdNeedingAttention {
  familyId: string
  docId: string
  ippd: IppdDoc
  overdue: boolean
}

/**
 * §B.8 dashboard hlídání — IPPD s blížícím se/prošlým `evaluation.dueDate`,
 * ještě NEvyhodnocené. `ippd` je pod `families/{familyId}/agreements/
 * {agreementId}/ippd` (agreementId=organizationId, M2) — collectionGroup
 * pravidlo (`sameOrg(agreementId)`) čte PATH wildcard, ne `resource.data`,
 * takže by nešlo filtrovat collectionGroup dotaz na `organizationId`
 * bezpečně (§5 past). Místo toho: znovupoužije existující indexovaný
 * `agreements` collectionGroup dotaz (organizationId+status, M2) k získání
 * VLASTNÍCH aktivních Dohod organizace, pak přímý (ne group) `ippd` dotaz
 * na KAŽDOU — stejný "žádný where()" trik jako `cascadeResolution.ts`,
 * žádný nový index.
 */
export async function listIppdsNeedingAttention(
  organizationId: string,
  warningDays = 30,
  today: Date = new Date(),
): Promise<IppdNeedingAttention[]> {
  const agreementsSnap = await getDocs(
    query(
      collectionGroup(db, 'agreements'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'active'),
    ),
  )
  const results = await Promise.all(
    agreementsSnap.docs.map(async (agreementDoc) => {
      const agreement = agreementDoc.data() as AgreementDoc
      const familyId = agreement.familyId
      const all = await listIppds(familyId, organizationId)
      const dueSoon: IppdNeedingAttention[] = []
      for (const { docId, ippd } of all) {
        if (ippd.status !== 'aktivni' || !ippd.evaluation || ippd.evaluation.completedAt) continue
        const daysUntilDue = (new Date(ippd.evaluation.dueDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
        if (daysUntilDue <= warningDays) dueSoon.push({ familyId, docId, ippd, overdue: daysUntilDue < 0 })
      }
      return dueSoon
    }),
  )
  return results.flat()
}
