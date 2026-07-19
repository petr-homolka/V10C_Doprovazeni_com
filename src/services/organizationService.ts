import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { OrganizationDoc } from '@/types/organization'

export async function getOrganization(orgId: string): Promise<OrganizationDoc | null> {
  const snap = await getDoc(doc(db, 'organizations', orgId))
  return snap.exists() ? (snap.data() as OrganizationDoc) : null
}
