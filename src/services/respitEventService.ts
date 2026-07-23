import { collection, doc, getDoc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { RespitEventDoc, RespitStravaUbytovani } from '@/types/respitEvent'
import type { ChildDoc } from '@/types/child'
import { resolveRate } from '@/services/legislativeParameterService'

/**
 * Barrel service — původní ZADANI §4.4.B + oprava §B.5 (Pobyt): RODINA
 * platí stravu/ubytování dítěte (jiná dávka než SPVPP), organizace kryje
 * jen `organizaceDoplaci` (dopočet nad §5f strop) — TOHLE, ne rodinin
 * podíl, se počítá do SPVPP koše.
 */

function respitEventsCollection(familyId: string) {
  return collection(db, 'families', familyId, 'respitEvents')
}

export function computeDaysCount(dateFrom: string, dateTo: string): number {
  const from = new Date(dateFrom).getTime()
  const to = new Date(dateTo).getTime()
  const days = Math.round((to - from) / (24 * 60 * 60 * 1000)) + 1
  return Math.max(1, days)
}

/** §5f strop — resolved sazba × dny, MAX co smí organizace rodině účtovat. */
export async function computeStravaUbytovaniSplit(
  organizationId: string,
  daysCount: number,
  skutecneNaklady: number,
  includeUbytovani: boolean,
): Promise<RespitStravaUbytovani> {
  const stravaRate = await resolveRate('stravaCelodenni', { organizationId })
  const ubytovaniRate = includeUbytovani ? await resolveRate('ubytovaniDen', { organizationId }) : 0
  const strop = (stravaRate + ubytovaniRate) * daysCount
  const rodinaPrispivaCastka = Math.min(skutecneNaklady, strop)
  return {
    skutecneNaklady,
    rodinaPrispivaCastka,
    organizaceDoplaci: Math.max(0, skutecneNaklady - rodinaPrispivaCastka),
  }
}

export interface CreateRespitEventInput {
  familyId: string
  organizationId: string
  childIds: string[]
  dateFrom: string
  dateTo: string
  reason?: string
  cost?: number | null
  kind?: RespitEventDoc['kind']
  providerRef?: string | null
  stravaUbytovani?: RespitStravaUbytovani | null
  organizedWith?: RespitEventDoc['organizedWith']
  costCoveredByOrg?: number | null
  invoiceDocumentRef?: string | null
  paymentProofDocumentRef?: string | null
  createdBy: string
}

/** Transakčně zapíše respitEvent a inkrementuje `children/{id}.respitDaysUsed[year]`
 * pro KAŽDÉ dítě v `subjectRefs`. */
export async function createRespitEvent(input: CreateRespitEventInput): Promise<string> {
  const daysCount = computeDaysCount(input.dateFrom, input.dateTo)
  const calendarYear = new Date(input.dateFrom).getFullYear()
  const eventRef = doc(respitEventsCollection(input.familyId))
  const data: RespitEventDoc = {
    organizationId: input.organizationId,
    kind: input.kind ?? 'celodenni_pece',
    subjectRefs: input.childIds.map((id) => ({ kind: 'child' as const, id })),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    daysCount,
    calendarYear,
    providerRef: input.providerRef ?? null,
    ...(input.reason ? { reason: input.reason } : {}),
    cost: input.cost ?? null,
    organizedWith: input.organizedWith ?? null,
    costCoveredByOrg: input.costCoveredByOrg ?? null,
    stravaUbytovani: input.stravaUbytovani ?? null,
    invoiceDocumentRef: input.invoiceDocumentRef ?? null,
    paymentProofDocumentRef: input.paymentProofDocumentRef ?? null,
    daysCounted: daysCount,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  }
  await runTransaction(db, async (tx) => {
    const childRefs = input.childIds.map((id) => doc(db, 'children', id))
    const childSnaps = await Promise.all(childRefs.map((r) => tx.get(r)))
    tx.set(eventRef, data)
    childSnaps.forEach((snap, i) => {
      const child = snap.data() as ChildDoc
      const respitDaysUsed = { ...(child.respitDaysUsed ?? {}) }
      respitDaysUsed[String(calendarYear)] = (respitDaysUsed[String(calendarYear)] ?? 0) + daysCount
      tx.update(childRefs[i], { respitDaysUsed })
    })
  })
  return eventRef.id
}

export async function getChildRespitDaysForYear(childId: string, year: number): Promise<number> {
  const snap = await getDoc(doc(db, 'children', childId))
  const child = snap.data() as ChildDoc | undefined
  return child?.respitDaysUsed?.[String(year)] ?? 0
}
