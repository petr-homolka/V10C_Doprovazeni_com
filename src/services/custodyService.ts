import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  type AgreementSubjectDoc,
  type CourtDecisionDoc,
  type CustodyAssignmentDoc,
  type CustodyForm,
} from '@/types/custody'
import { validateAssignmentConsistency, validateFosterCount } from '@/lib/custody'

/**
 * PRÁVNÍ ROVINA — rozsudek, svěření, předmět dohody.
 *
 * Typy a čisté funkce téhle vrstvy existovaly od 26. 7. s 21 testy, ale
 * NIKDO JE NEVOLAL a kolekce neměly pravidla. Tenhle soubor je to, co
 * z návrhu dělá funkční vrstvu.
 *
 * Rozhodovací logika zůstává v `lib/custody.ts` (čisté funkce, testovatelné
 * bez databáze). Tady je jen čtení, zápis a VALIDACE PŘED ZÁPISEM — protože
 * neplatný stav je snazší nepustit dovnitř než pak opravovat.
 */

export function assignmentRef(id: string) {
  return doc(db, 'custodyAssignments', id)
}

// ─── Rozhodnutí soudu ──────────────────────────────────────────────────

export async function createCourtDecision(input: {
  fileNumber: string
  courtName: string
  effectiveFrom: string
  kind: CourtDecisionDoc['kind']
  note?: string
  organizationId: string
  createdByUid: string
}): Promise<string> {
  const ref = doc(collection(db, 'courtDecisions'))
  const data: CourtDecisionDoc = {
    orgAccessList: [input.organizationId],
    fileNumber: input.fileNumber.trim(),
    courtName: input.courtName.trim(),
    effectiveFrom: input.effectiveFrom,
    kind: input.kind,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    createdAt: new Date().toISOString(),
    createdByOrgId: input.organizationId,
    createdByUid: input.createdByUid,
  }
  await setDoc(ref, data)
  return ref.id
}

export async function getCourtDecision(id: string): Promise<CourtDecisionDoc | null> {
  const snap = await getDoc(doc(db, 'courtDecisions', id))
  return snap.exists() ? (snap.data() as CourtDecisionDoc) : null
}

// ─── Svěření péče ──────────────────────────────────────────────────────

/**
 * Založí svěření. VALIDUJE dřív, než zapíše.
 *
 * `validateFosterCount` hlídá zákonnou podmínku (společnými pěstouny mohou
 * být jen manželé, tedy nejvýš dva) — tvar dat ji sám neomezuje, pole unese
 * kolik chce. Bez týhle kontroly by se dala uložit trojice a nikdo by si
 * toho nevšiml, dokud by se z toho nevykazovalo.
 */
export async function createCustodyAssignment(input: {
  childId: string
  fosterPersonIds: string[]
  form: CustodyForm
  validFrom: string
  courtDecisionId?: string | null
  organizationId: string
}): Promise<string> {
  const problem = validateFosterCount({ fosterPersonIds: input.fosterPersonIds, form: input.form })
  if (problem) throw new Error(problem)

  const ref = doc(collection(db, 'custodyAssignments'))
  const data: CustodyAssignmentDoc = {
    id: ref.id,
    orgAccessList: [input.organizationId],
    courtDecisionId: input.courtDecisionId ?? null,
    childId: input.childId,
    fosterPersonIds: input.fosterPersonIds,
    form: input.form,
    validFrom: input.validFrom,
    validTo: null,
    status: 'aktivni',
    createdAt: new Date().toISOString(),
    createdByOrgId: input.organizationId,
  }
  await setDoc(ref, data)
  return ref.id
}

/**
 * Ukončí svěření — typicky novým rozhodnutím soudu.
 *
 * `status` i `validTo` se mění SPOLEČNĚ a soulad se ověřuje: dvě pole o téže
 * věci se dřív nebo později rozejdou a `activeAssignments` počítá z času,
 * kdežto Firestore dotazy z `status`. Rozejít se nesmějí.
 */
export async function endCustodyAssignment(input: {
  assignmentId: string
  validTo: string
  endedByCourtDecisionId?: string | null
}): Promise<void> {
  const problem = validateAssignmentConsistency({ status: 'ukonceno', validTo: input.validTo })
  if (problem) throw new Error(problem)

  await updateDoc(assignmentRef(input.assignmentId), {
    status: 'ukonceno',
    validTo: input.validTo,
    endedByCourtDecisionId: input.endedByCourtDecisionId ?? null,
  })
}

/** Svěření pro jedno dítě. Dotaz zrcadlí `orgAccessList` z pravidel. */
export async function listAssignmentsForChild(
  childId: string,
  organizationId: string,
): Promise<CustodyAssignmentDoc[]> {
  const snap = await getDocs(
    query(
      collection(db, 'custodyAssignments'),
      where('childId', '==', childId),
      where('orgAccessList', 'array-contains', organizationId),
    ),
  )
  return snap.docs.map((d) => d.data() as CustodyAssignmentDoc)
}

/**
 * Svěření, ve kterých je tahle osoba pěstounem.
 *
 * FILTR NA PĚSTOUNA BĚŽÍ AŽ V PAMĚTI, ne v dotazu. Vypadá to jako plýtvání,
 * ale jinak to nejde a stálo to za zjištění:
 *
 * Firestore u `list` nevyhodnocuje pravidlo nad výsledkem, ale nad DOTAZEM —
 * pustí ho jen tehdy, když dotaz SÁM DOKAZUJE, že pravidlo bude platit.
 * Pravidlo zní `organizationId in resource.data.orgAccessList`, takže jediný
 * přípustný důkaz je `array-contains` právě nad `orgAccessList`. Dotaz
 * filtrující jen `fosterPersonIds` skončí na `permission-denied`, i když by
 * všechny nalezené dokumenty té organizaci patřily — ověřeno testem
 * „týž dotaz BEZ filtru na organizaci neprojde".
 *
 * A druhý `array-contains` do téhož dotazu přidat nelze. Zbývá tedy načíst
 * svěření organizace a probrat je tady.
 *
 * CENA: dnes 410 dokumentů na celou platformu, což je jeden malý dotaz.
 * Až jich budou desetitisíce, tohle se musí předělat — nejspíš tak, že se
 * ptát bude přes DĚTI dané domácnosti (`listAssignmentsForChild` filtruje
 * server-side a je levný), ne přes pěstouna.
 */
export async function listAssignmentsForFoster(
  fosterPersonId: string,
  organizationId: string,
): Promise<CustodyAssignmentDoc[]> {
  const snap = await getDocs(
    query(collection(db, 'custodyAssignments'), where('orgAccessList', 'array-contains', organizationId)),
  )
  return snap.docs
    .map((d) => d.data() as CustodyAssignmentDoc)
    .filter((a) => a.fosterPersonIds.includes(fosterPersonId))
}

/**
 * Doplní k existujícímu svěření rozhodnutí soudu.
 *
 * Tohle je nejčastější úprava, jakou právní rovina uvidí: všech 410 svěření
 * převedených ze spisů 27. 7. má `courtDecisionId: null` a odhadované datum,
 * protože spisová značka v systému nikdy nebyla. Doplnění rozsudku proto
 * zároveň PŘEPÍŠE DATUM na to z rozsudku a odhadovou značku SMAŽE — jinak
 * by u dokumentu, kde už právní moc známe, dál svítilo „odhad".
 */
export async function attachCourtDecision(input: {
  assignmentId: string
  courtDecisionId: string
  /** Datum právní moci rozsudku — od teď je to zjištěný údaj, ne odhad. */
  validFrom: string
}): Promise<void> {
  await updateDoc(assignmentRef(input.assignmentId), {
    courtDecisionId: input.courtDecisionId,
    validFrom: input.validFrom,
    validFromIsEstimate: deleteField(),
  })
}

/** Zpřístupní svěření další organizaci — seznam se jen rozšiřuje. */
export async function grantAssignmentAccess(assignmentId: string, organizationId: string): Promise<void> {
  await updateDoc(assignmentRef(assignmentId), { orgAccessList: arrayUnion(organizationId) })
}

// ─── Předmět dohody ────────────────────────────────────────────────────

export async function createAgreementSubject(input: {
  organizationId: string
  agreementId: string
  custodyAssignmentId: string
  fosterPersonId: string
  validFrom: string
}): Promise<string> {
  const ref = doc(collection(db, 'agreementSubjects'))
  const data: AgreementSubjectDoc = {
    organizationId: input.organizationId,
    agreementId: input.agreementId,
    custodyAssignmentId: input.custodyAssignmentId,
    fosterPersonId: input.fosterPersonId,
    validFrom: input.validFrom,
    validTo: null,
  }
  await setDoc(ref, data)
  return ref.id
}

export async function listSubjectsForAgreement(
  agreementId: string,
  organizationId: string,
): Promise<AgreementSubjectDoc[]> {
  const snap = await getDocs(
    query(
      collection(db, 'agreementSubjects'),
      where('agreementId', '==', agreementId),
      where('organizationId', '==', organizationId),
    ),
  )
  return snap.docs.map((d) => d.data() as AgreementSubjectDoc)
}
