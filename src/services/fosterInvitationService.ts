import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { sendSignInLinkToEmail } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import type { FosterInvitationDoc } from '@/types/fosterInvitation'

/**
 * Barrel service (ZADANI §11 bod 3) pro §6 A6 "Pozvání pěstouna (magic
 * link)". Firebase Auth Email Link (passwordless) sign-in — Firebase
 * ODESÍLÁ e-mail SÁM (vlastní šablona, server-side, konfigurovatelná v
 * Console), žádná Cloud Function ani vlastní e-mailový systém (§10 "žádné
 * Cloud Functions").
 *
 * Vyžaduje JEDNORÁZOVÝ ruční krok v Console (Authentication → Sign-in
 * method → Email/Password → zapnout "Email link (passwordless
 * sign-in)") — stejný nescriptovatelný vzor jako Auth/Storage "Get
 * started" tlačítko dřív v projektu (viz reference_firebase_github
 * memory). Bez tohohle kroku `sendSignInLinkToEmail` spadne na
 * `auth/operation-not-allowed`.
 *
 * E-mail v `localStorage` (`FOSTER_INVITE_EMAIL_KEY`) je STANDARDNÍ
 * Firebase vzor pro dokončení odkazu na STEJNÉM zařízení/prohlížeči, kde
 * byl odeslán (`signInWithEmailLink` potřebuje e-mail znovu, odkaz sám ho
 * nenese) — pokud pěstoun otevře odkaz jinde (jiný telefon/prohlížeč),
 * `MojeLoginPage` ho o e-mail požádá ručně (SEAM, viz ta stránka).
 */
const FOSTER_INVITE_EMAIL_KEY = 'doprovazeni:fosterInviteEmail'

export function rememberFosterInviteEmail(email: string): void {
  localStorage.setItem(FOSTER_INVITE_EMAIL_KEY, email)
}

export function recallFosterInviteEmail(): string | null {
  return localStorage.getItem(FOSTER_INVITE_EMAIL_KEY)
}

export function forgetFosterInviteEmail(): void {
  localStorage.removeItem(FOSTER_INVITE_EMAIL_KEY)
}

export interface SendFosterInvitationInput {
  email: string
  organizationId: string
  familyId: string
  fosterPersonRef: string
  fosterPersonDisplayName: string
  invitedByUid: string
  invitedByDisplayName: string
}

export async function sendFosterInvitation(input: SendFosterInvitationInput): Promise<void> {
  const invitationData: FosterInvitationDoc = {
    email: input.email,
    organizationId: input.organizationId,
    familyId: input.familyId,
    fosterPersonRef: input.fosterPersonRef,
    fosterPersonDisplayName: input.fosterPersonDisplayName,
    invitedByUid: input.invitedByUid,
    invitedByDisplayName: input.invitedByDisplayName,
    createdAt: new Date().toISOString(),
    consumedAt: null,
    consumedByUid: null,
  }
  // Pozvánka MUSÍ existovat DŘÍV, než pěstoun klikne na odkaz — `users/{uid}`
  // create pravidlo na ni odkazuje přes `get()`, viz firestore.rules.
  await setDoc(doc(db, 'foster_invitations', input.email), invitationData)

  await sendSignInLinkToEmail(auth, input.email, {
    url: `${window.location.origin}/moje/prihlaseni`,
    handleCodeInApp: true,
  })
  rememberFosterInviteEmail(input.email)
}

export async function getFosterInvitation(email: string): Promise<FosterInvitationDoc | null> {
  const snap = await getDoc(doc(db, 'foster_invitations', email))
  return snap.exists() ? (snap.data() as FosterInvitationDoc) : null
}

export async function markFosterInvitationConsumed(email: string, consumedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'foster_invitations', email), {
    consumedAt: new Date().toISOString(),
    consumedByUid,
  })
}
