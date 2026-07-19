import { doc, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import type { SubjectRefKind } from '@/types/timelineEntry'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
// Musí zrcadlit `isReasonableImage()` v storage.rules — záměrně bez SVG
// (umí nést <script>, zbytečné riziko navíc u dětských fotek).
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Avatary čtyř entit (Dohoda/rodina/pěstoun/dítě, M3 avatar+mikrofon
 * feature) — Cloud Storage cesta zrcadlí `storage.rules` přesně (viz ten
 * soubor pro bezpečnostní zdůvodnění, zejména u dětí). `avatarUrl` na
 * Firestore dokumentu je jen zobrazovací cache downloadURL — zdroj pravdy
 * je vždy Storage objekt samotný.
 */
function avatarStoragePath(kind: SubjectRefKind, ids: { familyId?: string; id: string }): string {
  const fileName = 'avatar.jpg'
  switch (kind) {
    case 'family':
      return `avatars/families/${ids.id}/${fileName}`
    case 'fosterPerson':
      return `avatars/fosterPersons/${ids.id}/${fileName}`
    case 'child':
      return `avatars/children/${ids.id}/${fileName}`
    case 'agreement':
      if (!ids.familyId) throw new Error('agreement avatar potřebuje familyId')
      return `avatars/agreements/${ids.familyId}/${ids.id}/${fileName}`
  }
}

function firestoreDocPath(kind: SubjectRefKind, ids: { familyId?: string; id: string }): string[] {
  switch (kind) {
    case 'family':
      return ['families', ids.id]
    case 'fosterPerson':
      return ['fosterPersons', ids.id]
    case 'child':
      return ['children', ids.id]
    case 'agreement':
      if (!ids.familyId) throw new Error('agreement avatar potřebuje familyId')
      return ['families', ids.familyId, 'agreements', ids.id]
  }
}

export interface UploadAvatarInput {
  kind: SubjectRefKind
  /** Firestore document ID entity (u Dohody: organizationId, deterministické ID). */
  id: string
  /** Jen u Dohody — jejího rodiče (families/{familyId}/agreements/{id}). */
  familyId?: string
  file: File
}

export async function uploadEntityAvatar(input: UploadAvatarInput): Promise<string> {
  if (!ALLOWED_AVATAR_TYPES.includes(input.file.type)) {
    throw new Error('Vyberte prosím obrázek ve formátu JPG, PNG nebo WebP.')
  }
  if (input.file.size > MAX_AVATAR_BYTES) {
    throw new Error('Obrázek je moc velký (limit 5 MB).')
  }

  const storagePath = avatarStoragePath(input.kind, { familyId: input.familyId, id: input.id })
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, input.file, { contentType: input.file.type })
  const avatarUrl = await getDownloadURL(storageRef)

  const [collectionName, ...rest] = firestoreDocPath(input.kind, { familyId: input.familyId, id: input.id })
  await updateDoc(doc(db, collectionName, ...rest), { avatarUrl })

  return avatarUrl
}
