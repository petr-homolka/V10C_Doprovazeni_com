import { collection, doc, getDoc, getDocs, runTransaction, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SpvppBucketSnapshot, SpvppDoc, SpvppExpenseDoc } from '@/types/spvpp'
import { getSpvppBucketRange } from '@/services/legislativeParameterService'

/** Barrel service — původní ZADANI §4.4.C, vyhláška 477/2024 Sb. §5c. */

function spvppDocRef(organizationId: string, year: number) {
  return doc(db, 'organizations', organizationId, 'spvpp', String(year))
}
function expensesCollection(organizationId: string, year: number) {
  return collection(db, 'organizations', organizationId, 'spvpp', String(year), 'expenses')
}

export async function getOrCreateSpvppYear(organizationId: string, year: number, agreementsCountBasis: number): Promise<SpvppDoc> {
  const ref = spvppDocRef(organizationId, year)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as SpvppDoc
  const [osobniPeceARespit, poradenstviPsychoKontakt, vzdelavani] = await Promise.all([
    getSpvppBucketRange('spvppOsobniPeceARespit'),
    getSpvppBucketRange('spvppPoradenstviPsychoKontakt'),
    getSpvppBucketRange('spvppVzdelavani'),
  ])
  const zeroSnapshot = (r: { minPct: number; maxPct: number }): SpvppBucketSnapshot => ({
    ...r,
    plannedAmount: 0,
    actualAmount: 0,
  })
  const data: SpvppDoc = {
    agreementsCountBasis,
    status: 'planned',
    deadlines: { requestBy: `${year}-01-15`, reportBy: `${year}-03-31`, returnBy: `${year}-04-30` },
    buckets: {
      osobniPeceARespit: zeroSnapshot(osobniPeceARespit),
      poradenstviPsychoKontakt: zeroSnapshot(poradenstviPsychoKontakt),
      vzdelavani: zeroSnapshot(vzdelavani),
      provozMzdy: { actualAmount: 0 },
    },
  }
  await setDoc(ref, data)
  return data
}

export interface AddSpvppExpenseInput {
  organizationId: string
  year: number
  bucket: SpvppExpenseDoc['bucket']
  amount: number
  date: string
  note?: string
  documentRef?: string | null
  sourceRef?: string | null
  childRef?: string | null
  createdBy: string
}

/** Tři způsoby vzniku (automaticky ze `sourceRef`, ručně s `childRef`, ručně
 * celoorganizačně s povinným `documentRef`) — volající si vybere, tenhle
 * soubor jen vynucuje "documentRef povinný, je-li sourceRef i childRef
 * prázdné" a transakčně přepočítává `buckets.*.actualAmount`. */
export async function addSpvppExpense(input: AddSpvppExpenseInput): Promise<string> {
  if (!input.sourceRef && !input.childRef && !input.documentRef) {
    throw new Error('Celoorganizační výdaj bez zdroje/dítěte vyžaduje documentRef.')
  }
  const spvppRef = spvppDocRef(input.organizationId, input.year)
  const expenseRef = doc(expensesCollection(input.organizationId, input.year))
  const data: SpvppExpenseDoc = {
    bucket: input.bucket,
    amount: input.amount,
    date: input.date,
    note: input.note,
    documentRef: input.documentRef ?? null,
    sourceRef: input.sourceRef ?? null,
    childRef: input.childRef ?? null,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  }
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(spvppRef)
    const spvpp = snap.data() as SpvppDoc
    tx.set(expenseRef, data)
    if (input.bucket === 'provozMzdy') {
      tx.update(spvppRef, { 'buckets.provozMzdy.actualAmount': spvpp.buckets.provozMzdy.actualAmount + input.amount })
    } else {
      tx.update(spvppRef, {
        [`buckets.${input.bucket}.actualAmount`]: spvpp.buckets[input.bucket].actualAmount + input.amount,
      })
    }
  })
  return expenseRef.id
}

export async function listSpvppExpenses(
  organizationId: string,
  year: number,
): Promise<Array<{ docId: string; expense: SpvppExpenseDoc }>> {
  const snap = await getDocs(expensesCollection(organizationId, year))
  return snap.docs.map((d) => ({ docId: d.id, expense: d.data() as SpvppExpenseDoc }))
}
