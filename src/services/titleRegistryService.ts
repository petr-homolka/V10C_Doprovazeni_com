import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { isTitleRunning, type TitleRegistryDoc } from '@/types/titleRegistry'
import { canOpenNewTitle, type LegalTitleState } from '@/lib/agreementLaw'

/**
 * REJSTŘÍK OBSAZENÝCH UID — čtení a zápis.
 *
 * Účel je jediný: aby šlo VYNUTIT pravidlo „osoba pečující smí mít v daném
 * čase jen jeden právní titul". Bez rejstříku by se dalo jen varovat, což
 * Petr 26. 7. výslovně odmítl.
 *
 * Viz `types/titleRegistry.ts` pro to, proč je to samostatná kolekce
 * a proč v ní nejsou žádné osobní údaje.
 */

export function titleRegistryRef(uid: string) {
  return doc(db, 'titleRegistry', uid)
}

export async function readTitle(uid: string): Promise<TitleRegistryDoc | null> {
  const snap = await getDoc(titleRegistryRef(uid))
  return snap.exists() ? (snap.data() as TitleRegistryDoc) : null
}

/**
 * Chyba s dost velkým kontextem na to, aby z ní šla složit hláška bez
 * dalšího dotazu. Vlastní třída schválně — volající má poznat KONFLIKT
 * TITULU od výpadku sítě a zareagovat jinak.
 */
export class TitleConflictError extends Error {
  readonly uid: string
  readonly holderOrgId: string | null
  readonly holderName: string

  constructor(uid: string, holderOrgId: string | null, holderName: string, message: string) {
    super(message)
    this.name = 'TitleConflictError'
    this.uid = uid
    this.holderOrgId = holderOrgId
    this.holderName = holderName
  }
}

/**
 * SMÍ SE PRO TYHLE OSOBY ZALOŽIT NOVÝ TITUL? Když ne, HODÍ VÝJIMKU.
 *
 * Schválně `assert*`, ne `check*` vracející boolean: volající by návratovou
 * hodnotu mohl přehlédnout, výjimku ne. Na tomhle rozhodnutí stojí soulad
 * s metodikou, tak ať se nedá minout omylem.
 *
 * `spousesLivingApart` je jediná zákonná výjimka a je POVINNÝ parametr ze
 * stejného důvodu jako v `canOpenNewTitle` — kdo ji chce použít, musí ji
 * výslovně potvrdit.
 */
export async function assertCanOpenTitle(
  uids: string[],
  spousesLivingApart: boolean,
  /** Organizace, která titul zakládá — vlastní běžící titul nekoliduje. */
  openingOrgId: string,
  now: Date = new Date(),
): Promise<void> {
  const entries = await Promise.all(uids.map((uid) => readTitle(uid).then((e) => [uid, e] as const)))

  for (const [uid, entry] of entries) {
    if (!entry || !isTitleRunning(entry, now)) continue

    // Vlastní běžící titul není konflikt — je to přesně ten případ, kdy se
    // podle metodiky přidává další dítě ZMĚNOU stávající dohody. Blokovat
    // by tady znamenalo zakázat zákonný postup.
    if (entry.holderOrgId === openingOrgId) continue

    const state: LegalTitleState = {
      organizationId: entry.holderOrgId,
      externalSubjectName: entry.externalSubjectName ?? null,
      validFrom: entry.validFrom,
      validTo: entry.validTo,
    }
    const check = canOpenNewTitle([state], spousesLivingApart, now)
    if (check.ok) continue

    throw new TitleConflictError(
      uid,
      entry.holderOrgId,
      check.conflictingSubject ?? 'neznámý subjekt',
      `UID ${uid}: ${check.reason}`,
    )
  }
}

/**
 * Zapíše, že titul na tomhle UID drží tahle organizace.
 *
 * `setDoc` bez merge: rejstřík je AKTUÁLNÍ STAV, ne historie. Historie
 * titulů žije v Dohodách a v auditním logu, tady by jen zavazela a sváděla
 * k tomu číst z rejstříku věci, které patří jinam.
 */
export async function claimTitle(input: {
  uid: string
  holderOrgId: string
  validFrom: string
  validTo?: string | null
}): Promise<void> {
  const entry: TitleRegistryDoc = {
    uid: input.uid,
    holderOrgId: input.holderOrgId,
    externalSubjectName: null,
    validFrom: input.validFrom,
    validTo: input.validTo ?? null,
    updatedAt: new Date().toISOString(),
    updatedByOrgId: input.holderOrgId,
  }
  await setDoc(titleRegistryRef(input.uid), entry)
}

/**
 * Uvolní titul k danému dni.
 *
 * Nemaže — zapisuje `validTo`. Smazaný záznam by vypadal stejně jako
 * „tohle UID jsme nikdy neviděli", kdežto ukončený nese informaci, že
 * titul existoval a kdy skončil.
 */
export async function releaseTitle(uid: string, endedAt: string, byOrgId: string): Promise<void> {
  const current = await readTitle(uid)
  if (!current) return
  await setDoc(titleRegistryRef(uid), {
    ...current,
    validTo: endedAt,
    updatedAt: new Date().toISOString(),
    updatedByOrgId: byOrgId,
  } satisfies TitleRegistryDoc)
}

/**
 * Zaznamená, že osobu doprovází subjekt MIMO náš systém — typicky OSPOD,
 * který vydal správní rozhodnutí a je tím sám doprovázejícím subjektem.
 *
 * Zapisuje to organizace, která tu informaci má z terénu. Sami si ji
 * nemáme kde ověřit, ale bez ní by systém tvářil volné UID, které volné
 * není.
 */
export async function recordExternalTitle(input: {
  uid: string
  subjectName: string
  validFrom: string
  validTo?: string | null
  reportedByOrgId: string
}): Promise<void> {
  const entry: TitleRegistryDoc = {
    uid: input.uid,
    holderOrgId: null,
    externalSubjectName: input.subjectName,
    validFrom: input.validFrom,
    validTo: input.validTo ?? null,
    updatedAt: new Date().toISOString(),
    updatedByOrgId: input.reportedByOrgId,
  }
  await setDoc(titleRegistryRef(input.uid), entry)
}
