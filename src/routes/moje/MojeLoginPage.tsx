import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  forgetFosterInviteEmail,
  getFosterInvitation,
  markFosterInvitationConsumed,
  recallFosterInviteEmail,
} from '@/services/fosterInvitationService'
import type { UserDoc } from '@/types/user'

/**
 * `/moje/prihlaseni` — §6 A6 dokončení magic linku. NENÍ za žádným auth
 * guardem (na rozdíl od zbytku `/moje/*`, viz RequireFosterAuth) — to je
 * celý její smysl, dokončuje přihlášení dřív, než profil vůbec existuje.
 *
 * Tři stavy podle toho, co je v `localStorage` (`recallFosterInviteEmail`,
 * viz fosterInvitationService.ts):
 * 1. E-mail je zapamatovaný ZE STEJNÉHO zařízení/prohlížeče, co pozvánku
 *    odeslal → dokončí se rovnou, bez dalšího vstupu.
 * 2. Pěstoun otevřel odkaz JINDE (jiný telefon/e-mailová appka) →
 *    Firebase `signInWithEmailLink` potřebuje e-mail znovu (odkaz sám ho
 *    nenese) → zeptáme se ho ručně, pak dokončíme.
 * 3. Už MÁ hotový `pestoun` profil (opakované přihlášení, ne první
 *    pozvánka) → rovnou na `/moje`, bez zakládání čehokoli.
 *
 * Založení `users/{uid}` profilu čte `foster_invitations/{email}` —
 * `fosterPersonDisplayName` bydlí PŘÍMO na pozvánce (ne dočtené z
 * `fosterPersons/{fosterPersonRef}`), protože profil-less uživatel
 * `fosterPersons` ještě nesmí číst (viz FosterInvitationDoc komentář).
 */
export default function MojeLoginPage() {
  const navigate = useNavigate()
  const { firebaseUser, userDoc, loading } = useAuth()

  const [needsEmailInput, setNeedsEmailInput] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [working, setWorking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function completeSignIn(email: string) {
    setWorking(true)
    setError(null)
    try {
      const credential = await signInWithEmailLink(auth, email, window.location.href)
      forgetFosterInviteEmail()
      const uid = credential.user.uid
      const existingProfile = await getDoc(doc(db, 'users', uid))
      if (!existingProfile.exists()) {
        const invitation = await getFosterInvitation(email)
        if (!invitation || invitation.consumedAt) {
          setError('Tahle pozvánka už není platná — požádejte klíčovou osobu o novou.')
          setWorking(false)
          return
        }
        const userData: UserDoc = {
          uid,
          role: 'pestoun',
          displayName: invitation.fosterPersonDisplayName,
          email,
          organizationId: invitation.organizationId,
          fosterFamilyId: invitation.familyId,
          fosterPersonRef: invitation.fosterPersonRef,
          createdAt: new Date().toISOString(),
        }
        await setDoc(doc(db, 'users', uid), userData)
        await markFosterInvitationConsumed(email, uid)
      }
      navigate('/moje', { replace: true })
    } catch {
      setError('Přihlášení se nezdařilo — odkaz může být neplatný nebo už prošlý.')
      setWorking(false)
    }
  }

  useEffect(() => {
    if (loading) return
    if (firebaseUser && userDoc?.role === 'pestoun') {
      navigate('/moje', { replace: true })
      return
    }
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setError('Tenhle odkaz není platný přihlašovací odkaz.')
      setWorking(false)
      return
    }
    const storedEmail = recallFosterInviteEmail()
    if (storedEmail) {
      completeSignIn(storedEmail)
    } else {
      setNeedsEmailInput(true)
      setWorking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    if (emailInput.trim()) completeSignIn(emailInput.trim().toLowerCase())
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-6">
      <div className="w-full max-w-[360px] rounded-lg border border-border bg-surface p-6 text-center">
        <h1 className="text-xl font-bold leading-tight text-text-primary">Doprovázení.com</h1>

        {needsEmailInput ? (
          <form onSubmit={handleEmailSubmit} className="mt-4 flex flex-col gap-3 text-left">
            <p className="text-sm text-text-secondary">
              Pro dokončení přihlášení potvrďte e-mail, na který jste dostali pozvánku.
            </p>
            <Input
              type="email"
              required
              placeholder="vas@email.cz"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
            <Button type="submit" disabled={working}>
              {working ? 'Přihlašuji…' : 'Potvrdit a přihlásit'}
            </Button>
          </form>
        ) : working ? (
          <p className="mt-4 text-sm text-text-secondary">Přihlašuji…</p>
        ) : (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
