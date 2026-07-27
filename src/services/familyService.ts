import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { allocateUid } from '@/lib/uidAllocator'
import { upsertUidHolderCard } from '@/services/uidHolderCardService'
import { indexPerson } from '@/services/personIndexService'
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
  address: string | undefined,
  createdByImportJobRef?: string,
): Promise<{ docId: string; family: FamilyDoc }> {
  const ref = doc(collection(db, 'families'))
  const uid = await allocateUid('familyFile', organizationId)
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

/** Všechny děti organizace napříč rodinami — pro vyhledávací výběr (např.
 * "Přidat externistu"), kde se vybírá jedna konkrétní osoba, ne rodina. */
export async function listChildrenForOrg(
  organizationId: string,
): Promise<Array<{ docId: string; child: ChildDoc }>> {
  const snap = await getDocs(query(collection(db, 'children'), where('organizationId', '==', organizationId)))
  return snap.docs.map((d) => ({ docId: d.id, child: d.data() as ChildDoc }))
}

/** Stejné jako `listChildrenForOrg`, ale pro pěstouny — `orgAccessList` už
 * dotaz vyžaduje (viz `listFamiliesWithDocIds`), ne přímou rovnost. */
export async function listFosterPersonsForOrg(
  organizationId: string,
): Promise<Array<{ docId: string; fosterPerson: FosterPersonDoc }>> {
  const snap = await getDocs(
    query(collection(db, 'fosterPersons'), where('orgAccessList', 'array-contains', organizationId)),
  )
  return snap.docs.map((d) => ({ docId: d.id, fosterPerson: d.data() as FosterPersonDoc }))
}

export interface AddFosterPersonInput {
  firstName: string
  lastName: string
  phone?: string
  email?: string
  birthDate?: string
}

export async function addFosterPersonToFamily(
  familyId: string,
  organizationId: string,
  input: AddFosterPersonInput,
  createdByImportJobRef?: string,
): Promise<{ docId: string; fosterPerson: FosterPersonDoc }> {
  const ref = doc(collection(db, 'fosterPersons'))
  const uid = await allocateUid('fosterPerson', organizationId)
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

  // OVĚŘOVACÍ KARTA A VYHLEDÁVACÍ OTISKY — bez tohohle je předávání
  // pěstounů mezi organizacemi TICHÁ ATRAPA.
  //
  // Do 27. 7. tady tenhle zápis chyběl. Karty existovaly jen ze zpětného
  // naplnění, takže průvodce zájemcem fungoval na 453 stávajících lidech
  // a na každém nově založeném mlčky odpovídal „nikoho takového nevedeme".
  // Nová organizace by pak podepsala s pěstounem, kterého někdo vede —
  // přesně to, co má celá výlučnost titulu zastavit. A poznalo by se to až
  // za rok, protože „nenalezeno" vypadá stejně jako „opravdu tam není".
  //
  // Chyby se ZÁMĚRNĚ NEPOLYKAJÍ. Pěstoun bez karty je přesně ta neviditelná
  // vada, kterou tady opravuju — hlasitý pád je horší zážitek, ale je vidět.
  const familySnap = await getDoc(doc(db, 'families', familyId))
  const municipality = municipalityFromAddress(familySnap.data()?.address as string | undefined)

  await upsertUidHolderCard({
    uid,
    firstName: input.firstName,
    lastName: input.lastName,
    municipality,
    holderOrgId: organizationId,
  })
  await indexPerson(
    uid,
    { firstName: input.firstName, lastName: input.lastName, address: familySnap.data()?.address as string | undefined },
    organizationId,
  )

  return { docId: ref.id, fosterPerson: data }
}

/**
 * PŘESTĚHOVÁNÍ PĚSTOUNA DO JINÉ DOMÁCNOSTI.
 *
 * Poslední místo, kde zbývala stará představa „člověk = jeho rodina".
 * Pěstoun ovdoví, znovu se ožení, připojí se k jiné pěstounské rodině —
 * a systém to do 27. 7. neuměl vůbec.
 *
 * ─── PROČ TRANSAKCE ───────────────────────────────────────────────────
 *
 * Přesun sahá na TŘI dokumenty: osobu, starou rodinu a novou. Napůl
 * provedený přesun by znamenal pěstouna ve dvou domácnostech naráz, nebo
 * v žádné. Obojí je horší než neúspěch.
 *
 * ─── PROČ JEN V RÁMCI JEDNÉ ORGANIZACE ────────────────────────────────
 *
 * Přesun do domácnosti, kterou vede JINÁ organizace, není stěhování — to
 * je předání a má vlastní postup (rejstřík titulů, telefonát, uvolnění).
 * Kdyby to šlo obejít „přesunem", obešla by se tím celá výlučnost titulu.
 *
 * ─── CO SE NEPŘENÁŠÍ, A JE TO SPRÁVNĚ ─────────────────────────────────
 *
 * Zápisy, dokumenty a chaty zůstávají u STARÉ rodiny. Patří k tomu, co se
 * tam tehdy dělo, ne k člověku. Že tam pěstoun tehdy patřil, se dohledá
 * v `householdHistory`.
 */
export async function moveFosterPersonToFamily(input: {
  fosterPersonId: string
  targetFamilyId: string
  organizationId: string
  reason?: string
}): Promise<void> {
  const personRef = doc(db, 'fosterPersons', input.fosterPersonId)
  const targetRef = doc(db, 'families', input.targetFamilyId)
  const now = new Date().toISOString()

  const moved = await runTransaction(db, async (tx) => {
    const personSnap = await tx.get(personRef)
    if (!personSnap.exists()) throw new Error('Pěstoun neexistuje.')
    const person = personSnap.data() as FosterPersonDoc

    if (person.familyId === input.targetFamilyId) {
      throw new Error('Pěstoun v téhle domácnosti už je.')
    }
    if (!person.orgAccessList.includes(input.organizationId)) {
      throw new Error('K tomuhle pěstounovi nemáte přístup.')
    }

    const targetSnap = await tx.get(targetRef)
    if (!targetSnap.exists()) throw new Error('Cílová domácnost neexistuje.')
    const target = targetSnap.data() as FamilyDoc
    if (!target.orgAccessList.includes(input.organizationId)) {
      // Viz hlavička: přesun k cizí organizaci je předání, ne stěhování.
      throw new Error('Cílovou domácnost vede jiná organizace. Použijte předání pěstouna, ne přesun.')
    }

    const oldFamilyRef = person.familyId ? doc(db, 'families', person.familyId) : null

    tx.update(personRef, { familyId: input.targetFamilyId })
    if (oldFamilyRef) tx.update(oldFamilyRef, { fosterPersonRefs: arrayRemove(input.fosterPersonId) })
    tx.update(targetRef, { fosterPersonRefs: arrayUnion(input.fosterPersonId) })
    tx.set(doc(collection(personRef, 'householdHistory')), {
      fromFamilyId: person.familyId ?? null,
      toFamilyId: input.targetFamilyId,
      movedAt: now,
      movedByOrgId: input.organizationId,
      ...(input.reason ? { reason: input.reason } : {}),
    })

    return { person, targetAddress: target.address }
  })

  // ── Návaznosti, které se snadno zapomenou a tiše shnijí ──────────────

  // 1) OVĚŘOVACÍ KARTA nese OBEC, a ta se stěhováním mění. Kdyby zůstala
  //    stará, ptala by se druhá organizace na „Nováková, Kolín" a našla by
  //    člověka, který je rok v Brně — nebo spíš nenašla vůbec, protože klíč
  //    karty je otisk UID a PŘÍJMENÍ (příjmení se nemění, takže karta se
  //    najde, jen bude tvrdit nesmysl).
  await upsertUidHolderCard({
    uid: moved.person.uid,
    firstName: moved.person.firstName,
    lastName: moved.person.lastName,
    municipality: municipalityFromAddress(moved.targetAddress),
    holderOrgId: input.organizationId,
  })

  // 2) NOVÝ VYHLEDÁVACÍ OTISK pro novou adresu. Starý se schválně NEMAŽE:
  //    ukazuje na totéž UID, takže nikam nesvádí, a organizace, která zná
  //    jen starou adresu, díky němu člověka pořád najde. (Mazat by stejně
  //    směl jen superadmin — viz pravidla `personIndex`.)
  if (moved.targetAddress) {
    await indexPerson(
      moved.person.uid,
      { firstName: moved.person.firstName, lastName: moved.person.lastName, address: moved.targetAddress },
      input.organizationId,
    )
  }
}

/**
 * Obec z adresy rodiny — POSLEDNÍ část za čárkou.
 *
 * Bez čárky radši nic. Hádat z volného textu, co je ulice a co obec, by
 * znamenalo občas poslat do sdílené karty ulici s číslem popisným, a ta
 * karta je čitelná napříč organizacemi.
 */
function municipalityFromAddress(address: string | undefined): string {
  if (!address || !address.includes(',')) return ''
  return address.split(',').pop()!.trim()
}

/** Datum narození se dřív u pěstounů nedalo zadat vůbec (žádné pole) —
 * doplněno 2026-07-23 jako VLASTNÍ update (ne součást `addFosterPersonToFamily`),
 * ať jde retroaktivně doplnit i u už založených pěstounů z profilu. */
export async function updateFosterPersonBirthDate(fosterPersonId: string, birthDate: string): Promise<void> {
  await updateDoc(doc(db, 'fosterPersons', fosterPersonId), { birthDate: birthDate || null })
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
  birthDate?: string
}

export async function addChildToFamily(
  familyId: string,
  organizationId: string,
  input: AddChildInput,
  createdByImportJobRef?: string,
): Promise<{ docId: string; child: ChildDoc }> {
  const ref = doc(collection(db, 'children'))
  const uid = await allocateUid('child', organizationId)
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

/** Stejné jako `updateFosterPersonBirthDate` — `ChildDoc.birthDate` v typu
 * existoval, ale ŽÁDNÝ formulář ho nikdy nesbíral/needitoval (doplněno
 * 2026-07-23 pro narozeninová upozornění). */
export async function updateChildBirthDate(childId: string, birthDate: string): Promise<void> {
  await updateDoc(doc(db, 'children', childId), { birthDate: birthDate || null })
}
