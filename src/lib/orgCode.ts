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
