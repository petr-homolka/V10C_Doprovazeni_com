import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentReference,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  AUDIT_ACTION_CATEGORY,
  type AuditAction,
  type AuditActor,
  type AuditCategory,
  type AuditEntryDoc,
  type AuditEntryInput,
} from '@/types/auditLog'
import type { UserDoc } from '@/types/user'

/**
 * Zápis a čtení auditní stopy (`types/auditLog.ts` vysvětluje, proč
 * existuje a co nezaručuje).
 *
 * Dvě cesty zápisu schválně:
 * - `auditWriteInto(batch, …)` — záznam jde do TÉŽE dávky jako sama akce.
 *   Používej všude, kde už dávka je: buď se stane obojí, nebo nic, a
 *   nemůže vzniknout „dokument odešel úřadu, ale v logu není".
 * - `recordAudit(…)` — samostatný zápis pro akce, které dávku nemají.
 *   NIKDY nevyhazuje ven: selhání logu nesmí shodit akci, kterou uživatel
 *   dělá. Vrací `false`, aby volající mohl zareagovat, když chce.
 */

function auditCollection(organizationId: string) {
  return collection(db, 'organizations', organizationId, 'auditLog')
}

/**
 * Převod přihlášeného uživatele na `AuditActor`. Jediné místo, kde se to
 * dělá — jméno v logu má být všude stejné, i když ho uživatel později
 * změní nebo účet zanikne.
 */
export function auditActor(user: Pick<UserDoc, 'uid' | 'displayName' | 'role'>): AuditActor {
  return { uid: user.uid, name: user.displayName, role: user.role }
}

function buildEntry(input: AuditEntryInput): AuditEntryDoc {
  const entry: AuditEntryDoc = {
    ...input,
    category: AUDIT_ACTION_CATEGORY[input.action],
    at: new Date().toISOString(),
    serverAt: serverTimestamp(),
  }
  // Firestore odmítne `undefined` hodnoty — vyhodíme prázdná nepovinná pole.
  for (const key of ['subject', 'target', 'counterpartOrgId', 'detail'] as const) {
    if (entry[key] === undefined) delete entry[key]
  }
  return entry
}

/** Zkratka: `{ actorUid, actorName, actorRole }` z jednoho aktéra. */
export function actorFields(actor: AuditActor) {
  return { actorUid: actor.uid, actorName: actor.name, actorRole: actor.role }
}

/** Přidá auditní záznam do EXISTUJÍCÍ dávky. Vrací ref (kvůli testům). */
export function auditWriteInto(batch: WriteBatch, input: AuditEntryInput): DocumentReference {
  const ref = doc(auditCollection(input.organizationId))
  batch.set(ref, buildEntry(input))
  return ref
}

/**
 * Samostatný zápis. Selhání se NEPROPAGUJE — jen se hlásí do konzole.
 * Je to vědomý kompromis: chybějící řádek v logu je vada doložitelnosti,
 * spadlé uložení dokumentu je vada, kterou odnese klíčová osoba v terénu.
 */
export async function recordAudit(input: AuditEntryInput): Promise<boolean> {
  try {
    await setDoc(doc(auditCollection(input.organizationId)), buildEntry(input))
    return true
  } catch (error) {
    console.error('Auditní záznam se nepodařilo uložit', input.action, error)
    return false
  }
}

export interface AuditQueryFilter {
  category?: AuditCategory
  action?: AuditAction
  /** ISO datum (včetně) — filtruje se přes klientský `at`, kvůli indexům. */
  from?: string
  limit?: number
}

/**
 * Výpis pro přehled. Řadí se podle `at` (klientský čas) — `serverAt` je
 * autorita na obsah, ale řadit podle něj by znamenalo druhý index a u
 * záznamů zapsaných v dávce má stejnou hodnotu.
 */
export async function listAuditEntries(
  organizationId: string,
  filter: AuditQueryFilter = {},
): Promise<Array<{ docId: string; entry: AuditEntryDoc }>> {
  const constraints = [
    ...(filter.category ? [where('category', '==', filter.category)] : []),
    ...(filter.action ? [where('action', '==', filter.action)] : []),
    ...(filter.from ? [where('at', '>=', filter.from)] : []),
    orderBy('at', 'desc'),
    fsLimit(filter.limit ?? 200),
  ]
  const snap = await getDocs(query(auditCollection(organizationId), ...constraints))
  return snap.docs.map((d) => ({ docId: d.id, entry: d.data() as AuditEntryDoc }))
}
