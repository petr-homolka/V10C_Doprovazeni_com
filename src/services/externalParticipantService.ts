import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ExternalParticipantDoc, ExternalRoleTemplateDoc, GrantDoc, PermissionKey } from '@/types/externalParticipant'
import { isSensitivePermission } from '@/types/externalParticipant'

/**
 * Barrel service — §5.1. M8: plný grant/permission engine (viz
 * firestore.rules `access/{entityId}/grants/{grantId}` pro vynucení stejných
 * přechodů na serveru — tahle vrstva jen volá zápisy, autoritativní kontrola
 * je v rules).
 */
function participantsCollection() {
  return collection(db, 'external_participants')
}

export async function createExternalParticipant(
  data: Omit<ExternalParticipantDoc, 'createdAt'>,
): Promise<string> {
  const ref = doc(participantsCollection())
  await setDoc(ref, { ...data, createdAt: new Date().toISOString() } satisfies ExternalParticipantDoc)
  return ref.id
}

export async function listExternalParticipants(
  organizationId: string,
): Promise<Array<{ docId: string; participant: ExternalParticipantDoc }>> {
  const snap = await getDocs(query(participantsCollection(), where('organizationId', '==', organizationId)))
  return snap.docs.map((d) => ({ docId: d.id, participant: d.data() as ExternalParticipantDoc }))
}

export async function getExternalParticipant(id: string): Promise<ExternalParticipantDoc | null> {
  const snap = await getDoc(doc(participantsCollection(), id))
  return snap.exists() ? (snap.data() as ExternalParticipantDoc) : null
}

// ---- Granty — external_participants/{epId}/access/{entityId}/grants/{grantId} ----
// entityId = docId dítěte NEBO pěstouna, viz ExternalEntityType.

function grantsCollection(epId: string, entityId: string) {
  return collection(db, 'external_participants', epId, 'access', entityId, 'grants')
}

export async function listGrantsForEntity(
  epId: string,
  entityId: string,
): Promise<Array<{ docId: string; grant: GrantDoc }>> {
  const snap = await getDocs(grantsCollection(epId, entityId))
  return snap.docs.map((d) => ({ docId: d.id, grant: d.data() as GrantDoc }))
}

/** Necitlivé oprávnění — rovnou `active`, jeden krok/jeden aktér. */
export async function grantDirect(
  epId: string,
  entityId: string,
  permissionKey: PermissionKey,
  validFrom: string,
  grantedBy: string,
): Promise<string> {
  if (isSensitivePermission(permissionKey)) {
    throw new Error(`${permissionKey} je citlivé oprávnění — použij requestGrant, ne grantDirect.`)
  }
  const ref = doc(grantsCollection(epId, entityId))
  await setDoc(ref, {
    permissionKey,
    status: 'active',
    validFrom,
    requestedBy: grantedBy,
    requestedAt: new Date().toISOString(),
    activatedBy: grantedBy,
    activatedAt: new Date().toISOString(),
  } satisfies GrantDoc)
  return ref.id
}

/** Citlivé oprávnění — krok 1/3, čeká na `approveGrant`. */
export async function requestGrant(
  epId: string,
  entityId: string,
  permissionKey: PermissionKey,
  validFrom: string,
  requestedBy: string,
  note?: string,
): Promise<string> {
  const ref = doc(grantsCollection(epId, entityId))
  await setDoc(ref, {
    permissionKey,
    status: 'requested',
    validFrom,
    requestedBy,
    requestedAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  } satisfies GrantDoc)
  return ref.id
}

/** Krok 2/3 — vedení organizace. */
export async function approveGrant(epId: string, entityId: string, grantId: string, approvedBy: string): Promise<void> {
  await updateDoc(doc(grantsCollection(epId, entityId), grantId), {
    status: 'approved',
    approvedBy,
    approvedAt: new Date().toISOString(),
  })
}

export async function rejectGrant(epId: string, entityId: string, grantId: string, approvedBy: string, note?: string): Promise<void> {
  await updateDoc(doc(grantsCollection(epId, entityId), grantId), {
    status: 'rejected',
    approvedBy,
    approvedAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  })
}

/** Krok 3/3 — samostatný, užší gate (jen org_admin, viz firestore.rules). */
export async function activateGrant(epId: string, entityId: string, grantId: string, activatedBy: string): Promise<void> {
  await updateDoc(doc(grantsCollection(epId, entityId), grantId), {
    status: 'active',
    activatedBy,
    activatedAt: new Date().toISOString(),
  })
}

/** Odebrání přístupu — VŽDY `validTo`, nikdy delete (viz firestore.rules `allow delete: if false`). */
export async function revokeGrant(epId: string, entityId: string, grantId: string, revokedBy: string, note?: string): Promise<void> {
  const now = new Date().toISOString()
  await updateDoc(doc(grantsCollection(epId, entityId), grantId), {
    status: 'revoked',
    validTo: now,
    revokedBy,
    revokedAt: now,
    ...(note ? { note } : {}),
  })
}

// ---- organizations/{orgId}/externalRoleTemplates/{id} ----

function roleTemplatesCollection(organizationId: string) {
  return collection(db, 'organizations', organizationId, 'externalRoleTemplates')
}

export async function createRoleTemplate(
  organizationId: string,
  data: Omit<ExternalRoleTemplateDoc, 'updatedAt'>,
): Promise<string> {
  const ref = doc(roleTemplatesCollection(organizationId))
  await setDoc(ref, { ...data, updatedAt: new Date().toISOString() } satisfies ExternalRoleTemplateDoc)
  return ref.id
}

export async function listRoleTemplates(
  organizationId: string,
): Promise<Array<{ docId: string; template: ExternalRoleTemplateDoc }>> {
  const snap = await getDocs(roleTemplatesCollection(organizationId))
  return snap.docs.map((d) => ({ docId: d.id, template: d.data() as ExternalRoleTemplateDoc }))
}
