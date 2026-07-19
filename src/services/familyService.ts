import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { allocateUid } from '@/lib/counters'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'

/**
 * Barrel service (ZADANI §11 bod 3) pro Spis + Pěstoun (osoba) + Dítě —
 * M1 základ. Tři entity dohromady, protože v UI (FamilyDetailPage) žijí
 * jako jeden kontextový celek, ne tři nezávislé obrazovky.
 */

export async function listFamilies(organizationId: string): Promise<FamilyDoc[]> {
  const q = query(collection(db, 'families'), where('createdByOrgId', '==', organizationId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as FamilyDoc)
}

/**
 * `families` URL parametr je vždy human-facing `uid` pole (§4.3
 * implementační poznámka 1: "Human-facing (URL...) vždy používá uid
 * pole, ne interní document ID"), ne Firestore document ID — proto dotaz,
 * ne přímý `getDoc`. Vrací i `docId`, protože další zápisy (přidání
 * pěstouna/dítěte) potřebují skutečné Firestore document ID pro `doc()`.
 *
 * Filtruje i na `organizationId` ze STEJNÉHO důvodu jako
 * `listChildrenForFamily` — firestore.rules čte `createdByOrgId`, dotaz
 * musí tohle pole zrcadlit, jinak Firestore list dotaz zamítne celý (ne
 * jen skryje cizí výsledky). Vedlejší efekt shodný se seamem výše: mimo
 * vlastní organizaci se Spis takhle nenajde vůbec, ne že by se skryl jen
 * obsah — historyDigest cross-org řešení přichází až s M2.
 */
export async function getFamilyByUid(
  uid: string,
  organizationId: string,
): Promise<{ docId: string; family: FamilyDoc } | null> {
  const snap = await getDocs(
    query(
      collection(db, 'families'),
      where('uid', '==', uid),
      where('createdByOrgId', '==', organizationId),
    ),
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { docId: d.id, family: d.data() as FamilyDoc }
}

export async function createFamily(
  organizationId: string,
  orgCode: string,
  address: string | undefined,
): Promise<FamilyDoc> {
  const ref = doc(collection(db, 'families'))
  const uid = await allocateUid(organizationId, orgCode, 'familyFile')
  const data: FamilyDoc = {
    uid,
    createdByOrgId: organizationId,
    fosterPersonRefs: [],
    address,
    createdAt: new Date().toISOString(),
  }
  await setDoc(ref, data)
  return data
}

export async function listFosterPersonsByRefs(refs: string[]): Promise<FosterPersonDoc[]> {
  const docs = await Promise.all(refs.map((id) => getDoc(doc(db, 'fosterPersons', id))))
  return docs.filter((d) => d.exists()).map((d) => d.data() as FosterPersonDoc)
}

export interface AddFosterPersonInput {
  firstName: string
  lastName: string
  phone?: string
  email?: string
}

export async function addFosterPersonToFamily(
  familyId: string,
  organizationId: string,
  orgCode: string,
  input: AddFosterPersonInput,
): Promise<FosterPersonDoc> {
  const ref = doc(collection(db, 'fosterPersons'))
  const uid = await allocateUid(organizationId, orgCode, 'fosterPerson')
  const data: FosterPersonDoc = {
    uid,
    createdByOrgId: organizationId,
    ...input,
    createdAt: new Date().toISOString(),
  }
  await setDoc(ref, data)
  await updateDoc(doc(db, 'families', familyId), {
    fosterPersonRefs: arrayUnion(ref.id),
  })
  return data
}

/**
 * Filtruje na `familyId` I `organizationId` společně — firestore.rules
 * `children` read pravidlo čte `resource.data.organizationId`, a Firestore
 * zamítne CELÝ list dotaz, pokud rovnostní filtr dotazu nezrcadlí pole v
 * pravidle (§5 "List dotaz vs. pole v pravidle"). Vyžaduje složený index
 * (familyId + organizationId) — Firestore při prvním běhu nabídne odkaz
 * na jeho vytvoření, pokud ještě neexistuje.
 */
export async function listChildrenForFamily(
  familyId: string,
  organizationId: string,
): Promise<ChildDoc[]> {
  const q = query(
    collection(db, 'children'),
    where('familyId', '==', familyId),
    where('organizationId', '==', organizationId),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as ChildDoc)
}

export interface AddChildInput {
  firstName: string
  lastName: string
  birthNumber: string
}

export async function addChildToFamily(
  familyId: string,
  organizationId: string,
  orgCode: string,
  input: AddChildInput,
): Promise<ChildDoc> {
  const ref = doc(collection(db, 'children'))
  const uid = await allocateUid(organizationId, orgCode, 'child')
  const data: ChildDoc = {
    uid,
    familyId,
    organizationId,
    ...input,
    createdAt: new Date().toISOString(),
  }
  await setDoc(ref, data)
  return data
}
