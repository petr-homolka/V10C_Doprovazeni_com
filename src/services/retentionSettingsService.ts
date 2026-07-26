import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { RetentionOverride, RetentionOverrides } from '@/lib/retentionPolicy'

/**
 * Nastavené retenční lhůty — `platformDefaults/retention`.
 *
 * Bydlí v `platformDefaults`, protože pravidla té cesty už přesně sedí:
 * ČTOU VŠICHNI přihlášení, ZAPISUJE VÝHRADNĚ superadmin. Přesně to je
 * potřeba — mazací běh v každé organizaci musí lhůty znát, ale měnit je
 * nesmí nikdo než provozovatel.
 *
 * Je to PLATFORMNÍ, ne per-organizace, a to schválně. Lhůta pro
 * dokumentaci o dítěti vychází ze zákona, ne z chuti organizace; kdyby si
 * ji každá nastavovala sama, první, kdo bude chtít uklidit, si ji zkrátí.
 */

const RETENTION_DOC = 'retention'

function retentionRef() {
  return doc(db, 'platformDefaults', RETENTION_DOC)
}

export async function readRetentionOverrides(): Promise<RetentionOverrides> {
  const snap = await getDoc(retentionRef())
  if (!snap.exists()) return {}
  return (snap.data().rules ?? {}) as RetentionOverrides
}

/**
 * Uloží celou sadu najednou.
 *
 * Ne po jednom pravidle: obrazovka je tabulka, kterou člověk projde a pak
 * potvrdí. Ukládat každý řádek zvlášť by znamenalo, že po zavření
 * v půlce zůstane polovina rozhodnutí zapsaná a polovina ne.
 */
export async function saveRetentionOverrides(
  overrides: RetentionOverrides,
  savedByUid: string,
): Promise<void> {
  await setDoc(retentionRef(), {
    rules: overrides,
    updatedAt: new Date().toISOString(),
    updatedByUid: savedByUid,
  })
}

/** Vyrobí záznam o rozhodnutí. Razítko „kdo a kdy" se nesmí dát vynechat. */
export function decision(input: {
  keepMonths: number | null
  action: RetentionOverride['action']
  note?: string
  decidedByUid: string
}): RetentionOverride {
  return {
    keepMonths: input.keepMonths,
    action: input.action,
    note: input.note,
    decidedAt: new Date().toISOString(),
    decidedByUid: input.decidedByUid,
  }
}
