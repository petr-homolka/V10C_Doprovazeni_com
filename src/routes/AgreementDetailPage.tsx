import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { PageHead } from '@/components/spis/PageBody'
import { SpisSection } from '@/components/spis/SpisSection'
import { auditActor } from '@/services/auditLogService'
import { TitleConflictError, releaseFosterParent } from '@/services/titleRegistryService'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Select } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { EmptyState } from '@/components/ui/empty-state'
import { DangerZone } from '@/components/ui/danger-zone'
import { IppdSection } from '@/components/family/IppdSection'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { getOrganization, getPlatformDefaults } from '@/services/organizationService'
import { computeEffectiveAgreementDurationMonths, addMonthsToDateValue } from '@/lib/agreementDuration'
import { DEFAULT_PLATFORM_AGREEMENT_DURATION_MONTHS } from '@/types/platformDefaults'
import { listStaff } from '@/services/staffService'
import { getFamilyByUid, listChildrenForFamily, listFosterPersonsByRefs } from '@/services/familyService'
import { RETENTION_CHILD_CARE_YEARS } from '@/lib/retentionPolicy'
import {
  archiveSegment,
  unarchiveSegment,
  cancelPendingAgreementEnd,
  checkKoCapacity,
  createAgreement,
  getActiveAgreement,
  scheduleAgreementEnd,
} from '@/services/agreementService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { AgreementDoc, CareType } from '@/types/agreement'
import type { UserDoc } from '@/types/user'
import { FileText, Plus } from '@/components/ui/icons'

const CARE_TYPE_LABELS: Record<CareType, string> = {
  zprostredkovana: 'Zprostředkovaná (24 h/12 měsíců)',
  nezprostredkovana: 'Nezprostředkovaná — příbuzenská (18 h/12 měsíců)',
}

function tomorrowIsoDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * /rodiny/:familyUid/dohoda — UX zpětná vazba 2026-07-20 (§4). Dohoda má
 * VLASTNÍ profil, oddělený od rodiny. "Ukončení Dohody" je VLASTNÍ
 * položka druhé úrovně menu (druhé kolo zpětné vazby, ne hned vedle
 * nadpisu Přehledu) — Dohoda se navíc nikdy neukončuje OKAMŽITĚ, jen se
 * naplánuje k budoucímu datu, do kterého jde ukončení kdykoli zrušit
 * (viz `agreementService.getActiveAgreement`/`scheduleAgreementEnd`
 * komentáře pro líný přechod bez cronu).
 */
export default function AgreementDetailPage() {
  const { familyUid } = useParams<{ familyUid: string }>()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [docId, setDocId] = useState<string | null>(null)
  const [family, setFamily] = useState<FamilyDoc | null>(null)
  const [fosterPersons, setFosterPersons] = useState<Array<{ docId: string; fosterPerson: FosterPersonDoc }>>([])
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [agreement, setAgreement] = useState<AgreementDoc | null>(null)
  const [koOptions, setKoOptions] = useState<UserDoc[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)


  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [careType, setCareType] = useState<CareType>('zprostredkovana')
  const [assignedTo, setAssignedTo] = useState('')
  const [capacityNote, setCapacityNote] = useState<string | null>(null)
  const { loading: submitting, success, run } = useAsyncSubmit()

  const todayIsoDate = new Date().toISOString().slice(0, 10)
  const [validFrom, setValidFrom] = useState(todayIsoDate)
  const [validTo, setValidTo] = useState('')
  const [validToTouched, setValidToTouched] = useState(false)
  const [durationMonths, setDurationMonths] = useState(DEFAULT_PLATFORM_AGREEMENT_DURATION_MONTHS)

  const [releasing, setReleasing] = useState<string | null>(null)
  const [releasedUids, setReleasedUids] = useState<string[]>([])

  const [endDateDraft, setEndDateDraft] = useState('')
  const { loading: endSubmitting, success: endSuccess, run: runEnd } = useAsyncSubmit()

  const primaryFosterName = fosterPersons[0]
    ? `${fosterPersons[0].fosterPerson.firstName} ${fosterPersons[0].fosterPerson.lastName}`
    : null
  const familyName = family ? resolveFamilyDisplayName(family, primaryFosterName) : ''

  async function reload() {
    if (!familyUid || !organizationId) return
    setError(null)
    try {
      const found = await getFamilyByUid(familyUid, organizationId)
      if (!found) {
        setNotFound(true)
        return
      }
      setDocId(found.docId)
      setFamily(found.family)
      const [fosters, kids, activeAgreement, staff] = await Promise.all([
        listFosterPersonsByRefs(found.family.fosterPersonRefs),
        listChildrenForFamily(found.docId, organizationId),
        getActiveAgreement(found.docId, organizationId),
        listStaff(organizationId),
      ])
      setFosterPersons(fosters)
      setChildren(kids)
      setAgreement(activeAgreement)
      setKoOptions(staff.filter((s) => s.role === 'klicova_osoba'))
    } catch {
      setError('Dohodu se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyUid, organizationId])

  async function handleAssignedToChange(uid: string) {
    setAssignedTo(uid)
    setCapacityNote(null)
    if (!uid || !organizationId) return
    const capacity = await checkKoCapacity(organizationId, uid)
    if (capacity.overThreshold) {
      setCapacityNote(
        `Pozor: tahle klíčová osoba už má ${capacity.activeCaseload} aktivních rodin (orientační práh je ${capacity.threshold}) — zvažte přerozdělení.`,
      )
    }
  }

  async function openAgreementForm() {
    setShowAgreementForm(true)
    setValidFrom(todayIsoDate)
    setValidToTouched(false)
    if (!organizationId) return
    const [org, platformDefaults] = await Promise.all([getOrganization(organizationId), getPlatformDefaults()])
    const months = computeEffectiveAgreementDurationMonths(
      org?.agreementDefaultDurationMonths,
      platformDefaults?.agreementDefaultDurationMonths ?? DEFAULT_PLATFORM_AGREEMENT_DURATION_MONTHS,
    )
    setDurationMonths(months)
    setValidTo(addMonthsToDateValue(todayIsoDate, months))
  }

  function handleValidFromChange(next: string) {
    setValidFrom(next)
    // §47b zákona 359/1999 Sb. — appka jen NABÍZÍ odhad, dokud KO/vedení
    // sama neupraví "Platí do" — pak už predikci dál nepřepisujeme, i
    // když se "Platí od" ještě jednou změní (respektuje ruční volbu).
    if (!validToTouched) setValidTo(addMonthsToDateValue(next, durationMonths))
  }

  async function handleArchive(archive: boolean) {
    if (!docId || !organizationId || !userDoc) return
    setError(null)
    const audit = { actor: auditActor(userDoc), familyLabel: familyName || `Spis ${familyUid ?? ''}` }
    try {
      if (archive) await archiveSegment(docId, organizationId, audit)
      else await unarchiveSegment(docId, organizationId, audit)
      setAgreement(await getActiveAgreement(docId, organizationId))
    } catch {
      setError(archive ? 'Archivaci se nepodařilo provést.' : 'Vrácení z archivu se nezdařilo.')
    }
  }

  async function handleRelease(fosterUid: string, fosterLabel: string) {
    if (!organizationId || !userDoc) return
    setError(null)
    setReleasing(fosterUid)
    try {
      await releaseFosterParent(fosterUid, organizationId, { actor: auditActor(userDoc), fosterLabel })
      setReleasedUids((prev) => [...prev, fosterUid])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uvolnění se nezdařilo.')
    } finally {
      setReleasing(null)
    }
  }

  async function handleCreateAgreement(e: FormEvent) {
    e.preventDefault()
    if (!docId || !organizationId) return
    setError(null)
    try {
      await run(async () => {
        const org = await getOrganization(organizationId)
        if (!org) throw new Error('org not found')
        await createAgreement({
          familyDocId: docId,
          organizationId,
          careType,
          assignedTo: assignedTo || undefined,
          validFrom: new Date(validFrom).toISOString(),
          validTo: validTo ? new Date(validTo).toISOString() : null,
          audit: userDoc
            ? { actor: auditActor(userDoc), familyLabel: familyName || `Spis ${familyUid ?? ''}` }
            : null,
        })
        await reload()
      })
      setShowAgreementForm(false)
      setCapacityNote(null)
    } catch (err) {
      // Konflikt právního titulu se MUSÍ vypsat celý. Je to blokace ze
      // zákona, ne technická chyba — kdo ji dostane, potřebuje vědět proč
      // a co s tím, jinak to bude zkoušet znovu a bude si myslet, že je
      // rozbitá appka.
      setError(
        err instanceof TitleConflictError
          ? err.message
          : 'Založení Dohody se nezdařilo.',
      )
    }
  }

  async function handleScheduleEnd() {
    if (!docId || !organizationId || !endDateDraft) return
    setError(null)
    try {
      await runEnd(async () => {
        await scheduleAgreementEnd(docId, organizationId, new Date(endDateDraft).toISOString())
        await reload()
      })
      setEndDateDraft('')
    } catch {
      setError('Naplánování ukončení se nezdařilo.')
    }
  }

  async function handleCancelPendingEnd() {
    if (!docId || !organizationId) return
    setError(null)
    try {
      await runEnd(async () => {
        await cancelPendingAgreementEnd(docId, organizationId)
        await reload()
      })
    } catch {
      setError('Zrušení naplánovaného ukončení se nezdařilo.')
    }
  }

  if (notFound) {
    return (
      <AppShell>
        <PageHead title="Dohoda" />
        <section className="sp__card sp__card--pad">
          <p className="text-sm text-text-secondary">Tenhle Spis se nepodařilo najít.</p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell
    >
      {/* Jméno rodiny nesly dřív drobečky. Kontext se nemá zahodit, jen
          přesunout tam, kde ho člověk čte — pod nadpis. */}
      <PageHead title="Dohoda" description={familyName || undefined}>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </PageHead>

      <SpisSection id="prehled" title="Přehled" description="Co Dohoda určuje: typ péče, klíčovou osobu a lhůty." padded>
        <div className="flex flex-col gap-6">
          {agreement ? (
            <div>
              <p className="text-sm text-text-primary">{CARE_TYPE_LABELS[agreement.careType]}</p>
              <p className="mt-1 text-sm text-text-secondary">
                Platí od {new Date(agreement.validFrom).toLocaleDateString('cs-CZ')}
                {agreement.assignedTo &&
                  ` · klíčová osoba: ${koOptions.find((k) => k.uid === agreement.assignedTo)?.displayName ?? agreement.assignedTo}`}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Návštěva min. 1× za {agreement.visitIntervalDays} dní · vzdělávání{' '}
                {agreement.educationHoursTarget} h/12 měsíců · zápis do {agreement.noteDeadlineHours} h
              </p>
              {agreement.pendingEndDate && (
                <p className="mt-2 text-sm text-warning">
                  Naplánováno k ukončení dne {new Date(agreement.pendingEndDate).toLocaleDateString('cs-CZ')} —
                  viz záložka „Ukončení Dohody“.
                </p>
              )}
            </div>
          ) : (
            <>
              {!showAgreementForm && (
                <div className="flex flex-col items-center gap-3">
                  <EmptyState icon={FileText} text="Zatím žádná Dohoda s vaší organizací." />
                  <Button variant="secondary" size="sm" onClick={openAgreementForm}>
                    <Plus size={16} /> Založit Dohodu
                  </Button>
                </div>
              )}
              {showAgreementForm && (
                <form
                  onSubmit={handleCreateAgreement}
                  className="flex max-w-[560px] flex-col gap-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium leading-relaxed text-text-primary">Typ péče</span>
                      <Select value={careType} onChange={(e) => setCareType(e.target.value as CareType)}>
                        {(Object.keys(CARE_TYPE_LABELS) as CareType[]).map((ct) => (
                          <option key={ct} value={ct}>
                            {CARE_TYPE_LABELS[ct]}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium leading-relaxed text-text-primary">Klíčová osoba</span>
                      <Combobox
                        value={assignedTo}
                        onChange={handleAssignedToChange}
                        placeholder="Nepřiřazeno"
                        options={[
                          { value: '', label: 'Nepřiřazeno' },
                          ...koOptions.map((ko) => ({ value: ko.uid, label: ko.displayName })),
                        ]}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium leading-relaxed text-text-primary">Platí od</span>
                      <DatePicker value={validFrom} onChange={handleValidFromChange} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium leading-relaxed text-text-primary">
                        Platí do <span className="font-normal text-text-tertiary">(odhad, uprav dle potřeby)</span>
                      </span>
                      <DatePicker
                        value={validTo}
                        onChange={(v) => {
                          setValidTo(v)
                          setValidToTouched(true)
                        }}
                        min={validFrom}
                      />
                    </label>
                  </div>
                  {capacityNote && <p className="text-sm text-warning">{capacityNote}</p>}
                  <div className="flex gap-2">
                    <Button type="submit" loading={submitting} success={success} className="w-fit">
                      Založit Dohodu
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAgreementForm(false)}
                      disabled={submitting}
                    >
                      Zrušit
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </SpisSection>

      {docId && organizationId && userDoc && (
        <SpisSection id="ippd" title="IPPD" description="Individuální plán průběhu doprovázení." lazy padded>
          <IppdSection
            familyDocId={docId}
            organizationId={organizationId}
            currentUid={userDoc.uid}
            fosterPersons={fosterPersons}
            children={children}
          />
        </SpisSection>
      )}

      <SpisSection
        id="ukonceni"
        title="Ukončení Dohody"
        description="Dohoda se nikdy neukončuje okamžitě — jen se naplánuje k budoucímu datu."
        padded
      >
        <div className="max-w-[560px]">
          {!agreement ? (
            <p className="text-sm text-text-secondary">Nejdřív založte Dohodu v sekci Přehled.</p>
          ) : agreement.pendingEndDate ? (
            <div className="sp__sub border-warning">
              <p className="text-sm text-text-primary">
                Dohoda je naplánovaná k ukončení dne {new Date(agreement.pendingEndDate).toLocaleDateString('cs-CZ')}.
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Do tohoto data lze naplánované ukončení kdykoli zrušit — Dohoda mezitím dál platí.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={handleCancelPendingEnd}
                loading={endSubmitting}
                success={endSuccess}
              >
                Zrušit ukončení
              </Button>
            </div>
          ) : (
            <DangerZone>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-text-primary">Ukončit Dohodu</p>
                <p className="text-xs text-text-secondary">
                  Dohoda se neukončí okamžitě — vyberte datum v budoucnosti. Do tohoto data půjde naplánované
                  ukončení kdykoli zrušit.
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <DatePicker
                    min={tomorrowIsoDate()}
                    value={endDateDraft}
                    onChange={setEndDateDraft}
                    className="w-auto"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleScheduleEnd}
                    disabled={!endDateDraft}
                    loading={endSubmitting}
                    success={endSuccess}
                  >
                    Naplánovat ukončení
                  </Button>
                </div>
              </div>
            </DangerZone>
          )}
        </div>
      </SpisSection>

      {agreement?.status === 'ended' && (
        <SpisSection
          id="archivace"
          title="Archivace"
          description={`Uklidit spis z běžného provozu. Data zůstávají — mažou se až po rozhodnutí vedení, nejdřív po ${RETENTION_CHILD_CARE_YEARS} letech.`}
          padded
        >
          <div className="max-w-[560px]">
            {agreement.archivedAt ? (
              <>
                <p className="text-sm text-text-primary">
                  Spis je v archivu od {new Date(agreement.archivedAt).toLocaleDateString('cs-CZ')}.
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Nezobrazuje se v seznamu rodin ani ve výsledcích hledání. Najdete ho v sekci Archivováno.
                </p>
                <Button className="mt-3" variant="secondary" size="sm" onClick={() => handleArchive(false)}>
                  Vrátit do provozu
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">
                  Archivovaný spis zmizí ze seznamů i z fulltextu — dostanete se k němu jen přes sekci
                  Archivováno. Nic se nemaže a archivaci lze kdykoli vrátit.
                </p>
                {agreement.retentionReviewDueAt && (
                  <p className="mt-1 text-sm text-text-tertiary">
                    Vedení se bude o dalším osudu spisu rozhodovat po{' '}
                    {new Date(agreement.retentionReviewDueAt).toLocaleDateString('cs-CZ')}.
                  </p>
                )}
                <Button className="mt-3" variant="secondary" size="sm" onClick={() => handleArchive(true)}>
                  Archivovat spis
                </Button>
              </>
            )}
          </div>
        </SpisSection>
      )}

      {/*
        UVOLNĚNÍ PĚSTOUNA — to jedno kliknutí, o kterém je celý telefonát.
        Bez něj byla tvrdá blokace zámek bez klíče: jiná organizace nesmí
        podepsat, dokud pěstouna neuvolníme, a uvolnit nešlo z aplikace
        vůbec. První skutečné předání by se zaseklo a muselo se řešit
        zásahem do databáze.

        Sekce je vidět jen u UKONČENÉ Dohody. Uvolnit pěstouna, se kterým
        se ještě pracuje, nedává smysl a byla by to nejrychlejší cesta, jak
        si omylem pustit klienta.
      */}
      {agreement?.status === 'ended' && (
        <SpisSection
          id="uvolneni"
          title="Uvolnění pěstouna"
          description="Potvrzení, že s pěstounem nemáme nic nedořešeného a může uzavřít Dohodu jinde."
          padded
        >
          <div className="max-w-[560px]">
            <p className="text-sm text-text-secondary">
              Dokud pěstouna neuvolníte, žádná jiná organizace s ním nemůže uzavřít Dohodu — uvidí
              jen to, že ho vedete vy, a kontakt na vás. Uvolněte ho, až budou hotové předávací
              protokoly, odhlášení pro OSPOD a vyúčtování.
            </p>
            <p className="mt-1 text-sm text-text-tertiary">
              Zpět to vzít nejde. Pěstoun tím u vás nic neztrácí — spis i historie zůstávají.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              {fosterPersons.map(({ docId, fosterPerson }) => {
                const done = releasedUids.includes(fosterPerson.uid)
                return (
                  <div key={docId} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm text-text-primary">
                      {fosterPerson.firstName} {fosterPerson.lastName}
                      <span className="ml-2 text-xs text-text-faint">{fosterPerson.uid}</span>
                    </span>
                    {done ? (
                      <span className="text-sm text-success">Uvolněn</span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={releasing === fosterPerson.uid}
                        onClick={() => handleRelease(fosterPerson.uid, `${fosterPerson.firstName} ${fosterPerson.lastName}`)}
                      >
                        {releasing === fosterPerson.uid ? 'Uvolňuji…' : 'Uvolnit'}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </SpisSection>
      )}
    </AppShell>
  )
}
