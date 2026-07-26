import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { isAvailableForTakeover, titleState, type TitleRegistryDoc } from '@/types/titleRegistry'
import { canOpenNewTitle, type LegalTitleState } from '@/lib/agreementLaw'
import { actorFields, recordAudit } from '@/services/auditLogService'
import type { AuditActor } from '@/types/auditLog'

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
    // O tom, jestli je volno, ROZHODUJE REJSTŘÍK, ne kalendář. Uplynulé
    // `validTo` samo o sobě nestačí — dokud stará organizace pěstouna
    // neuvolnila, je pořád její (viz `TitleState`).
    if (isAvailableForTakeover(entry, now)) continue
    if (!entry) continue

    // Vlastní běžící titul není konflikt — je to přesně ten případ, kdy se
    // podle metodiky přidává další dítě ZMĚNOU stávající dohody. Blokovat
    // by tady znamenalo zakázat zákonný postup.
    if (entry.holderOrgId === openingOrgId) continue

    // Zákonná výjimka pro odděleně žijící manžele se posuzuje jinde, ať
    // je pravidlo na jednom místě.
    const asTitle: LegalTitleState = {
      organizationId: entry.holderOrgId,
      externalSubjectName: entry.externalSubjectName ?? null,
      validFrom: entry.validFrom,
      validTo: null,
    }
    const check = canOpenNewTitle([asTitle], spousesLivingApart, now)
    if (check.ok) continue

    const subject = entry.externalSubjectName ?? entry.holderOrgId ?? 'jiná organizace'
    const reason =
      titleState(entry, now) === 'aktivni'
        ? `UID ${uid}: pěstoun má platnou Dohodu s organizací ${subject}. Spojte se s ní — ` +
          'pokud u ní Dohoda skončila, uvolní vám ho jedním kliknutím.'
        : `UID ${uid}: pěstoun má u organizace ${subject} ukončenou Dohodu, ale zatím není uvolněný. ` +
          'Spojte se s ní a požádejte o uvolnění.'

    throw new TitleConflictError(uid, entry.holderOrgId, subject, reason)
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
 * Zapíše KONEC DOHODY. Pozor — tohle NENÍ uvolnění pěstouna.
 *
 * Nemaže, zapisuje `validTo`. Smazaný záznam by vypadal stejně jako „tohle
 * UID jsme nikdy neviděli", kdežto ukončený nese informaci, že titul
 * existoval a kdy skončil.
 *
 * Po tomhle zápisu je pěstoun ve stavu `ukoncena` a pro jinou organizaci
 * je pořád ZAMČENÝ. Odemkne ho až `releaseFosterParent` — viz komentář
 * u `TitleState`, proč jsou to dvě různé věci.
 */
export async function setTitleEnd(uid: string, endedAt: string, byOrgId: string): Promise<void> {
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
 * UVOLNĚNÍ PĚSTOUNA — to jedno kliknutí, o kterém je celý telefonát.
 *
 * Stará organizace tímhle prohlašuje: „s tímhle pěstounem už nemáme nic
 * nedořešeného, může jít jinam." Je to VÝROK, ne technický úklid — proto
 * je auditní kontext povinný a proto to nedělá žádný časovač.
 *
 * Uvolnit smí jen držitel. Kdyby to šlo komukoli, byla by blokace
 * dekorace: nová organizace by si pěstouna uvolnila sama a šla podepsat.
 */
export async function releaseFosterParent(
  uid: string,
  byOrgId: string,
  audit: { actor: AuditActor; fosterLabel: string },
): Promise<void> {
  const current = await readTitle(uid)
  if (!current) throw new Error('Tohle UID v rejstříku není.')
  if (current.holderOrgId !== byOrgId) {
    throw new Error('Uvolnit pěstouna smí jen organizace, která ho vede.')
  }

  const now = new Date().toISOString()
  await setDoc(titleRegistryRef(uid), {
    ...current,
    releasedAt: now,
    releasedByOrgId: byOrgId,
    updatedAt: now,
    updatedByOrgId: byOrgId,
  } satisfies TitleRegistryDoc)

  await recordAudit({
    organizationId: byOrgId,
    action: 'foster_released',
    ...actorFields(audit.actor),
    subject: { kind: 'fosterPerson', id: uid, label: audit.fosterLabel },
    detail: 'Potvrzeno vypořádání. Pěstoun může uzavřít Dohodu s jinou organizací.',
  })
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
