import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { UserDoc, UserRole } from '@/types/user'
import { AuthContext } from './auth-context'

const PREVIEW_ROLE_STORAGE_KEY = 'doprovazeni:devRolePreview'

function readStoredPreviewRole(): UserRole | null {
  try {
    return (localStorage.getItem(PREVIEW_ROLE_STORAGE_KEY) as UserRole | null) || null
  } catch {
    return null
  }
}

/**
 * §10 provozní úspornost: JEDINÝ realtime listener v celé appce je vlastní
 * profil přihlášeného uživatele (users/{uid}). Vše ostatní je jednorázové
 * getDocs/getDoc + ruční reload — nekopíruj tenhle vzor jinam.
 *
 * Náhled role (jen účet s `devRolePreview: true`, viz UserDoc komentář):
 * `realUserDoc` je VŽDY skutečný Firestore dokument, `userDoc` vystavené
 * ven má `.role` přepsané na `previewRole`, pokud je nastavený — takže
 * celá appka (StaffPage, FamilyDetailPage, AccountMenu, ...) beze změny
 * reaguje na náhled přesně jako na skutečnou roli, aniž by o tom věděla.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [realUserDoc, setRealUserDoc] = useState<UserDoc | null>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [profileResolved, setProfileResolved] = useState(false)
  const [previewRole, setPreviewRoleState] = useState<UserRole | null>(readStoredPreviewRole)

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setAuthResolved(true)
      if (!user) {
        setRealUserDoc(null)
        setProfileResolved(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!firebaseUser) return
    setProfileResolved(false)
    return onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
      setRealUserDoc(snap.exists() ? (snap.data() as UserDoc) : null)
      setProfileResolved(true)
    })
  }, [firebaseUser])

  const loading = !authResolved || !profileResolved
  const canPreviewRoles = realUserDoc?.devRolePreview === true

  function setPreviewRole(role: UserRole | null) {
    setPreviewRoleState(role)
    try {
      if (role) localStorage.setItem(PREVIEW_ROLE_STORAGE_KEY, role)
      else localStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY)
    } catch {
      // localStorage nedostupné (privátní režim apod.) — náhled zůstane jen pro tuhle session.
    }
  }

  const userDoc = useMemo(() => {
    if (!realUserDoc) return null
    if (canPreviewRoles && previewRole) return { ...realUserDoc, role: previewRole }
    return realUserDoc
  }, [realUserDoc, canPreviewRoles, previewRole])

  return (
    <AuthContext.Provider
      value={{ firebaseUser, userDoc, loading, canPreviewRoles, previewRole, setPreviewRole }}
    >
      {children}
    </AuthContext.Provider>
  )
}
