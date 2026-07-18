import { createContext } from 'react'
import type { User as FirebaseUser } from 'firebase/auth'
import type { UserDoc } from '@/types/user'

export interface AuthContextValue {
  firebaseUser: FirebaseUser | null
  userDoc: UserDoc | null
  /** true, dokud neproběhl první auth i profil callback */
  loading: boolean
}

export const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userDoc: null,
  loading: true,
})
