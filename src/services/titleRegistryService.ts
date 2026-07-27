import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore'
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
      validFrom: entry.validFrom,
      validTo: null,
    }
    const check = canOpenNewTitle([asTitle], spousesLivingApart, now)
    if (check.ok) continue

    const subject = entry.holderOrgId ?? 'jiná organizace'
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
  await setDoc(titleRegistryRef(input.uid), buildClaim(input))
}

function buildClaim(input: {
  uid: string
  holderOrgId: string
  validFrom: string
  validTo?: string | null
}): TitleRegistryDoc {
  return {
    uid: input.uid,
    holderOrgId: input.holderOrgId,
    validFrom: input.validFrom,
    validTo: input.validTo ?? null,
    // VŽDY vypsat, i když je to null. Chybějící pole a pole s hodnotou
    // `null` jsou ve Firestore dvě různé věci a v pravidlech se chovají
    // úplně jinak: sáhnutí na neexistující klíč je CHYBA VYHODNOCENÍ, ne
    // `false`. Přesně na tom 26. 7. spadlo dvacet testů u `disabledAt`.
    releasedAt: null,
    releasedByOrgId: null,
    updatedAt: new Date().toISOString(),
    updatedByOrgId: input.holderOrgId,
  }
}

/**
 * ZABRÁNÍ UID PRO CELOU SKUPINU PĚSTOUNŮ NAJEDNOU — TRANSAKČNĚ.
 *
 * `assertCanOpenTitle` je jen předkontrola pro slušnou hlášku. Mezi jejím
 * čtením a zápisem je okno, ve kterém můžou dvě organizace projít obě —
 * a pak by v rejstříku zůstala jen ta druhá, zatímco Dohody by existovaly
 * dvě. Blokace, kterou jde obejít načasováním, není blokace.
 *
 * Tady se čte a zapisuje v JEDNÉ transakci, takže druhý souběžný pokus
 * spadne. Manželé se navíc zabírají SPOLEČNĚ: kdyby se claimovalo po
 * jednom, mohl by první projít, druhý spadnout a zůstal by zabraný pěstoun
 * bez Dohody.
 */
export async function claimTitlesExclusively(
  uids: string[],
  input: { holderOrgId: string; validFrom: string; validTo?: string | null; spousesLivingApart: boolean },
  now: Date = new Date(),
): Promise<void> {
  if (uids.length === 0) return

  await runTransaction(db, async (tx) => {
    // VŠECHNA čtení před VŠEMI zápisy — Firestore transakce to vyžaduje.
    const refs = uids.map((uid) => titleRegistryRef(uid))
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)))

    snaps.forEach((snap, i) => {
      const uid = uids[i]
      const entry = snap.exists() ? (snap.data() as TitleRegistryDoc) : null
      if (isAvailableForTakeover(entry, now)) return
      if (!entry) return
      if (entry.holderOrgId === input.holderOrgId) return
      if (input.spousesLivingApart) return

      const subject = entry.holderOrgId ?? 'jiná organizace'
      throw new TitleConflictError(
        uid,
        entry.holderOrgId,
        subject,
        `UID ${uid}: pěstouna vede organizace ${subject} a není uvolněný. Dohodu nelze uzavřít.`,
      )
    })

    refs.forEach((ref, i) => {
      tx.set(ref, buildClaim({ uid: uids[i], ...input }))
    })
  })
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
