import { collection, collectionGroup, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
  AssistedContactOccurrenceDoc,
  AssistedContactOccurrenceStatus,
  AssistedContactSeriesDoc,
} from '@/types/assistedContactSeries'
import type { ChildHandoverDoc } from '@/types/childHandover'
import { addSpvppExpense } from '@/services/spvppService'

/** Barrel service — M7 §B.10.2. Asistovaný kontakt s biologickou rodinou
 * (§47a odst. 2 písm. e) ZSPOD) — vyhodnocení POVINNÉ, ne volitelný krok. */

function seriesCollection(familyId: string) {
  return collection(db, 'families', familyId, 'assistedContactSeries')
}
function occurrencesCollection(familyId: string, seriesId: string) {
  return collection(db, 'families', familyId, 'assistedContactSeries', seriesId, 'occurrences')
}

export async function createAssistedContactSeries(
  familyId: string,
  data: Omit<AssistedContactSeriesDoc, 'createdAt' | 'status'>,
): Promise<string> {
  const ref = doc(seriesCollection(familyId))
  await setDoc(ref, { ...data, status: 'aktivni', createdAt: new Date().toISOString() } satisfies AssistedContactSeriesDoc)
  return ref.id
}

/**
 * §5 past — rules `assistedContactSeries` read čte `resource.data.
 * organizationId` (`sameOrg`), takže LIST dotaz musí tenhle filtr zrcadlit
 * (jinak Firestore zamítne celý dotaz), i když v rámci jedné rodiny/
 * organizace jde vždy jen o pár záznamů.
 */
export async function listAssistedContactSeries(
  familyId: string,
  organizationId: string,
): Promise<Array<{ docId: string; series: AssistedContactSeriesDoc }>> {
  const snap = await getDocs(query(seriesCollection(familyId), where('organizationId', '==', organizationId)))
  return snap.docs.map((d) => ({ docId: d.id, series: d.data() as AssistedContactSeriesDoc }))
}

export async function scheduleOccurrence(familyId: string, seriesId: string, plannedDate: string): Promise<string> {
  const ref = doc(occurrencesCollection(familyId, seriesId))
  await setDoc(ref, { plannedDate, status: 'planovano' } satisfies AssistedContactOccurrenceDoc)
  return ref.id
}

export async function listOccurrences(
  familyId: string,
  seriesId: string,
): Promise<Array<{ docId: string; occurrence: AssistedContactOccurrenceDoc }>> {
  const snap = await getDocs(query(occurrencesCollection(familyId, seriesId), orderBy('plannedDate', 'desc')))
  return snap.docs.map((d) => ({ docId: d.id, occurrence: d.data() as AssistedContactOccurrenceDoc }))
}

export async function markPreparationDone(
  familyId: string,
  seriesId: string,
  occurrenceId: string,
  staffUid: string,
  note?: string,
): Promise<void> {
  await updateDoc(doc(occurrencesCollection(familyId, seriesId), occurrenceId), {
    status: 'priprava_hotova',
    preparation: { staffUid, completedAt: new Date().toISOString(), ...(note ? { note } : {}) },
  })
}

export async function markAssistanceDone(
  familyId: string,
  seriesId: string,
  occurrenceId: string,
  staffUid: string,
  location: string,
  note?: string,
): Promise<void> {
  await updateDoc(doc(occurrencesCollection(familyId, seriesId), occurrenceId), {
    status: 'probehlo',
    assistance: { staffUid, actualDate: new Date().toISOString(), location, ...(note ? { note } : {}) },
  })
}

/** Instrukce bod 7 — vyhodnocení je POVINNÝ krok po `probehlo`, ne volitelný. */
export async function evaluateOccurrence(
  familyId: string,
  seriesId: string,
  occurrenceId: string,
  evaluatedBy: string,
  summary: string,
  doporuceniProPristi?: string,
): Promise<void> {
  await updateDoc(doc(occurrencesCollection(familyId, seriesId), occurrenceId), {
    evaluation: { evaluatedBy, evaluatedAt: new Date().toISOString(), summary, ...(doporuceniProPristi ? { doporuceniProPristi } : {}) },
  })
}

/** Náklady → nabídne/vytvoří spvpp/expenses v koši `poradenstviPsychoKontakt`. */
export async function recordOccurrenceCostsAndFileSpvpp(
  familyId: string,
  seriesId: string,
  occurrenceId: string,
  organizationId: string,
  year: number,
  costs: NonNullable<AssistedContactOccurrenceDoc['costs']>,
  createdBy: string,
): Promise<void> {
  if (!costs.reason?.trim()) {
    throw new Error('Náklady na asistovaný kontakt vyžadují zdůvodnění (reason).')
  }
  await updateDoc(doc(occurrencesCollection(familyId, seriesId), occurrenceId), { costs })
  const total = (costs.locationCost ?? 0) + (costs.transportChildCost ?? 0) + (costs.transportFosterCost ?? 0)
  if (total > 0) {
    await addSpvppExpense({
      organizationId,
      year,
      bucket: 'poradenstviPsychoKontakt',
      amount: total,
      date: new Date().toISOString(),
      note: costs.reason,
      sourceRef: `assistedContactSeries/${seriesId}/occurrences/${occurrenceId}`,
      createdBy,
    })
  }
}

export async function cancelOccurrence(
  familyId: string,
  seriesId: string,
  occurrenceId: string,
  cancelReason: string,
): Promise<void> {
  await updateDoc(doc(occurrencesCollection(familyId, seriesId), occurrenceId), {
    status: 'zruseno' satisfies AssistedContactOccurrenceStatus,
    cancelReason,
  })
}

/** §B.10.2 — jednorázové předání dítěte, samostatný jednodušší záznam. */
function handoversCollection(familyId: string) {
  return collection(db, 'families', familyId, 'childHandovers')
}

export async function createChildHandover(familyId: string, data: Omit<ChildHandoverDoc, 'createdAt'>): Promise<string> {
  const ref = doc(handoversCollection(familyId))
  await setDoc(ref, { ...data, createdAt: new Date().toISOString() } satisfies ChildHandoverDoc)
  return ref.id
}

/** Editace předání (UX zpětná vazba 2026-07-21 — dřív šlo jen založit,
 * `firestore.rules` mělo `update: if false`, oprava překlepu byla nemožná).
 * Nikdy nemění `organizationId`/`childRef`/`createdBy` — jen obsah + `updatedAt`. */
export async function updateChildHandover(
  familyId: string,
  handoverId: string,
  patch: Partial<Omit<ChildHandoverDoc, 'organizationId' | 'childRef' | 'createdBy' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(handoversCollection(familyId), handoverId), { ...patch, updatedAt: new Date().toISOString() })
}

/**
 * §5 past — rules `childHandovers` read čte `resource.data.organizationId`
 * (`sameOrg`), LIST dotaz to musí zrcadlit. Kombinace `where(organizationId)`
 * + `orderBy(handoverDate)` na RŮZNÝCH polích by vyžadovala nový composite
 * index — místo toho se řadí až klientsky (predávání dítěte je na rodinu
 * vzácná událost, pár záznamů nanejvýš).
 */
export async function listChildHandovers(
  familyId: string,
  organizationId: string,
): Promise<Array<{ docId: string; handover: ChildHandoverDoc }>> {
  const snap = await getDocs(query(handoversCollection(familyId), where('organizationId', '==', organizationId)))
  return snap.docs
    .map((d) => ({ docId: d.id, handover: d.data() as ChildHandoverDoc }))
    .sort((a, b) => b.handover.handoverDate.localeCompare(a.handover.handoverDate))
}

/** Předání jen pro JEDNO dítě (profil dítěte) — filtruje klientsky nad
 * rodinným seznamem (pár záznamů, žádný nový index). */
export async function listChildHandoversForChild(
  familyId: string,
  organizationId: string,
  childRef: string,
): Promise<Array<{ docId: string; handover: ChildHandoverDoc }>> {
  return (await listChildHandovers(familyId, organizationId)).filter((h) => h.handover.childRef === childRef)
}

/** §B.8 dashboard — occurrence v minulosti, stav stále `planovano` → zapomenuté zaznamenání. */
export function findForgottenOccurrences(
  allOccurrences: Array<{ seriesId: string; docId: string; occurrence: AssistedContactOccurrenceDoc }>,
  today: Date = new Date(),
): Array<{ seriesId: string; docId: string; occurrence: AssistedContactOccurrenceDoc }> {
  return allOccurrences.filter(
    ({ occurrence }) => occurrence.status === 'planovano' && new Date(occurrence.plannedDate) < today,
  )
}

/**
 * §B.8 dashboard hlídání, napříč CELOU organizací. `assistedContactSeries`
 * pravidlo je deklarované na PEVNÉ cestě (`match /families/{familyId}/
 * assistedContactSeries/{id}`), ne `{path=**}` wildcard prefix jako
 * `agreements`/`timeline`/`documents` — živě ověřeno 2026-07-20:
 * `collectionGroup(db,'assistedContactSeries')` na tohle spadne na
 * permission-denied bez ohledu na `where()` filtr, protože Firestore
 * pravidla s pevným prefixem se na `collectionGroup` dotaz vůbec
 * nenapojí (na rozdíl od `{path=**}` prefixu). Řešení: stejný trik jako
 * `ippdService.listIppdsNeedingAttention` — znovupoužije existující
 * indexovaný `agreements` collectionGroup dotaz (ten `{path=**}` prefix
 * MÁ) k získání aktivních Dohod organizace, pak `listAssistedContactSeries`
 * PŘÍMÝM (ne group) dotazem na KAŽDOU rodinu zvlášť.
 */
export async function findForgottenOccurrencesForOrg(
  organizationId: string,
  today: Date = new Date(),
): Promise<Array<{ familyId: string; seriesId: string; docId: string; occurrence: AssistedContactOccurrenceDoc }>> {
  const agreementsSnap = await getDocs(
    query(
      collectionGroup(db, 'agreements'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'active'),
    ),
  )
  const perFamily = await Promise.all(
    agreementsSnap.docs.map(async (agreementDoc) => {
      const familyId = (agreementDoc.data() as { familyId: string }).familyId
      const series = await listAssistedContactSeries(familyId, organizationId)
      const perSeries = await Promise.all(
        series.map(async ({ docId: seriesId }) => {
          const occurrences = await listOccurrences(familyId, seriesId)
          return occurrences.map(({ docId, occurrence }) => ({ familyId, seriesId, docId, occurrence }))
        }),
      )
      return perSeries.flat()
    }),
  )
  const all = perFamily.flat()
  const forgotten = findForgottenOccurrences(
    all.map(({ seriesId, docId, occurrence }) => ({ seriesId, docId, occurrence })),
    today,
  )
  const forgottenKeys = new Set(forgotten.map((f) => `${f.seriesId}/${f.docId}`))
  return all.filter((o) => forgottenKeys.has(`${o.seriesId}/${o.docId}`))
}

async function getSeries(familyId: string, seriesId: string): Promise<AssistedContactSeriesDoc | null> {
  const snap = await getDoc(doc(seriesCollection(familyId), seriesId))
  return snap.exists() ? (snap.data() as AssistedContactSeriesDoc) : null
}
export { getSeries as getAssistedContactSeries }
