import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Přidělení `orgCode` (OOOO, 4místný segment UID) nové organizaci —
 * ZADANI §4.3: "ID doprovázející organizace (přiděleno jednorázově)".
 * Na rozdíl od `counters.ts` (per-org čítač entit) je tohle JEDINÝ
 * globální čítač v celém systému — přiděluje kód organizacím SAMOTNÝM,
 * takže nemůže být scoped pod `organizationId` (ta v době přidělení ještě
 * neexistuje). Žije v samostatné kolekci `systemCounters/orgCode` s
 * vlastním, úzkým firestore.rules pravidlem (jen pro profil-less
 * self-registraci, viz firestore.rules komentář).
 */
const ORG_CODE_MAX = 9999

/**
 * `0000` — REZERVOVÁNO PRO SAMOREGISTRACI PĚSTOUNA (pestouni.com).
 *
 * Záměr Petr Homolka, 26. 7.: na pěstouni.com se bude registrovat pěstoun
 * SÁM a UID dostane hned — dřív, než ho začne vést jakákoli organizace.
 * Jenže segment OOOO v UID dnes znamená „organizace, která entitu
 * založila", a u samoregistrace žádná není.
 *
 * `0000` je pro ten případ přirozená volba: čítač organizací začíná na 1
 * (`padStart` z jedničky dá `0001`), takže tuhle hodnotu NIKDY nepřidělí —
 * je volná bez jakéhokoli zásahu a hlídá to test. Zároveň je na první
 * pohled poznat, že takové UID nevzniklo v organizaci.
 *
 * Zapsané je to tady TEĎ, i když pestouni.com ještě neexistuje, přesně
 * proto, aby se ta hodnota mezitím nespotřebovala na něco jiného.
 */
export const SELF_REGISTRATION_ORG_CODE = '0000'

export async function allocateOrgCode(): Promise<string> {
  const counterRef = doc(db, 'systemCounters', 'orgCode')

  const sequence = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    const current = snap.exists() ? (snap.data().value as number) : 0
    const next = current + 1

    if (next > ORG_CODE_MAX) {
      throw new Error(`Vyčerpán rozsah kódů organizací (${ORG_CODE_MAX})`)
    }

    tx.set(counterRef, { value: next, updatedAt: serverTimestamp() })
    return next
  })

  return String(sequence).padStart(4, '0')
}
