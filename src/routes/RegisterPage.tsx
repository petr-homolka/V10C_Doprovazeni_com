import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { addDoc, collection, doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { allocateOrgCode } from '@/lib/orgCode'
import type { OrganizationDoc } from '@/types/organization'
import type { UserDoc } from '@/types/user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { checkEmail } from '@/lib/contactValidation'

/**
 * Self-service registrace organizace — ZADANI §6 A9. Zakládá TŘI věci
 * v pořadí (žádná atomická transakce napříč Auth+Firestore neexistuje —
 * viz SEAM níž): Auth účet → organizations/{orgId} → users/{uid} (role
 * org_admin). firestore.rules ověří, že `organizations` doc byl založen
 * PRÁVĚ tímhle uživatelem (`createdByUid`), než dovolí druhý zápis.
 *
 * SEAM: pokud selže krok 3 (napůl vytvořený Auth účet + organizace bez
 * profilu), zůstane osiřelý záznam — bez Cloud Function (mimo rozsah,
 * žádný nasazený projekt zatím neexistuje) nejde tohle udělat opravdu
 * atomicky. Přijatelné pro M1 základ, ne řešeno automatickým úklidem.
 */
export default function RegisterPage() {
  const navigate = useNavigate()
  const [orgName, setOrgName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const emailCheck = checkEmail(email)
    setEmail(emailCheck.value)
    setEmailError(emailCheck.ok ? null : emailCheck.message ?? null)
    if (!emailCheck.ok) return
    setSubmitting(true)
    try {
      const credential = await createUserWithEmailAndPassword(auth, emailCheck.value, password)
      const orgCode = await allocateOrgCode()

      const orgData: OrganizationDoc = {
        orgCode,
        name: orgName,
        createdByUid: credential.user.uid,
        createdAt: new Date().toISOString(),
      }
      const orgRef = await addDoc(collection(db, 'organizations'), orgData)

      const userData: UserDoc = {
        uid: credential.user.uid,
        role: 'org_admin',
        displayName,
        email,
        organizationId: orgRef.id,
        createdAt: new Date().toISOString(),
      }
      await setDoc(doc(db, 'users', credential.user.uid), userData)

      navigate('/', { replace: true })
    } catch {
      setError('Registrace se nezdařila. Zkontrolujte údaje a zkuste to znovu.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <div className="w-full max-w-[380px] rounded-lg border border-border bg-surface p-6 shadow-raised">
        <h1 className="mb-1 text-[26px] font-bold leading-tight text-text-primary">
          Registrace organizace
        </h1>
        <p className="mb-6 text-sm text-text-secondary">
          Založíte novou doprovázející organizaci a svůj správcovský účet.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Název organizace</span>
            <Input
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Vaše jméno</span>
            <Input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">E-mail</span>
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
              onBlur={() => {
                const result = checkEmail(email)
                setEmail(result.value)
                setEmailError(result.ok ? null : (result.message ?? null))
              }}
            />
            {emailError && <span className="text-xs text-danger">{emailError}</span>}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Heslo</span>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? 'Zakládám…' : 'Založit organizaci'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-text-secondary">
          Už máte účet?{' '}
          <Link to="/login" className="font-bold text-accent">
            Přihlaste se
          </Link>
        </p>
      </div>
    </div>
  )
}
