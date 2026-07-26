import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { OrgDirectoryDoc, Region } from '@/types/orgDirectory'

/**
 * Veřejná vizitka organizace — na koho zavolat při předávání pěstouna.
 * Viz `types/orgDirectory.ts` pro to, proč je to samostatná kolekce.
 */

export function orgDirectoryRef(organizationId: string) {
  return doc(db, 'orgDirectory', organizationId)
}

export async function readOrgCard(organizationId: string): Promise<OrgDirectoryDoc | null> {
  const snap = await getDoc(orgDirectoryRef(organizationId))
  return snap.exists() ? (snap.data() as OrgDirectoryDoc) : null
}

export async function saveOrgCard(input: {
  organizationId: string
  name: string
  contactPersonName: string
  phone: string
  email: string
  address?: string
  region?: Region | ''
  website?: string
  ico?: string
  updatedByUid: string
}): Promise<void> {
  await setDoc(orgDirectoryRef(input.organizationId), {
    organizationId: input.organizationId,
    name: input.name.trim(),
    contactPersonName: input.contactPersonName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: (input.address ?? '').trim(),
    region: input.region ?? '',
    website: (input.website ?? '').trim(),
    ico: (input.ico ?? '').trim(),
    updatedAt: new Date().toISOString(),
    updatedByUid: input.updatedByUid,
  } satisfies OrgDirectoryDoc)
}
