import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { OrganizationDoc } from '@/types/organization'
import { PLATFORM_DEFAULTS_DOC_ID, type PlatformDefaultsDoc } from '@/types/platformDefaults'

export async function getOrganization(orgId: string): Promise<OrganizationDoc | null> {
  const snap = await getDoc(doc(db, 'organizations', orgId))
  return snap.exists() ? (snap.data() as OrganizationDoc) : null
}

/** §6 A9 kapacita KO — org-level práh (prostřední úroveň kaskády).
 * `null` = smazat override, spadnout na platformní výchozí. */
export async function updateOrgCapacityThreshold(
  orgId: string,
  koCapacityThreshold: number | null,
): Promise<void> {
  await updateDoc(doc(db, 'organizations', orgId), { koCapacityThreshold })
}

export async function getPlatformDefaults(): Promise<PlatformDefaultsDoc | null> {
  const snap = await getDoc(doc(db, 'platformDefaults', PLATFORM_DEFAULTS_DOC_ID))
  return snap.exists() ? (snap.data() as PlatformDefaultsDoc) : null
}

/** Superadmin-only (viz firestore.rules) — platformní výchozí práh kapacity KO. */
export async function setPlatformKoCapacityThreshold(koCapacityThreshold: number): Promise<void> {
  await setDoc(doc(db, 'platformDefaults', PLATFORM_DEFAULTS_DOC_ID), { koCapacityThreshold }, { merge: true })
}

/** Org-level výchozí délka Dohody v měsících — `null` = smazat override,
 * spadnout na platformní výchozí (stejný vzor jako `updateOrgCapacityThreshold`). */
export async function updateOrgAgreementDurationMonths(
  orgId: string,
  agreementDefaultDurationMonths: number | null,
): Promise<void> {
  await updateDoc(doc(db, 'organizations', orgId), { agreementDefaultDurationMonths })
}

/** Superadmin-only (viz firestore.rules) — platformní výchozí délka Dohody v měsících. */
export async function setPlatformAgreementDefaultDurationMonths(agreementDefaultDurationMonths: number): Promise<void> {
  await setDoc(doc(db, 'platformDefaults', PLATFORM_DEFAULTS_DOC_ID), { agreementDefaultDurationMonths }, { merge: true })
}
