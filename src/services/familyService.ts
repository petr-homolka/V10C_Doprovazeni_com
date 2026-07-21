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

/**
 * `orgAccessList` obsahuje KAŽDOU organizaci, co kdy měla s rodinou
 * Dohodu (M2, nahrazuje M1 `createdByOrgId`) — vrací tedy i rodiny, se
 * kterými už vlastní Dohoda skončila (§4.5: vlastní historie zůstává
 * navždy viditelná).
 */
export async function listFamilies(organizationId: string): Promise<FamilyDoc[]> {
  return (await listFamiliesWithDocIds(organizationId)).map((r) => r.family)
}

/**
 * Stejný dotaz jako `listFamilies`, ale i s Firestore document ID —
 * potřebuje ho export/import (§5.5, M1.5), kde se rodina musí propojit s
 * dalšími zápisy (`children`/`fosterPersons`/`agreements` podle familyId),
 * ne jen zobrazit. `listFamilies` (human-facing seznam, jen `uid`) tohle
 * nepotřebuje, proto zůstává jako tenký wrapper nad touhle funkcí.
 */
export async function listFamiliesWithDocIds(
  organizationId: string,
): Promise<Array<{ docId: string; family: FamilyDoc }>> {
  const q = query(collection(db, 'families'), where('orgAccessList', 'array-contains', organizationId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ docId: d.id, family: d.data() as FamilyDoc }))
}

/**
 * `families` URL parametr je vždy human-facing `uid` pole (§4.3
 * implementační poznámka 1: "Human-facing (URL...) vždy používá uid
 * pole, ne interní document ID"), ne Firestore document ID — proto dotaz,
 * ne přímý `getDoc`. Vrací i `docId`, protože další zápisy (přidání
 * pěstouna/dítěte, založení Dohody) potřebují skutečné Firestore document
 * ID pro `doc()`.
 *
 * Filtruje i na `organizationId` ze STEJNÉHO důvodu jako
 * `listChildrenForFamily` — firestore.rules čte `orgAccessList`, dotaz
 * musí tohle pole zrcadlit (`array-contains`), jinak Firestore list dotaz
 * zamítne celý (ne jen skryje cizí výsledky).
 */
export async function getFamilyByUid(
  uid: string,
  organizationId: string,
): Promise<{ docId: string; family: FamilyDoc } | null> {
  const snap = await getDocs(
    query(
      collection(db, 'families'),
      where('uid', '==', uid),
      where('orgAccessList', 'array-contains', organizationId),
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
  createdByImportJobRef?: string,
): Promise<{ docId: string; family: FamilyDoc }> {
  const ref = doc(collection(db, 'families'))
  const uid = await allocateUid(organizationId, orgCode, 'familyFile')
  const data: FamilyDoc = {
    uid,
    orgAccessList: [organizationId],
    fosterPersonRefs: [],
    ...(address ? { address } : {}),
    createdAt: new Date().toISOString(),
    ...(createdByImportJobRef ? { createdByImportJobRef } : {}),
  }
  await setDoc(ref, data)
  return { docId: ref.id, family: data }
}

/** DOPLNENI_ZADANI-DO-M5 §2 — výchozí stav přepínače "Sdílet s oběma
 * pěstouny" pro tuhle rodinu v zápisníku. Žádné pole-restrikce v rules
 * update pravidle families/{familyId} (jen orgAccessList je hlídané), tak
 * prostý updateDoc stačí. */
export async function updateFamilyPartnerSharingDefault(
  familyId: string,
  partnerSharingDefault: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId), { partnerSharingDefault })
}

/** Editovatelný název profilu rodiny (UX zpětná vazba 2026-07-20) —
 * volitelné pole, prázdný `updateDoc` bez validace stejně jako
 * `updateFamilyPartnerSharingDefault` výš. */
export async function updateFamilyDisplayName(familyId: string, displayName: string): Promise<void> {
  await updateDoc(doc(db, 'families', familyId), { displayName })
}

/**
 * Vrací i Firestore document ID (ne jen `uid` na dokumentu) — potřebuje ho
 * M3 avatar/hlasový zápis (`SubjectRef.id`, Storage cesta avataru), ta
 * pole odkazují na SKUTEČNÉ document ID, ne na human-facing `uid` (§4.3
 * pozn. 1 platí jen pro URL/PDF/QR, ne pro interní odkazy mezi dokumenty).
 */
export async function listFosterPersonsByRefs(
  refs: string[],
): Promise<Array<{ docId: string; fosterPerson: FosterPersonDoc }>> {
  const docs = await Promise.all(refs.map((id) => getDoc(doc(db, 'fosterPersons', id))))
  return docs
    .filter((d) => d.exists())
    .map((d) => ({ docId: d.id, fosterPerson: d.data() as FosterPersonDoc }))
}

/** Jeden pěstoun pro jeho vlastní profilovou stránku (UX zpětná vazba
 * 2026-07-20, `FosterPersonDetailPage`) — přímý `getDoc`, ne dotaz, takže
 * žádná "list dotaz vs. pole v pravidle" past. */
export async function getFosterPerson(fosterPersonId: string): Promise<FosterPersonDoc | null> {
  const snap = await getDoc(doc(db, 'fosterPersons', fosterPersonId))
  return snap.exists() ? (snap.data() as FosterPersonDoc) : null
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
  createdByImportJobRef?: string,
): Promise<{ docId: string; fosterPerson: FosterPersonDoc }> {
  const ref = doc(collection(db, 'fosterPersons'))
  const uid = await allocateUid(organizationId, orgCode, 'fosterPerson')
  const data: FosterPersonDoc = {
    uid,
    orgAccessList: [organizationId],
    familyId,
    ...input,
    createdAt: new Date().toISOString(),
    ...(createdByImportJobRef ? { createdByImportJobRef } : {}),
  }
  await setDoc(ref, data)
  await updateDoc(doc(db, 'families', familyId), {
    fosterPersonRefs: arrayUnion(ref.id),
  })
  return { docId: ref.id, fosterPerson: data }
}

/**
 * Filtruje na `familyId` I `organizationId` společně — firestore.rules
 * `children` read pravidlo čte `resource.data.organizationId`, a Firestore
 * zamítne CELÝ list dotaz, pokud rovnostní filtr dotazu nezrcadlí pole v
 * pravidle (§5 "List dotaz vs. pole v pravidle"). Vyžaduje složený index
 * (familyId + organizationId) — Firestore při prvním běhu nabídne odkaz
 * na jeho vytvoření, pokud ještě neexistuje.
 *
 * Vrací i Firestore document ID — stejný důvod jako u
 * `listFosterPersonsByRefs` (M3 avatar/hlasový zápis potřebuje skutečné
 * document ID, ne `uid`).
 */
export async function listChildrenForFamily(
  familyId: string,
  organizationId: string,
): Promise<Array<{ docId: string; child: ChildDoc }>> {
  const q = query(
    collection(db, 'children'),
    where('familyId', '==', familyId),
    where('organizationId', '==', organizationId),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ docId: d.id, child: d.data() as ChildDoc }))
}

/** Jedno dítě pro jeho vlastní profilovou stránku (UX zpětná vazba
 * 2026-07-20, `ChildDetailPage`) — přímý `getDoc`, žádná list-dotaz past. */
export async function getChild(childId: string): Promise<ChildDoc | null> {
  const snap = await getDoc(doc(db, 'children', childId))
  return snap.exists() ? (snap.data() as ChildDoc) : null
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
  createdByImportJobRef?: string,
): Promise<{ docId: string; child: ChildDoc }> {
  const ref = doc(collection(db, 'children'))
  const uid = await allocateUid(organizationId, orgCode, 'child')
  const data: ChildDoc = {
    uid,
    familyId,
    organizationId,
    ...input,
    createdAt: new Date().toISOString(),
    ...(createdByImportJobRef ? { createdByImportJobRef } : {}),
  }
  await setDoc(ref, data)
  return { docId: ref.id, child: data }
}
