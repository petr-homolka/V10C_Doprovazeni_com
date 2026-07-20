import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ExternalParticipantDoc } from '@/types/externalParticipant'

/**
 * Barrel service — §5.1. SEAM: tady jen základní CRUD (dost na to, aby
 * §B.10.2 asistovaný kontakt měl na co odkazovat přes `participantRefs`) —
 * plný 3-krokový grant/permission engine (`requestGrant→approveGrant→
 * activateGrant`, `externalRoleTemplates`) je M8, samostatný modul s
 * vlastní povinnou §11.2 rules test sadou, NENÍ součástí týhle M6+M7
 * dávky. Typ (`types/externalParticipant.ts`) má granty/oprávnění už
 * navržené dopředu, jen se zatím nepoužívají.
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
