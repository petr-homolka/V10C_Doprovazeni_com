import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { actorFields, recordAudit } from '@/services/auditLogService'
import type { AuditAction, AuditActor } from '@/types/auditLog'
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
/**
 * Kontext pro auditní stopu. Je POVINNÝ u všech funkcí, které hýbou
 * s přístupem k údajům — díky tomu překladač nepustí nové volání, které
 * by se zapomnělo zalogovat. To je celý smysl: aby na log nešlo zapomenout.
 */
export interface GrantAuditContext {
  organizationId: string
  actor: AuditActor
  /** Koho se přístup týká (dítě/pěstoun) — denormalizovaný popisek. */
  entityLabel: string
  /** Externista, kterému se přístup dává. */
  participantLabel: string
}

async function logGrant(
  action: AuditAction,
  ctx: GrantAuditContext,
  entityId: string,
  epId: string,
  permissionLabel: string,
): Promise<void> {
  await recordAudit({
    organizationId: ctx.organizationId,
    action,
    ...actorFields(ctx.actor),
    subject: { kind: 'other', id: entityId, label: ctx.entityLabel },
    target: { kind: 'externalParticipant', id: epId, label: ctx.participantLabel },
    detail: permissionLabel,
  })
}

export async function grantDirect(
  epId: string,
  entityId: string,
  permissionKey: PermissionKey,
  validFrom: string,
  grantedBy: string,
  audit: GrantAuditContext,
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
  await logGrant('external_grant_activated', audit, entityId, epId, `Přímo udělené oprávnění: ${permissionKey}`)
  return ref.id
}

/** Citlivé oprávnění — krok 1/3, čeká na `approveGrant`. */
export async function requestGrant(
  epId: string,
  entityId: string,
  permissionKey: PermissionKey,
  validFrom: string,
  requestedBy: string,
  audit: GrantAuditContext,
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
  await logGrant('external_grant_requested', audit, entityId, epId, `Citlivé oprávnění: ${permissionKey}`)
  return ref.id
}

/** Krok 2/3 — vedení organizace. */
export async function approveGrant(
  epId: string,
  entityId: string,
  grantId: string,
  approvedBy: string,
  audit: GrantAuditContext,
): Promise<void> {
  await updateDoc(doc(grantsCollection(epId, entityId), grantId), {
    status: 'approved',
    approvedBy,
    approvedAt: new Date().toISOString(),
  })
  await logGrant('external_grant_approved', audit, entityId, epId, 'Schváleno vedením')
}

export async function rejectGrant(
  epId: string,
  entityId: string,
  grantId: string,
  approvedBy: string,
  audit: GrantAuditContext,
  note?: string,
): Promise<void> {
  await updateDoc(doc(grantsCollection(epId, entityId), grantId), {
    status: 'rejected',
    approvedBy,
    approvedAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  })
  await logGrant('external_grant_rejected', audit, entityId, epId, note ?? 'Zamítnuto')
}

/** Krok 3/3 — samostatný, užší gate (jen org_admin, viz firestore.rules). */
export async function activateGrant(
  epId: string,
  entityId: string,
  grantId: string,
  activatedBy: string,
  audit: GrantAuditContext,
): Promise<void> {
  await updateDoc(doc(grantsCollection(epId, entityId), grantId), {
    status: 'active',
    activatedBy,
    activatedAt: new Date().toISOString(),
  })
  await logGrant('external_grant_activated', audit, entityId, epId, 'Přístup aktivován')
}

/** Odebrání přístupu — VŽDY `validTo`, nikdy delete (viz firestore.rules `allow delete: if false`). */
export async function revokeGrant(
  epId: string,
  entityId: string,
  grantId: string,
  revokedBy: string,
  audit: GrantAuditContext,
  note?: string,
): Promise<void> {
  const now = new Date().toISOString()
  await updateDoc(doc(grantsCollection(epId, entityId), grantId), {
    status: 'revoked',
    validTo: now,
    revokedBy,
    revokedAt: now,
    ...(note ? { note } : {}),
  })
  await logGrant('external_grant_revoked', audit, entityId, epId, note ?? 'Přístup odebrán')
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
