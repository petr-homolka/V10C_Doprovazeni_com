import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * users/{uid}/starredFamilies/{familyId} — hvězdička v seznamu Rodin (UX
 * zpětná vazba 2026-07-21): "vidí jen ten, kdo si ji udělal" — proto pod
 * VLASTNÍM `users/{uid}`, ne na Spisu samotném, kde by byla sdílená napříč
 * celým týmem. Existence dokumentu = označeno, žádná další pole potřeba.
 */
function starRef(uid: string, familyDocId: string) {
  return doc(db, 'users', uid, 'starredFamilies', familyDocId)
}

export async function listStarredFamilyIds(uid: string): Promise<string[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'starredFamilies'))
  return snap.docs.map((d) => d.id)
}

export async function setFamilyStarred(uid: string, familyDocId: string, starred: boolean): Promise<void> {
  if (starred) {
    await setDoc(starRef(uid, familyDocId), { starredAt: new Date().toISOString() })
  } else {
    await deleteDoc(starRef(uid, familyDocId))
  }
}
