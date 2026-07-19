import { getApps, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  type Auth,
} from 'firebase/auth'
import { app as primaryApp } from './firebase'

/**
 * §6 A9: "Zaměstnance zakládá org_admin (přes sekundární Auth instanci)."
 * `createUserWithEmailAndPassword` na normální (primární) `auth` instanci
 * by AUTOMATICKY přihlásil prohlížeč jako nově založeného zaměstnance a
 * odhlásil právě přihlášeného org_admina — známá vlastnost Firebase Auth
 * client SDK, ne bug. Řešení: druhá, nezávislá `FirebaseApp` instance se
 * stejným configem, jen pro zakládání účtů — nikdy nic v ní neponecháváme
 * přihlášené (signOut hned po vytvoření).
 */
function getSecondaryAuth(): Auth {
  const existing = getApps().find((a) => a.name === 'staff-bootstrap')
  const secondaryApp =
    existing ?? initializeApp(primaryApp.options, 'staff-bootstrap')
  return getAuth(secondaryApp)
}

/**
 * Založí Auth účet pro nového zaměstnance a vrátí jeho `uid` — NEPŘIHLAŠUJE
 * volajícího (org_admina) jako nového uživatele, primární session zůstává
 * beze změny. `users/{uid}` Firestore dokument se zapisuje samostatně,
 * pod primární (aktuálně přihlášenou) identitou volajícího org_admina.
 */
export async function createStaffAuthAccount(email: string, password: string): Promise<string> {
  const secondaryAuth = getSecondaryAuth()
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  const uid = credential.user.uid
  await signOut(secondaryAuth)
  return uid
}
