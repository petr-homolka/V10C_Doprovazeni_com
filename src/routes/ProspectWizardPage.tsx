import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { PageHead } from '@/components/spis/PageBody'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { auditActor } from '@/services/auditLogService'
import { isValidUid, normalizeUidInput } from '@/lib/uid'
import { lookupUidHolder } from '@/services/uidHolderCardService'
import { describeHolder, type UidHolderCardDoc } from '@/types/uidHolderCard'
import { readTitle } from '@/services/titleRegistryService'
import { readOrgCard } from '@/services/orgDirectoryService'
import { planTakeoverContact, type TakeoverGuidance } from '@/lib/takeoverFlow'

/**
 * /zajemci/novy — PRŮVODCE ZAŘAZENÍM ZÁJEMCE.
 *
 * Zadání Petr Homolka, 26. 7. Průvodce se hned na začátku ptá na to,
 * na co se dosud neptal nikdo: NEMÁ UŽ TENHLE ČLOVĚK UID?
 *
 *   1. Má zájemce UID? → ano / ne / nevím
 *   2. Když ano: zadá se, systém najde držitele a ukáže jméno, příjmení,
 *      obec a organizaci, která ho vede, včetně kontaktu.
 *   3. Následuje TELEFONÁT — mimo systém. Stará organizace buď potvrdí,
 *      že je to její klient, nebo zjistí, že Dohodu ukončila a zapomněla
 *      uvolnit, a uvolní ho.
 *   4. Podle výsledku: buď se průvodce nedokončí vůbec, nebo se zájemce
 *      založí — ale bez možnosti uzavřít Dohodu, dokud není uvolněný.
 *
 * ─── PROČ SE PRŮVODCE NESNAŽÍ ROZHODNOUT SÁM ──────────────────────────
 *
 * Protože nemůže. Rozdíl mezi „je to pořád náš klient" a „zapomněli jsme
 * ho uvolnit" v datech není. Průvodce tedy nezakazuje pokračovat — jen
 * ODDĚLÍ dvě věci, které se dřív pletly dohromady: zavést si člověka do
 * pipeline (smí se vždycky, nikomu to nevadí) a uzavřít s ním Dohodu
 * (nesmí se, dokud ho stará organizace nepustí).
 */

type Step = 'uid-otazka' | 'uid-zadani' | 'vysledek' | 'udaje'

export default function ProspectWizardPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [step, setStep] = useState<Step>('uid-otazka')
  const [uidInput, setUidInput] = useState('')
  const [uidError, setUidError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const [holder, setHolder] = useState<UidHolderCardDoc | null>(null)
  const [guidance, setGuidance] = useState<TakeoverGuidance | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [note, setNote] = useState('')

  async function handleUidCheck() {
    if (!organizationId || !userDoc) return
    const uid = normalizeUidInput(uidInput)
    setUidInput(uid)

    if (!isValidUid(uid)) {
      setUidError(
        'Tohle není platné UID. Zkontrolujte opis — číslo má 13 míst a poslední číslice je kontrolní, ' +
          'takže překlep v kterémkoli místě se pozná.',
      )
      return
    }

    setUidError(null)
    setChecking(true)
    try {
      const card = await lookupUidHolder(uid, { actor: auditActor(userDoc), organizationId })
      setHolder(card)

      const entry = await readTitle(uid)
      const orgCard = entry?.holderOrgId ? await readOrgCard(entry.holderOrgId) : null
      setGuidance(planTakeoverContact(entry, orgCard))
      setStep('vysledek')
    } catch {
      setUidError('Ověření se nepodařilo. Zkuste to prosím znovu.')
    } finally {
      setChecking(false)
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
      />

      {/* ── 1. Má UID? ───────────────────────────────────────────── */}
      {step === 'uid-otazka' && (
        <section className="sp__card sp__card--pad">
          <h2 className="text-base text-text-primary">Má už zájemce přidělené UID?</h2>
          <p className="mt-1 text-sm text-text-tertiary">
            UID dostal, pokud ho někdy vedla jakákoli organizace v tomhle systému. Najde ho na
            svých dokumentech nebo mu ho řekne jeho dosavadní organizace. Když si nejste jistí,
            zeptejte se ho — číslo si obvykle schovává.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => setStep('uid-zadani')}>Ano, UID mám</Button>
            <Button variant="ghost" onClick={() => setStep('udaje')}>
              Ne, je to úplně nový zájemce
            </Button>
            <Button variant="ghost" onClick={() => setStep('udaje')}>
              Nevím
            </Button>
          </div>
          <p className="mt-3 text-xs text-text-faint">
            „Nevím" pokračuje stejně jako „ne" — systém pak zkusí shodu podle rodného čísla nebo
            jména a adresy, až tyhle údaje zadáte.
          </p>
        </section>
      )}

      {/* ── 2. Zadání UID ────────────────────────────────────────── */}
      {step === 'uid-zadani' && (
        <section className="sp__card sp__card--pad">
          <h2 className="text-base text-text-primary">Zadejte UID zájemce</h2>
          <div className="sp__group mt-4">
            <label className="sp__grouplabel" htmlFor="uid">
              UID (13 míst)
            </label>
            <Input
              id="uid"
              value={uidInput}
              onChange={(e) => {
                setUidInput(e.target.value)
                setUidError(null)
              }}
              placeholder="1000410000013"
              inputMode="numeric"
            />
            <p className="mt-1 text-xs text-text-faint">Mezery a pomlčky nevadí, srovnám si to.</p>
            {uidError && (
              <p className="mt-2 text-sm text-danger" role="alert">
                {uidError}
              </p>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Button onClick={handleUidCheck} disabled={checking || !uidInput.trim()}>
              {checking ? 'Ověřuji…' : 'Ověřit UID'}
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
              {holder ? 'Tohle UID v systému máme' : 'Tohle UID u nás nikdo nevede'}
            </h2>

            {holder && (
              <div className="sp__group mt-3">
                <span className="sp__grouplabel">Držitel UID</span>
                <p className="text-base text-text-primary">{describeHolder(holder)}</p>
                <p className="mt-1 text-xs text-text-faint">
                  Ověřte, že to sedí s člověkem, se kterým jednáte. Když ne, opsali jste špatné číslo.
                </p>
              </div>
            )}

            <p
              className={
                guidance.canSign
                  ? 'mt-3 text-sm text-text-primary'
                  : 'mt-3 text-sm text-text-primary border-l-2 border-l-accent pl-3'
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
                  <p className="text-sm text-text-secondary">
                    <a className="text-accent hover:underline" href={`tel:${guidance.contact.phone}`}>
                      {guidance.contact.phone}
                    </a>
                  </p>
                )}
                {guidance.contact.email && (
                  <p className="text-sm text-text-secondary">
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
            {guidance.canSign ? (
              <p className="mt-1 text-sm text-text-secondary">
                Nic vás nebrzdí — zájemce jde zavést a rovnou s ním uzavřít Dohodu.
              </p>
            ) : (
              <p className="mt-1 text-sm text-text-secondary">
                Zavolejte druhé organizaci. Když vám pěstouna uvolní, Dohodu půjde uzavřít hned —
                stačí se sem vrátit. Do té doby si ho můžete zavést jako zájemce; bude vidět
                v pipeline, ale zařadit ho do správy nepůjde.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => setStep('udaje')}>
                {guidance.canSign ? 'Pokračovat' : 'Zavést jako zájemce'}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/zajemci')}>
                Nepokračovat
              </Button>
            </div>
          </section>
        </>
      )}

      {/* ── 4. Údaje ─────────────────────────────────────────────── */}
      {step === 'udaje' && (
        <section className="sp__card sp__card--pad">
          <h2 className="text-base text-text-primary">Údaje zájemce</h2>
          {guidance && !guidance.canSign && (
            <p className="mt-1 text-sm text-text-primary border-l-2 border-l-accent pl-3">
              Zavádíte člověka, kterého vede jiná organizace. Zájemce z něj bude, ale Dohodu s ním
              nepůjde uzavřít, dokud vám ho neuvolní.
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
            <label className="sp__grouplabel" htmlFor="pozn">
              Poznámka
            </label>
            <Input id="pozn" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <p className="mt-4 text-sm text-text-tertiary">
            Založení zájemce vede přes stávající stránku Zájemci — průvodce zatím řeší tu část,
            kvůli které vznikl: ověření UID a rozhodnutí, jestli se s člověkem vůbec smí podepsat.
          </p>

          <div className="mt-4 flex gap-3">
            <Button onClick={() => navigate('/zajemci')}>Přejít na Zájemce</Button>
            <Button variant="ghost" onClick={() => navigate('/zajemci')}>
              Zrušit
            </Button>
          </div>
        </section>
      )}
    </AppShell>
  )
}
