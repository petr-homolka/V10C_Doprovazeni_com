import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SupportExpenseDoc } from '@/types/supportExpense'

/** Barrel service — původní ZADANI §4.4.E. Profil dítěte NIKDY nezobrazuje
 * procenta/grafy čerpání SPVPP — jen tabulka dokladů. */

function expensesCollection(childId: string) {
  return collection(db, 'children', childId, 'supportExpenses')
}

export async function addSupportExpense(
  childId: string,
  data: Omit<SupportExpenseDoc, 'createdAt'>,
): Promise<string> {
  if (data.source === 'rucni' && !data.documentRef) {
    throw new Error('Ruční výdaj vyžaduje přiložený doklad (documentRef).')
  }
  const ref = doc(expensesCollection(childId))
  await setDoc(ref, { ...data, createdAt: new Date().toISOString() } satisfies SupportExpenseDoc)
  return ref.id
}

export async function listSupportExpenses(
  childId: string,
): Promise<Array<{ docId: string; expense: SupportExpenseDoc }>> {
  const snap = await getDocs(query(expensesCollection(childId), orderBy('periodFrom', 'desc')))
  return snap.docs.map((d) => ({ docId: d.id, expense: d.data() as SupportExpenseDoc }))
}

/** 3 souhrnné karty — poslední čtvrtletí/6 měsíců/rok, klouzavě od dneška
 * (ne kalendářní čtvrtletí). Klientský součet nad `listSupportExpenses` —
 * bez `where()` na `organizationId` dotaz nepotřebuje mirror kontrolu
 * (celá podkolekce dítěte je vždy jedné organizace). */
export function summarizeExpenses(
  expenses: SupportExpenseDoc[],
  today: Date = new Date(),
): { last90Days: number; last182Days: number; last365Days: number } {
  const DAY_MS = 24 * 60 * 60 * 1000
  const sumSince = (days: number) =>
    expenses
      .filter((e) => today.getTime() - new Date(e.periodFrom).getTime() <= days * DAY_MS)
      .reduce((sum, e) => sum + e.amount, 0)
  return { last90Days: sumSince(90), last182Days: sumSince(182), last365Days: sumSince(365) }
}
