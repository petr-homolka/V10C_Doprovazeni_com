import { createContext } from 'react'
import type { User as FirebaseUser } from 'firebase/auth'
import type { UserDoc, UserRole } from '@/types/user'

export interface AuthContextValue {
  firebaseUser: FirebaseUser | null
  /** Efektivní profil — se zapnutým náhledem role (viz `canPreviewRoles`)
   * má `.role` PŘEPSANÉ na `previewRole`, aby existující `userDoc?.role
   * === '...'` kontroly všude v appce automaticky respektovaly náhled beze
   * změny. `firestore.rules` se řídí VŽDY skutečnou rolí v dokumentu,
   * tenhle přepis je čistě klient-side zobrazení. */
  userDoc: UserDoc | null
  /** true, dokud neproběhl první auth i profil callback */
  loading: boolean
  /** true jen pro účet se `userDoc.devRolePreview === true` (viz komentář
   * na UserDoc) — brána pro zobrazení přepínače v AccountMenu. */
  canPreviewRoles: boolean
  previewRole: UserRole | null
  setPreviewRole: (role: UserRole | null) => void
}

export const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userDoc: null,
  loading: true,
  canPreviewRoles: false,
  previewRole: null,
  setPreviewRole: () => {},
})
