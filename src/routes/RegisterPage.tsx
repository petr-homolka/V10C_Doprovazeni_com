import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { addDoc, collection, doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { allocateOrgCode } from '@/lib/orgCode'
import type { OrganizationDoc } from '@/types/organization'
import { STAFF_ROLE_LABELS, type StaffRole, type UserDoc } from '@/types/user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { checkEmail } from '@/lib/contactValidation'
import { REGIONS, type Region } from '@/types/orgDirectory'
import { saveOrgCard } from '@/services/orgDirectoryService'
import { createStaffMember } from '@/services/staffService'

/**
 * PRŮVODCE REGISTRACÍ ORGANIZACE — tři kroky.
 *
 *   1. Organizace a vizitka
 *   2. Správce organizace (org_admin)
 *   3. Tým — vedení, klíčové osoby, ostatní
 *
 * ─── PROČ TO NENÍ JEDEN FORMULÁŘ ──────────────────────────────────────
 *
 * Dřív to jeden formulář byl: název, jméno, e-mail, heslo. Fungoval, ale
 * organizace tím vznikla NEVIDITELNÁ — bez kontaktu, bez kraje, bez týmu.
 * Jenže od 26. 7. na vizitce visí předávání pěstounů mezi organizacemi:
 * kdo ji nemá vyplněnou, toho nová organizace nemá jak kontaktovat
 * a předání se zastaví. Vyplnit ji „někdy potom v nastavení" znamená
 * nikdy.
 *
 * Krok 3 je schválně AŽ PO založení účtu, ne před: zaměstnance zakládá
 * `createStaffMember` přes sekundární Auth instanci a ta potřebuje
 * přihlášeného org_admina (viz `lib/secondaryAuth.ts`). Kroky 1 a 2 se
 * tedy jen sbírají a odesílají se najednou; teprve pak jde přidávat tým.
 *
 * Krok 3 se dá přeskočit — kdo zakládá organizaci v pátek večer, nemá po
 * ruce e-maily kolegů. Nedá se přeskočit vizitka.
 */

type Step = 1 | 2 | 3 | 'done'

/**
 * Role nabízené v průvodci. `superadmin` tu není a nikdy nesmí být —
 * to je role provozovatele platformy, ne organizace. `spolupracovnik`
 * ano: hledačky, lektorky, asistentky, účetní, řidiči a IT jsou přesně
 * ti, co mají mít vlastní přihlášení a vidět jen to svoje.
 */
const WIZARD_ROLES: StaffRole[] = [
  'vedouci_pobocky',
  'teamleader',
  'klicova_osoba',
  'asistent_ko',
  'zamestnanec',
  'spolupracovnik',
]

const ROLE_HINTS: Partial<Record<StaffRole, string>> = {
  vedouci_pobocky: 'Vidí spisy podřízených, needituje.',
  teamleader: 'Vede tým klíčových osob, vidí jejich spisy.',
  klicova_osoba: 'Doprovází rodiny, píše zápisy — hlavní pracovní role.',
  asistent_ko: 'Pomáhá klíčové osobě, užší rozsah.',
  zamestnanec: 'Provozní role bez přiřazených rodin — účetní, IT, administrativa.',
  spolupracovnik: 'Externí — lektorka, hledačka, řidič. Vidí JEN to, co mu výslovně přiřadíte.',
}

interface TeamRow {
  displayName: string
  email: string
  password: string
  role: StaffRole
}

function emptyRow(): TeamRow {
  return { displayName: '', email: '', password: '', role: 'klicova_osoba' }
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Krok 1
  const [orgName, setOrgName] = useState('')
  const [ico, setIco] = useState('')
  const [address, setAddress] = useState('')
  const [region, setRegion] = useState<Region | ''>('')
  const [website, setWebsite] = useState('')
  const [orgPhone, setOrgPhone] = useState('')
  const [orgEmail, setOrgEmail] = useState('')

  // Krok 2
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [password, setPassword] = useState('')

  // Krok 3
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [orgCodeAssigned, setOrgCodeAssigned] = useState<string | null>(null)
  const [rows, setRows] = useState<TeamRow[]>([emptyRow()])
  const [created, setCreated] = useState<string[]>([])

  const step1Valid = orgName.trim() && (orgPhone.trim() || orgEmail.trim())

  /**
   * Kroky 1+2 najednou: Auth účet → organizace → profil → vizitka.
   *
   * SEAM (beze změny proti dřívějšku): atomické to není, Cloud Function
   * neexistuje. Vizitka je poslední schválně — když selže, organizace
   * funguje a vizitka se doplní v nastavení. Kdyby byla první, selhání
   * by nechalo vizitku bez organizace.
   */
  async function handleCreateOrg(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const emailCheck = checkEmail(email)
    setEmail(emailCheck.value)
    setEmailError(emailCheck.ok ? null : (emailCheck.message ?? null))
    if (!emailCheck.ok) return

    setSubmitting(true)
    try {
      const credential = await createUserWithEmailAndPassword(auth, emailCheck.value, password)
      const orgCode = await allocateOrgCode()

      const orgData: OrganizationDoc = {
        orgCode,
        name: orgName.trim(),
        createdByUid: credential.user.uid,
        createdAt: new Date().toISOString(),
      }
      const orgRef = await addDoc(collection(db, 'organizations'), orgData)

      const userData: UserDoc = {
        uid: credential.user.uid,
        role: 'org_admin',
        displayName: displayName.trim(),
        email: emailCheck.value,
        organizationId: orgRef.id,
        createdAt: new Date().toISOString(),
      }
      await setDoc(doc(db, 'users', credential.user.uid), userData)

      await saveOrgCard({
        organizationId: orgRef.id,
        name: orgName.trim(),
        contactPersonName: displayName.trim(),
        phone: orgPhone,
        email: orgEmail || emailCheck.value,
        address,
        region,
        website,
        ico,
        updatedByUid: credential.user.uid,
      })

      setOrganizationId(orgRef.id)
      setOrgCodeAssigned(orgCode)
      setStep(3)
    } catch {
      setError('Registrace se nezdařila. Zkontrolujte údaje a zkuste to znovu.')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Tým se zakládá PO ŘÁDCÍCH, ne najednou. Když jeden e-mail existuje
   * nebo je heslo krátké, nesmí to shodit ostatní — kdo vyplnil pět lidí,
   * nemá je psát znovu kvůli jednomu.
   */
  async function handleCreateTeam() {
    if (!organizationId) return
    setSubmitting(true)
    setError(null)
    const done: string[] = []
    const failed: string[] = []

    for (const row of rows) {
      if (!row.email.trim() || !row.displayName.trim() || !row.password) continue
      try {
        await createStaffMember({
          email: row.email.trim(),
          password: row.password,
          displayName: row.displayName.trim(),
          role: row.role,
          organizationId,
        })
        done.push(`${row.displayName} — ${STAFF_ROLE_LABELS[row.role]}`)
      } catch {
        failed.push(row.email.trim())
      }
    }

    setCreated((prev) => [...prev, ...done])
    setRows(failed.length ? rows.filter((r) => failed.includes(r.email.trim())) : [emptyRow()])
    if (failed.length) {
      setError(
        `Nepodařilo se založit: ${failed.join(', ')}. Bývá to už použitým e-mailem nebo krátkým heslem. ` +
          'Ostatní jsou hotoví, zůstaly tu jen tyhle řádky.',
      )
    }
    setSubmitting(false)
  }

  function updateRow(index: number, patch: Partial<TeamRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-app px-4 py-10">
      <div className="w-full max-w-[560px] rounded-lg border border-border bg-surface p-6 shadow-raised">
        <h1 className="mb-1 text-2xl text-text-primary">Registrace organizace</h1>
        <p className="mb-1 text-sm text-text-secondary">
          {step === 1 && 'Krok 1 ze 3 — organizace a kontakt'}
          {step === 2 && 'Krok 2 ze 3 — správce organizace'}
          {step === 3 && 'Krok 3 ze 3 — tým'}
        </p>
        {orgCodeAssigned && (
          <p className="mb-4 text-sm text-text-tertiary">
            Přidělený kód organizace: <strong className="text-text-primary">{orgCodeAssigned}</strong> — je
            natrvalo součástí všech vašich UID.
          </p>
        )}

        {error && (
          <p className="mb-4 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {/* ── Krok 1 ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-tertiary">
              Tyhle údaje uvidí i ostatní organizace. Slouží k tomu, aby se s vámi daly domluvit,
              když bude pěstoun přecházet od vás nebo k vám — bez kontaktu se předání zastaví.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Název organizace</span>
              <Input required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">IČO</span>
                <Input value={ico} onChange={(e) => setIco(e.target.value)} placeholder="12345678" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Kraj</span>
                <Select value={region} onChange={(e) => setRegion(e.target.value as Region | '')}>
                  <option value="">— vyberte —</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Adresa</span>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Telefon</span>
                <Input value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Veřejný e-mail</span>
                <Input type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Web</span>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </label>

            {!step1Valid && (
              <p className="text-xs text-text-tertiary">
                Potřebuju název a aspoň telefon nebo e-mail — jinak na vás nikdo nedosáhne.
              </p>
            )}

            <Button onClick={() => setStep(2)} disabled={!step1Valid}>
              Pokračovat
            </Button>
          </div>
        )}

        {/* ── Krok 2 ─────────────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleCreateOrg} className="flex flex-col gap-4">
            <p className="text-sm text-text-tertiary">
              Správce organizace zakládá zaměstnance, mění jim role a spravuje nastavení. Můžete to
              být vy — účet jde později předat někomu jinému.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Vaše jméno</span>
              <Input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">E-mail (přihlašovací)</span>
              <Input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailError(null)
                }}
                onBlur={() => {
                  const result = checkEmail(email)
                  setEmail(result.value)
                  setEmailError(result.ok ? null : (result.message ?? null))
                }}
              />
              {emailError && <span className="text-xs text-danger">{emailError}</span>}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Heslo</span>
              <Input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                Zpět
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Zakládám…' : 'Založit organizaci'}
              </Button>
            </div>
          </form>
        )}

        {/* ── Krok 3 ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-tertiary">
              Organizace je založená. Teď můžete přidat kolegy — každý dostane vlastní přihlášení
              a rozsah podle role. Nespěchá to, dá se to kdykoli doplnit v Zaměstnancích.
            </p>

            {created.length > 0 && (
              <div className="rounded-md shadow-border p-3">
                <p className="text-sm text-text-primary">Založeno ({created.length}):</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {created.map((c) => (
                    <li key={c} className="text-sm text-text-secondary">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rows.map((row, i) => (
              <div key={i} className="flex flex-col gap-3 border-b border-border-subtle pb-4 last:border-0">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Jméno a příjmení"
                    value={row.displayName}
                    onChange={(e) => updateRow(i, { displayName: e.target.value })}
                  />
                  <Input
                    type="email"
                    placeholder="E-mail"
                    value={row.email}
                    onChange={(e) => updateRow(i, { email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="password"
                    placeholder="Počáteční heslo"
                    value={row.password}
                    onChange={(e) => updateRow(i, { password: e.target.value })}
                  />
                  <Select
                    value={row.role}
                    onChange={(e) => updateRow(i, { role: e.target.value as StaffRole })}
                  >
                    {WIZARD_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {STAFF_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </div>
                {ROLE_HINTS[row.role] && (
                  <p className="text-xs text-text-tertiary">{ROLE_HINTS[row.role]}</p>
                )}
              </div>
            ))}

            <Button type="button" variant="ghost" onClick={() => setRows((p) => [...p, emptyRow()])}>
              + Další člověk
            </Button>

            <div className="flex gap-3">
              <Button type="button" onClick={handleCreateTeam} disabled={submitting}>
                {submitting ? 'Zakládám…' : 'Založit uvedené'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate('/', { replace: true })}>
                Hotovo, do aplikace
              </Button>
            </div>
          </div>
        )}

        {step !== 3 && (
          <p className="mt-6 text-sm text-text-secondary">
            Už máte účet?{' '}
            <Link to="/login" className="text-accent hover:underline">
              Přihlásit se
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
