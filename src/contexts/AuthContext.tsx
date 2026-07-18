import { useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { UserDoc } from '@/types/user'
import { AuthContext } from './auth-context'

/**
 * §10 provozní úspornost: JEDINÝ realtime listener v celé appce je vlastní
 * profil přihlášeného uživatele (users/{uid}). Vše ostatní je jednorázové
 * getDocs/getDoc + ruční reload — nekopíruj tenhle vzor jinam.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [profileResolved, setProfileResolved] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setAuthResolved(true)
      if (!user) {
        setUserDoc(null)
        setProfileResolved(true)
      }
    })
  }, [])

  useEffect(() => {
    if (!firebaseUser) return
    setProfileResolved(false)
    return onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
      setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null)
      setProfileResolved(true)
    })
  }, [firebaseUser])

  const loading = !authResolved || !profileResolved

  return (
    <AuthContext.Provider value={{ firebaseUser, userDoc, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
