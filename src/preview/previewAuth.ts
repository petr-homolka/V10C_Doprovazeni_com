import type { AuthContextValue } from '@/contexts/auth-context'
import { currentUser } from './fixtures'

/**
 * Přihlášený člověk pro designový náhled. Vytažené z `main.tsx`, aby si to
 * mohly vzít i jednotlivé návrhové obrazovky, které si samy obalují
 * `AuthContext` (jinak by musely importovat `main.tsx` — a to je kruh,
 * protože `main.tsx` importuje je).
 */
export const previewAuth: AuthContextValue = {
  firebaseUser: { uid: currentUser.uid, email: currentUser.email } as never,
  userDoc: currentUser,
  loading: false,
  canPreviewRoles: false,
  previewRole: null,
  setPreviewRole: () => {},
}
