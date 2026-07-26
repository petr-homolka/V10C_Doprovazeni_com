import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { PageHead } from '@/components/spis/PageBody'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { auditActor } from '@/services/auditLogService'
import { isValidUid, normalizeUidInput } from '@/lib/uid'
import { LookupBlockedError, lookupUidHolder } from '@/services/uidHolderCardService'
import { describeHolder, type UidHolderCardDoc } from '@/types/uidHolderCard'
import { readTitle } from '@/services/titleRegistryService'
import { readOrgCard } from '@/services/orgDirectoryService'
import { planTakeoverContact, type TakeoverGuidance } from '@/lib/takeoverFlow'
import { createFosterProspect } from '@/services/fosterProspectService'
import type { FosterProspectExistingStatus } from '@/types/fosterProspect'

/**
 * /zajemci/novy — PRŮVODCE ZAŘAZENÍM ZÁJEMCE.
 *
 *   1. Má zájemce UID? → ano / ne / nevím
 *   2. Když ano: UID + PŘÍJMENÍ. Systém najde držitele a ukáže jméno,
 *      obec a organizaci s kontaktem.
 *   3. Telefonát — mimo systém. Stará organizace pěstouna buď potvrdí
 *      jako svého, nebo ho jedním kliknutím uvolní.
 *   4. Průvodce KONČÍ ZALOŽENÝM ZÁJEMCEM. Když je UID obsazené, zájemce
 *      vznikne taky — jen s poznámkou, že Dohodu s ním zatím nelze uzavřít.
 *
 * ─── PROČ SE PTÁ I NA PŘÍJMENÍ ────────────────────────────────────────
 *
 * Ne kvůli formuláři. Ověřovací karta je uložená pod otiskem UID
 * A PŘÍJMENÍ dohromady (`lib/personMatch.ts`), takže bez příjmení ji
 * nejde ani adresovat. Hádání samotných UID je tím k ničemu. Pracovníka
 * to nezdrží — člověk, kterého zavádí, mu sedí naproti.
 *
 * ─── PROČ PRŮVODCE NEROZHODUJE SÁM ────────────────────────────────────
 *
 * Rozdíl mezi „je to pořád náš klient" a „zapomněli jsme ho uvolnit"
 * v datech není. Průvodce tedy nezakazuje pokračovat — jen ODDĚLÍ dvě
 * věci, které se dřív pletly: zavést si člověka do pipeline (smí se
 * vždycky) a uzavřít s ním Dohodu (nesmí, dokud ho starý nepustí).
 */

type Step = 'uid-otazka' | 'uid-zadani' | 'vysledek' | 'udaje' | 'hotovo'

export default function ProspectWizardPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [step, setStep] = useState<Step>('uid-otazka')
  const [error, setError] = useState<string | null>(null)

  const [uidInput, setUidInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [holder, setHolder] = useState<UidHolderCardDoc | null>(null)
  const [guidance, setGuidance] = useState<TakeoverGuidance | null>(null)
  /** `true` = uživatel prošel větví s UID; ovlivňuje výchozí stav zájemce. */
  const [hadUid, setHadUid] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [createdName, setCreatedName] = useState('')

  const blocked = guidance ? !guidance.canSign : false

  async function handleUidCheck() {
    if (!organizationId || !userDoc) return
    const uid = normalizeUidInput(uidInput)
    setUidInput(uid)
    setError(null)

    if (!isValidUid(uid)) {
      setError(
        'Tohle není platné UID. Zkontrolujte opis — poslední číslice je kontrolní, takže překlep ' +
          'v kterémkoli místě se pozná.',
      )
      return
    }
    if (!lastName.trim()) {
      setError('Doplňte prosím příjmení. Bez něj se záznam nedá dohledat.')
      return
    }

    setChecking(true)
    try {
      const card = await lookupUidHolder(uid, lastName, { actor: auditActor(userDoc), organizationId })
      setHolder(card)
      if (card?.firstName && !firstName) setFirstName(card.firstName)

      const entry = await readTitle(uid)
      const orgCard = entry?.holderOrgId ? await readOrgCard(entry.holderOrgId) : null
      setGuidance(planTakeoverContact(entry, orgCard))
      setStep('vysledek')
    } catch (err) {
      setError(
        err instanceof LookupBlockedError ? err.message : 'Ověření se nepodařilo. Zkuste to prosím znovu.',
      )
    } finally {
      setChecking(false)
    }
  }

  /**
   * ZALOŽENÍ ZÁJEMCE — konec průvodce, ne odkaz jinam.
   *
   * `existingFosterStatus` se dopočítá z toho, co průvodce zjistil, ne
   * z toho, co člověk naklikal. Když UID drží jiná organizace, je to
   * `jiz_pestoun_jinde` a nikdo to nemá jak omylem přepsat.
   */
  async function handleCreate() {
    if (!organizationId) return
    setSaving(true)
    setError(null)

    const existingFosterStatus: FosterProspectExistingStatus = blocked
      ? 'jiz_pestoun_jinde'
      : hadUid
        ? 'jiz_pestoun_bez_do'
        : 'neznamo'

    const name = `${firstName.trim()} ${lastName.trim()}`.trim()
    try {
      await createFosterProspect({
        organizationId,
        name,
        contactPhone: phone.trim() || undefined,
        contactEmail: email.trim() || undefined,
        source: source.trim() || undefined,
        existingFosterStatus,
        assignedTo: userDoc?.uid ?? null,
        lastContactAt: new Date().toISOString(),
      })
      setCreatedName(name)
      setStep('hotovo')
    } catch {
      setError('Zájemce se nepodařilo založit. Zkuste to prosím znovu.')
    } finally {
      setSaving(false)
    }
  }

  if (!organizationId) {
    return (
      <AppShell>
        <PageHead title="Nový zájemce" />
        <section className="sp__card sp__card--pad">
          <p className="text-sm text-text-secondary">Tahle stránka je pro zaměstnance organizace.</p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHead
        title="Nový zájemce"
        description="Než člověka zavedeme, podíváme se, jestli ho už někdo v systému nevede."
      >
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </PageHead>

      {/* ── 1. Má UID? ───────────────────────────────────────────── */}
      {step === 'uid-otazka' && (
        <section className="sp__card sp__card--pad">
          <h2 className="text-base text-text-primary">Má už zájemce přidělené UID?</h2>
          <p className="mt-1 text-sm text-text-tertiary">
            UID dostal, pokud ho někdy vedla jakákoli organizace v tomhle systému. Najde ho na svých
            dokumentech nebo mu ho řekne jeho dosavadní organizace.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setHadUid(true)
                setStep('uid-zadani')
              }}
            >
              Ano, UID mám
            </Button>
            <Button variant="ghost" onClick={() => setStep('udaje')}>
              Ne, je to úplně nový zájemce
            </Button>
            <Button variant="ghost" onClick={() => setStep('udaje')}>
              Nevím
            </Button>
          </div>
        </section>
      )}

      {/* ── 2. UID + příjmení ────────────────────────────────────── */}
      {step === 'uid-zadani' && (
        <section className="sp__card sp__card--pad">
          <h2 className="text-base text-text-primary">Zadejte UID a příjmení</h2>
          <p className="mt-1 text-sm text-text-tertiary">
            Obojí — záznam je vedený pod kombinací obou údajů, aby se nedal dohledat pouhým zkoušením
            čísel.
          </p>

          <div className="sp__group mt-4">
            <label className="sp__grouplabel" htmlFor="uid">
              UID
            </label>
            <Input
              id="uid"
              value={uidInput}
              onChange={(e) => {
                setUidInput(e.target.value)
                setError(null)
              }}
              placeholder="1000410000013"
              inputMode="numeric"
            />
            <p className="mt-1 text-xs text-text-faint">Mezery a pomlčky nevadí, srovnám si to.</p>
          </div>

          <div className="sp__group">
            <label className="sp__grouplabel" htmlFor="prijmeni-uid">
              Příjmení zájemce
            </label>
            <Input
              id="prijmeni-uid"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                setError(null)
              }}
            />
          </div>

          <div className="mt-4 flex gap-3">
            <Button onClick={handleUidCheck} disabled={checking || !uidInput.trim() || !lastName.trim()}>
              {checking ? 'Ověřuji…' : 'Ověřit'}
            </Button>
            <Button variant="ghost" onClick={() => setStep('uid-otazka')}>
              Zpět
            </Button>
          </div>
        </section>
      )}

      {/* ── 3. Výsledek ──────────────────────────────────────────── */}
      {step === 'vysledek' && guidance && (
        <>
          <section className="sp__card sp__card--pad">
            <h2 className="text-base text-text-primary">
              {holder ? 'Tohle UID v systému máme' : 'Pod tímhle UID a příjmením nikoho nevedeme'}
            </h2>

            {holder && (
              <div className="sp__group mt-3">
                <span className="sp__grouplabel">Držitel UID</span>
                <p className="text-base text-text-primary">{describeHolder(holder)}</p>
                <p className="mt-1 text-xs text-text-faint">
                  Ověřte, že to sedí s člověkem, se kterým jednáte.
                </p>
              </div>
            )}

            <p
              className={
                guidance.canSign
                  ? 'mt-3 text-sm text-text-primary'
                  : 'mt-3 border-l-2 border-l-accent pl-3 text-sm text-text-primary'
              }
            >
              {guidance.message}
            </p>

            {guidance.contact && (
              <div className="sp__group mt-4">
                <span className="sp__grouplabel">Spojte se s nimi</span>
                <p className="text-base text-text-primary">{guidance.contact.name}</p>
                {guidance.contact.contactPersonName && (
                  <p className="text-sm text-text-secondary">{guidance.contact.contactPersonName}</p>
                )}
                {guidance.contact.phone && (
                  <p className="text-sm">
                    <a className="text-accent hover:underline" href={`tel:${guidance.contact.phone}`}>
                      {guidance.contact.phone}
                    </a>
                  </p>
                )}
                {guidance.contact.email && (
                  <p className="text-sm">
                    <a className="text-accent hover:underline" href={`mailto:${guidance.contact.email}`}>
                      {guidance.contact.email}
                    </a>
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="sp__card sp__card--pad">
            <h2 className="text-base text-text-primary">Jak dál</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {guidance.canSign
                ? 'Nic vás nebrzdí — zájemce jde zavést a rovnou s ním uzavřít Dohodu.'
                : 'Zavolejte druhé organizaci. Když vám pěstouna uvolní, Dohodu půjde uzavřít hned. ' +
                  'Zájemce si ale můžete zavést už teď — bude vidět v pipeline.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => setStep('udaje')}>Pokračovat k údajům</Button>
              <Button variant="ghost" onClick={() => navigate('/zajemci')}>
                Nepokračovat
              </Button>
            </div>
          </section>
        </>
      )}

      {/* ── 4. Údaje a založení ──────────────────────────────────── */}
      {step === 'udaje' && (
        <section className="sp__card sp__card--pad">
          <h2 className="text-base text-text-primary">Údaje zájemce</h2>
          {blocked && (
            <p className="mt-2 border-l-2 border-l-accent pl-3 text-sm text-text-primary">
              Zavádíte člověka, kterého vede jiná organizace. Zájemce z něj bude, ale Dohodu s ním
              nepůjde uzavřít, dokud vám ho neuvolní. Zapíše se to k němu jako „již pěstoun jinde".
            </p>
          )}

          <div className="sp__group mt-4">
            <label className="sp__grouplabel" htmlFor="jmeno">
              Jméno
            </label>
            <Input id="jmeno" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="sp__group">
            <label className="sp__grouplabel" htmlFor="prijmeni">
              Příjmení
            </label>
            <Input id="prijmeni" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="sp__group">
            <label className="sp__grouplabel" htmlFor="tel">
              Telefon
            </label>
            <Input id="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="sp__group">
            <label className="sp__grouplabel" htmlFor="mail">
              E-mail
            </label>
            <Input id="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="sp__group">
            <label className="sp__grouplabel" htmlFor="zdroj">
              Odkud o nás ví
            </label>
            <Input id="zdroj" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>

          <div className="mt-4 flex gap-3">
            <Button onClick={handleCreate} disabled={saving || !firstName.trim() || !lastName.trim()}>
              {saving ? 'Zakládám…' : 'Založit zájemce'}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/zajemci')}>
              Zrušit
            </Button>
          </div>
        </section>
      )}

      {/* ── 5. Hotovo ────────────────────────────────────────────── */}
      {step === 'hotovo' && (
        <section className="sp__card sp__card--pad">
          <h2 className="text-base text-text-primary">Zájemce {createdName} je zavedený</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {blocked
              ? 'Je vedený jako „již pěstoun jinde". Až vám ho druhá organizace uvolní, půjde s ním ' +
                'uzavřít Dohodu — vraťte se sem nebo pokračujte přímo ze seznamu zájemců.'
              : 'Můžete s ním rovnou pokračovat k Dohodě.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/zajemci')}>Na seznam zájemců</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep('uid-otazka')
                setUidInput('')
                setHolder(null)
                setGuidance(null)
                setHadUid(false)
                setFirstName('')
                setLastName('')
                setPhone('')
                setEmail('')
                setSource('')
                setError(null)
              }}
            >
              Zavést dalšího
            </Button>
          </div>
        </section>
      )}
    </AppShell>
  )
}
