import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { UidHolderCardDoc } from '@/types/uidHolderCard'
import { actorFields, recordAudit } from '@/services/auditLogService'
import type { AuditActor } from '@/types/auditLog'
import { uidHolderKey } from '@/lib/personMatch'

/**
 * Ověřovací karta k UID. Viz `types/uidHolderCard.ts`.
 *
 * Dvě věci drží tuhle kolekci bezpečnou a je dobré vědět, která co dělá:
 *
 *   TVAR KLÍČE (`uidHolderKey`) je ta skutečná zábrana — dokument se bez
 *   příjmení nenajde, protože ta cesta v databázi neexistuje. Hádání UID
 *   samotného tím ztrácí smysl.
 *
 *   DENNÍ LIMIT níž je druhá vrstva pro běžný případ (zvědavý pracovník),
 *   ne pro útočníka: kdo si napíše vlastního klienta, počítadlo prostě
 *   nezvýší. Poctivé je to říct, ne se tvářit, že je to hradba.
 */

/**
 * Kolik dotazů na cizí UID denně je ještě práce a kolik už je slídění.
 *
 * Odhad ze skutečného provozu: nová organizace ověří pěstouna při zavedení
 * jednou, výjimečně dvakrát kvůli překlepu. Dvacet za den nezvládne ani
 * organizace, která nabírá celý týden — pod tímhle číslem se nikdo poctivý
 * neškrtne.
 */
export const DAILY_LOOKUP_LIMIT = 20

/** Vlastní chyba — volající má poznat zablokování od výpadku sítě. */
export class LookupBlockedError extends Error {
  constructor() {
    super(
      'Účet byl zablokován pro neobvyklý počet dotazů na cizí UID. ' +
        'Obraťte se prosím na provozovatele systému.',
    )
    this.name = 'LookupBlockedError'
  }
}

function cardRef(key: string) {
  return doc(db, 'uidHolderCard', key)
}

function quotaRef(userUid: string) {
  return doc(db, 'lookupQuota', userUid)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Započítá dotaz a při překročení limitu ÚČET ZAMKNE.
 *
 * Zamyká se zápisem `disabledAt` na vlastní profil. Pravidla to dovolují
 * jen JEDNÍM SMĚREM (nastavit ano, vynulovat ne), takže se nikdo sám
 * neodemkne — odblokovat může správce organizace nebo provozovatel.
 *
 * Vrací počet dotazů po započtení; hodí `LookupBlockedError`, když limit
 * padl.
 */
async function countLookupOrBlock(actor: AuditActor, organizationId: string): Promise<number> {
  const ref = quotaRef(actor.uid)
  const snap = await getDoc(ref)
  const data = snap.exists() ? (snap.data() as { day: string; count: number }) : null

  const day = today()
  const count = data && data.day === day ? data.count + 1 : 1
  await setDoc(ref, { day, count, userUid: actor.uid, organizationId, updatedAt: new Date().toISOString() })

  if (count > DAILY_LOOKUP_LIMIT) {
    await updateDoc(doc(db, 'users', actor.uid), { disabledAt: new Date().toISOString() })
    await recordAudit({
      organizationId,
      action: 'account_auto_blocked',
      ...actorFields(actor),
      detail:
        `Překročen denní limit dotazů na cizí UID (${DAILY_LOOKUP_LIMIT}). ` +
        'Účet zablokován automaticky, odblokovat může správce organizace nebo provozovatel.',
    })
    throw new LookupBlockedError()
  }

  return count
}

/**
 * DOTAZ NA UID. Vyžaduje UID **i příjmení** — nejde o kontrolu navíc,
 * ale o to, že bez obojího se dokument nedá adresovat.
 *
 * Auditní kontext je POVINNÝ parametr. Kdyby byl volitelný, první
 * volající, co ho vynechá, tiše odstraní jak stopu, tak počítadlo.
 */
export async function lookupUidHolder(
  uid: string,
  lastName: string,
  audit: { actor: AuditActor; organizationId: string },
): Promise<UidHolderCardDoc | null> {
  await countLookupOrBlock(audit.actor, audit.organizationId)

  const key = await uidHolderKey(uid, lastName)
  const snap = key ? await getDoc(cardRef(key)) : null
  const card = snap?.exists() ? (snap.data() as UidHolderCardDoc) : null

  await recordAudit({
    organizationId: audit.organizationId,
    action: 'person_lookup',
    ...actorFields(audit.actor),
    detail: `Dotaz na UID ${uid} s příjmením. Výsledek: ${card ? 'nalezeno' : 'nenalezeno'}.`,
    ...(card ? { target: { kind: 'other' as const, id: uid, label: `UID ${uid}` } } : {}),
  })

  return card
}

/**
 * Založí/aktualizuje kartu.
 *
 * `municipality` se bere zvlášť a ne z celé adresy — kdo sem pošle
 * „Dlouhá 5, Kolín", zveřejní ulici s číslem popisným. Rozdělit to musí
 * volající, protože jen on ví, kde v jeho datech obec je.
 */
export async function upsertUidHolderCard(input: {
  uid: string
  firstName: string
  lastName: string
  municipality: string
  holderOrgId: string | null
}): Promise<void> {
  const key = await uidHolderKey(input.uid, input.lastName)
  if (!key) return

  await setDoc(cardRef(key), {
    uid: input.uid,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    municipality: input.municipality.trim(),
    holderOrgId: input.holderOrgId,
    updatedAt: new Date().toISOString(),
  } satisfies UidHolderCardDoc)
}
