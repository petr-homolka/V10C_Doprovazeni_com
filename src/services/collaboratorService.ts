import { collection, doc, deleteDoc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getChild, getFosterPerson } from '@/services/familyService'
import { getActiveAgreement } from '@/services/agreementService'
import { getStaffMember } from '@/services/staffService'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type {
  CollaboratorAssignmentDoc,
  CollaboratorEntityType,
  CollaboratorEntryDoc,
  CollaboratorModuleKey,
} from '@/types/collaborator'

/**
 * Barrel service pro Spolupracovníka (M9, UX zpětná vazba 2026-07-21) —
 * viz doc komentář v src/types/collaborator.ts pro celý model.
 */
function assignmentId(collaboratorUid: string, entityType: CollaboratorEntityType, entityId: string): string {
  return `${collaboratorUid}_${entityType}_${entityId}`
}

function assignmentRef(collaboratorUid: string, entityType: CollaboratorEntityType, entityId: string) {
  return doc(db, 'collaboratorAssignments', assignmentId(collaboratorUid, entityType, entityId))
}

export interface AssignCollaboratorInput {
  organizationId: string
  collaboratorUid: string
  entityType: CollaboratorEntityType
  entityId: string
  createdBy: string
}

/** Snapshotuje jméno/adresu/klíčovou osobu PŘI přiřazení — viz
 * `CollaboratorAssignmentDoc` doc komentář pro proč (ne živý odkaz). */
export async function assignEntityToCollaborator(input: AssignCollaboratorInput): Promise<void> {
  const entity =
    input.entityType === 'child' ? await getChild(input.entityId) : await getFosterPerson(input.entityId)
  if (!entity) throw new Error('Osoba nenalezena.')

  const familySnap = await getDoc(doc(db, 'families', entity.familyId))
  const family = familySnap.exists() ? (familySnap.data() as FamilyDoc) : null

  const agreement = await getActiveAgreement(entity.familyId, input.organizationId)
  const keyPerson = agreement?.assignedTo ? await getStaffMember(agreement.assignedTo) : null

  const data: CollaboratorAssignmentDoc = {
    organizationId: input.organizationId,
    collaboratorUid: input.collaboratorUid,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: `${entity.firstName} ${entity.lastName}`,
    familyDocId: entity.familyId,
    familyUid: family?.uid ?? entity.familyId,
    addressSnapshot: family?.address ?? null,
    phoneSnapshot: input.entityType === 'fosterPerson' ? (entity as FosterPersonDoc).phone ?? null : null,
    keyPersonNameSnapshot: keyPerson?.displayName ?? null,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  }
  await setDoc(assignmentRef(input.collaboratorUid, input.entityType, input.entityId), data)
}

export async function unassignEntityFromCollaborator(
  collaboratorUid: string,
  entityType: CollaboratorEntityType,
  entityId: string,
): Promise<void> {
  await deleteDoc(assignmentRef(collaboratorUid, entityType, entityId))
}

export async function listAssignmentsForCollaborator(
  collaboratorUid: string,
): Promise<Array<{ docId: string; assignment: CollaboratorAssignmentDoc }>> {
  const snap = await getDocs(
    query(collection(db, 'collaboratorAssignments'), where('collaboratorUid', '==', collaboratorUid)),
  )
  return snap.docs.map((d) => ({ docId: d.id, assignment: d.data() as CollaboratorAssignmentDoc }))
}

/** Kdo všechno (spolupracovníci) má tuhle konkrétní osobu přiřazenou —
 * pro zobrazení na profilu dítěte/pěstouna ("Přiřazeno: Jana N."). */
export async function listAssignmentsForEntity(
  organizationId: string,
  entityType: CollaboratorEntityType,
  entityId: string,
): Promise<Array<{ docId: string; assignment: CollaboratorAssignmentDoc }>> {
  const snap = await getDocs(
    query(
      collection(db, 'collaboratorAssignments'),
      where('organizationId', '==', organizationId),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
    ),
  )
  return snap.docs.map((d) => ({ docId: d.id, assignment: d.data() as CollaboratorAssignmentDoc }))
}

export async function setCollaboratorModules(
  uid: string,
  modules: Partial<Record<CollaboratorModuleKey, boolean>>,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { collaboratorModules: modules })
}

// ---- collaboratorAssignments/{assignmentId}/entries/{entryId} — vlastní pracovní zápis ----

function entriesCollection(collaboratorUid: string, entityType: CollaboratorEntityType, entityId: string) {
  return collection(assignmentRef(collaboratorUid, entityType, entityId), 'entries')
}

export async function createCollaboratorEntry(
  collaboratorUid: string,
  entityType: CollaboratorEntityType,
  entityId: string,
  body: string,
): Promise<void> {
  const ref = doc(entriesCollection(collaboratorUid, entityType, entityId))
  await setDoc(ref, {
    body,
    occurredAt: new Date().toISOString(),
    createdByUid: collaboratorUid,
  } satisfies CollaboratorEntryDoc)
}

export async function listCollaboratorEntries(
  collaboratorUid: string,
  entityType: CollaboratorEntityType,
  entityId: string,
): Promise<Array<{ docId: string; entry: CollaboratorEntryDoc }>> {
  const snap = await getDocs(entriesCollection(collaboratorUid, entityType, entityId))
  return snap.docs.map((d) => ({ docId: d.id, entry: d.data() as CollaboratorEntryDoc }))
}
