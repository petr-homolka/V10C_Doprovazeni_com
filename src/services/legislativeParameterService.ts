import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { resolveCascade, resolveLatestHistoryEntry, type CascadeHistoryEntry } from '@/lib/cascadeResolution'
import {
  DEFAULT_POLICY_VALUES,
  DEFAULT_RATE_VALUES,
  DEFAULT_SPVPP_BUCKETS,
  type PolicyParameterKey,
  type PolicyValue,
  type RateParameterKey,
  type SpvppBucketKey,
  type SpvppBucketRange,
} from '@/types/legislativeParameter'

/**
 * Barrel service pro M7 §B.1/B.5/B.5.1 — obecný, znovupoužitelný systém
 * sazeb/politik. `resolveRate`/`resolvePolicy` implementují přesně kaskádu
 * ze zadání: pěstoun/dítě → Dohoda → (jen politika: klíčová osoba) →
 * organizace → platforma, první nalezená hodnota k danému datu vyhrává.
 * Vynucení POVOLENÍ refundace (§B.5.1: "vynuceno na service layer, ne jen
 * v UI") žije v `courseEnrollmentService.ts`, ne tady — tenhle soubor jen
 * ODPOVÍDÁ na otázku "jaká je teď platná hodnota/politika", nerozhoduje
 * sám o sobě, co s odpovědí volající udělá.
 */

function legislativeParamHistoryRef(key: string) {
  return collection(db, 'legislativeParameters', key, 'history')
}
function orgRateHistoryRef(organizationId: string, key: string) {
  return collection(db, 'organizations', organizationId, 'rateOverrides', key, 'history')
}
function agreementRateHistoryRef(familyId: string, organizationId: string, key: string) {
  return collection(db, 'families', familyId, 'agreements', organizationId, 'rateOverrides', key, 'history')
}
function fosterPersonRateHistoryRef(fosterPersonId: string, key: string) {
  return collection(db, 'fosterPersons', fosterPersonId, 'rateOverrides', key, 'history')
}
function orgPolicyHistoryRef(organizationId: string, key: string) {
  return collection(db, 'organizations', organizationId, 'policyOverrides', key, 'history')
}
function agreementPolicyHistoryRef(familyId: string, organizationId: string, key: string) {
  return collection(db, 'families', familyId, 'agreements', organizationId, 'policyOverrides', key, 'history')
}
function fosterPersonPolicyHistoryRef(fosterPersonId: string, key: string) {
  return collection(db, 'fosterPersons', fosterPersonId, 'policyOverrides', key, 'history')
}
function koPolicyHistoryRef(koUid: string, key: string) {
  return collection(db, 'users', koUid, 'policyOverrides', key, 'history')
}

export interface RateContext {
  fosterPersonId?: string
  familyId?: string
  organizationId: string
}

/** 4 úrovně: pěstoun → Dohoda → organizace → platforma (§B.5). */
export async function resolveRate(
  key: RateParameterKey,
  context: RateContext,
  atDate: string = new Date().toISOString(),
): Promise<number> {
  const refs = []
  if (context.fosterPersonId) refs.push(fosterPersonRateHistoryRef(context.fosterPersonId, key))
  if (context.familyId) refs.push(agreementRateHistoryRef(context.familyId, context.organizationId, key))
  refs.push(orgRateHistoryRef(context.organizationId, key))
  refs.push(legislativeParamHistoryRef(key))
  const resolved = await resolveCascade<number>(refs, atDate)
  return resolved ?? DEFAULT_RATE_VALUES[key]
}

export async function setRateOverride(
  level: 'fosterPerson' | 'agreement' | 'organization' | 'platform',
  ids: { fosterPersonId?: string; familyId?: string; organizationId?: string },
  key: RateParameterKey,
  value: number,
  setBy: string,
  note?: string,
): Promise<void> {
  const now = new Date().toISOString()
  const entry = { value, effectiveFrom: now, effectiveTo: null, setBy, setAt: now, note: note ?? null }
  const ref =
    level === 'fosterPerson'
      ? fosterPersonRateHistoryRef(ids.fosterPersonId!, key)
      : level === 'agreement'
        ? agreementRateHistoryRef(ids.familyId!, ids.organizationId!, key)
        : level === 'organization'
          ? orgRateHistoryRef(ids.organizationId!, key)
          : legislativeParamHistoryRef(key)
  await setDoc(doc(ref), level === 'platform' ? { ...entry, managedBy: 'superadmin', notifyBeforeEffective: false } : entry)
}

export interface PolicyContext {
  fosterPersonId?: string
  familyId?: string
  koUid?: string
  organizationId: string
}

/** 5 úrovní: pěstoun → Dohoda → klíčová osoba → organizace → platforma (§B.5.1). */
export async function resolvePolicy(
  key: PolicyParameterKey,
  context: PolicyContext,
  atDate: string = new Date().toISOString(),
): Promise<PolicyValue> {
  const refs = []
  if (context.fosterPersonId) refs.push(fosterPersonPolicyHistoryRef(context.fosterPersonId, key))
  if (context.familyId) refs.push(agreementPolicyHistoryRef(context.familyId, context.organizationId, key))
  if (context.koUid) refs.push(koPolicyHistoryRef(context.koUid, key))
  refs.push(orgPolicyHistoryRef(context.organizationId, key))
  refs.push(legislativeParamHistoryRef(key))
  const resolved = await resolveCascade<PolicyValue>(refs, atDate)
  return resolved ?? DEFAULT_POLICY_VALUES[key]
}

/** §B.5.1 — POVINNÉ zdůvodnění, pokud se politika povoluje (vynuceno tady,
 * ne jen v UI — volání bez `note` při value='povoleno' vyhodí chybu). */
export async function setPolicyOverride(
  level: 'fosterPerson' | 'agreement' | 'ko' | 'organization' | 'platform',
  ids: { fosterPersonId?: string; familyId?: string; organizationId?: string; koUid?: string },
  key: PolicyParameterKey,
  value: PolicyValue,
  setBy: string,
  note?: string,
): Promise<void> {
  if (value === 'povoleno' && !note?.trim()) {
    throw new Error('Povolení politiky vyžaduje zdůvodnění (note).')
  }
  const now = new Date().toISOString()
  const entry = { value, effectiveFrom: now, effectiveTo: null, setBy, setAt: now, note: note ?? null }
  const ref =
    level === 'fosterPerson'
      ? fosterPersonPolicyHistoryRef(ids.fosterPersonId!, key)
      : level === 'agreement'
        ? agreementPolicyHistoryRef(ids.familyId!, ids.organizationId!, key)
        : level === 'ko'
          ? koPolicyHistoryRef(ids.koUid!, key)
          : level === 'organization'
            ? orgPolicyHistoryRef(ids.organizationId!, key)
            : legislativeParamHistoryRef(key)
  await setDoc(doc(ref), level === 'platform' ? { ...entry, managedBy: 'superadmin', notifyBeforeEffective: false } : entry)
}

/** Přehled pro vedení/superadmina — aktivní výjimky (`value='povoleno'`).
 * §B.5.1: "Bez tohohle by flexibilita znamenala ztrátu přehledu."
 * SEAM: zatím jen organizační úroveň — plné napříč-organizační sečtení i
 * pěstoun/Dohoda/KO úrovní by potřebovalo `collectionGroup('history')`
 * dotaz, který by ale nerozeznal rate od policy záznamů (obě podkolekce
 * se jmenují stejně) bez dalšího pole navíc — mimo rozsah týhle dávky,
 * org_admin/vedení uvidí aspoň nejběžnější (organizační) úroveň. */
export interface ActivePolicyException {
  level: 'fosterPerson' | 'agreement' | 'ko' | 'organization'
  scopeId: string
  key: PolicyParameterKey
  note: string | null
  setBy: string
  setAt: string
}

export async function listActivePolicyOverridesForOrg(
  organizationId: string,
  key: PolicyParameterKey,
): Promise<ActivePolicyException[]> {
  const orgSnap = await getDocs(orgPolicyHistoryRef(organizationId, key))
  const results: ActivePolicyException[] = []
  const latestOrg = pickLatest(orgSnap.docs.map((d) => d.data() as CascadeHistoryEntry<PolicyValue>))
  if (latestOrg?.value === 'povoleno') {
    results.push({ level: 'organization', scopeId: organizationId, key, note: latestOrg.note ?? null, setBy: latestOrg.setBy, setAt: latestOrg.setAt })
  }
  return results
}

function pickLatest<T>(entries: CascadeHistoryEntry<T>[]): CascadeHistoryEntry<T> | null {
  if (entries.length === 0) return null
  return [...entries].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
}

export async function getSpvppBucketRange(key: SpvppBucketKey, atDate: string = new Date().toISOString()): Promise<SpvppBucketRange> {
  const entry = await resolveLatestHistoryEntry<SpvppBucketRange>(legislativeParamHistoryRef(key), atDate)
  return entry?.value ?? DEFAULT_SPVPP_BUCKETS[key]
}
