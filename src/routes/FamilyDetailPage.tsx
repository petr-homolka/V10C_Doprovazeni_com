import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { ProfileSectionNav, type ProfileSection } from '@/components/profile/ProfileSectionNav'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { Switch } from '@/components/ui/switch'
import { VoiceRecorderPanel, type RecordablePerson, type VisitContext } from '@/components/timeline/VoiceRecorderPanel'
import { TimelineEntryDetail } from '@/components/timeline/TimelineEntryDetail'
import { OspodReportSection } from '@/components/family/OspodReportSection'
import { FamilyCareEventsSection } from '@/components/family/FamilyCareEventsSection'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { getOrganization } from '@/services/organizationService'
import { listStaff } from '@/services/staffService'
import { uploadEntityAvatar } from '@/services/avatarService'
import { listTimelineEntries } from '@/services/timelineService'
import {
  addChildToFamily,
  addFosterPersonToFamily,
  getFamilyByUid,
  listChildrenForFamily,
  listFosterPersonsByRefs,
  updateFamilyDisplayName,
  updateFamilyPartnerSharingDefault,
} from '@/services/familyService'
import { getActiveAgreement } from '@/services/agreementService'
import { createDocument, listFamilyDocuments } from '@/services/documentService'
import { DOCUMENT_STATUS_LABELS } from '@/components/documents/documentStatusLabels'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { checkEmail, checkPhone } from '@/lib/contactValidation'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { AgreementDoc, CareType } from '@/types/agreement'
import type { UserDoc } from '@/types/user'
import type { FamilyDocumentDoc } from '@/types/familyDocument'
import type { SubjectRef, TimelineEntryDoc, TimelineEntryKind } from '@/types/timelineEntry'
import { Baby, Clock, FileText, Handshake, Home, Mic, Pencil, Plus, StickyNote, UserRound } from 'lucide-react'

const FOSTER_COLUMNS = '40px 1.4fr 1fr 24px'
const CHILD_COLUMNS = '40px 1fr 24px'
const TIMELINE_TYPE_LABELS: Record<TimelineEntryKind, string> = {
  note: 'Poznámka',
  visit: 'Návštěva',
  voice_entry: 'Hlasový zápis',
  system: 'Systémová událost',
  document: 'Dokument',
}
const TIMELINE_TYPE_ICONS: Record<TimelineEntryKind, typeof Clock> = {
  note: StickyNote,
  visit: Clock,
  voice_entry: Mic,
  system: FileText,
  document: FileText,
}
const NO_ACTIVE_AGREEMENT_REASON = 'Tahle rodina nemá s vaší organizací aktivní Dohodu — zápis by nešlo uložit.'

const CARE_TYPE_LABELS: Record<CareType, string> = {
  zprostredkovana: 'Zprostředkovaná (24 h/12 měsíců)',
  nezprostredkovana: 'Nezprostředkovaná — příbuzenská (18 h/12 měsíců)',
}

const SECTIONS: ProfileSection[] = [
  { key: 'prehled', label: 'Přehled' },
  { key: 'casova-osa', label: 'Časová osa' },
  { key: 'dokumenty', label: 'Dokumenty' },
]

/**
 * /rodiny/:familyUid — HUB (UX zpětná vazba 2026-07-20 přestavěla tuhle
 * stránku ze "všechno na jedné dlouhé stránce" na hub odkazující na
 * samostatné profily Dohody/pěstouna/dítěte, viz `AgreementDetailPage`/
 * `FosterPersonDetailPage`/`ChildDetailPage`). `familyUid` v URL je vždy
 * human-facing `uid` (§4.3 pozn. 1), viz getFamilyByUid.
 *
 * Respit/asistovaný kontakt/předání dítěte (`FamilyCareEventsSection`)
 * ZŮSTÁVÁ tady, ne na profilu dítěte — respit typicky pokrývá víc dětí
 * najednou, nedá se čistě rozdělit na jedno dítě (vědomá volba, dá se
 * přehodnotit, pokud by to tak Petrovi nevyhovovalo).
 */
export default function FamilyDetailPage() {
  const { familyUid } = useParams<{ familyUid: string }>()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const location = useLocation()
  const navigate = useNavigate()

  const [docId, setDocId] = useState<string | null>(null)
  const [family, setFamily] = useState<FamilyDoc | null>(null)
  const [fosterPersons, setFosterPersons] = useState<Array<{ docId: string; fosterPerson: FosterPersonDoc }>>([])
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [agreement, setAgreement] = useState<AgreementDoc | null>(null)
  const [koOptions, setKoOptions] = useState<UserDoc[]>([])
  const [staffList, setStaffList] = useState<UserDoc[]>([])
  const [timelineEntries, setTimelineEntries] = useState<Array<{ docId: string; entry: TimelineEntryDoc }>>([])
  const [selectedEntry, setSelectedEntry] = useState<{ docId: string; entry: TimelineEntryDoc } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [activeSection, setActiveSection] = useState('prehled')

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const { loading: savingName, success: savingNameSuccess, run: runSaveName } = useAsyncSubmit()

  const [showFosterForm, setShowFosterForm] = useState(false)
  const [fosterFirstName, setFosterFirstName] = useState('')
  const [fosterLastName, setFosterLastName] = useState('')
  const [fosterPhone, setFosterPhone] = useState('')
  const [fosterPhoneError, setFosterPhoneError] = useState<string | null>(null)
  const [fosterEmail, setFosterEmail] = useState('')
  const [fosterEmailError, setFosterEmailError] = useState<string | null>(null)

  const [showChildForm, setShowChildForm] = useState(false)
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childBirthNumber, setChildBirthNumber] = useState('')

  const [recorder, setRecorder] = useState<{
    implicitSubjects: SubjectRef[]
    preselectedPeopleKeys: string[]
    visit?: VisitContext
  } | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const familyAvatarInputRef = useRef<HTMLInputElement>(null)

  const { loading: addingFoster, success: addingFosterSuccess, run: runAddFoster } = useAsyncSubmit()
  const { loading: addingChild, success: addingChildSuccess, run: runAddChild } = useAsyncSubmit()
  const { loading: creatingDocument, success: creatingDocumentSuccess, run: runCreateDocument } = useAsyncSubmit()
  const [loaded, setLoaded] = useState(false)

  const [documents, setDocuments] = useState<Array<{ docId: string; document: FamilyDocumentDoc }>>([])
  const [showDocumentForm, setShowDocumentForm] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docBody, setDocBody] = useState('')
  const [docSubjectKeys, setDocSubjectKeys] = useState<Set<string>>(new Set())

  const primaryFosterName = fosterPersons[0]
    ? `${fosterPersons[0].fosterPerson.firstName} ${fosterPersons[0].fosterPerson.lastName}`
    : null
  const displayName = family ? resolveFamilyDisplayName(family, primaryFosterName) : ''

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
      const [fosters, kids, activeAgreement, staff, entries, docs] = await Promise.all([
        listFosterPersonsByRefs(found.family.fosterPersonRefs),
        listChildrenForFamily(found.docId, organizationId),
        getActiveAgreement(found.docId, organizationId),
        listStaff(organizationId),
        listTimelineEntries(found.docId, organizationId, userDoc?.uid ?? ''),
        listFamilyDocuments(found.docId, organizationId),
      ])
      setFosterPersons(fosters)
      setChildren(kids)
      setAgreement(activeAgreement)
      setStaffList(staff)
      setKoOptions(staff.filter((s) => s.role === 'klicova_osoba'))
      setTimelineEntries(entries)
      setDocuments(docs)
      // `docId` je nastavené (setDocId výš) v samostatném, DŘÍVĚJŠÍM render
      // batchi než `fosterPersons`/`children` tady (React nebatchuje napříč
      // `await` hranicí) — efekt otevírající recorder po návratu z Giant
      // Timeru NESMÍ se spouštět jen na `docId` (viz níž), potřebuje vlastní
      // příznak potvrzující, že `recordablePeople` je už opravdu hotové.
      setLoaded(true)
    } catch {
      setError('Detail rodiny se nepodařilo načíst.')
    }
  }

  /** "Zařadit k" nabízí jen OSOBY (pěstoun/dítě) — rodina a Dohoda nejsou
   * volitelné položky (nejsou to lidé), viz VoiceRecorderPanel komentář. */
  const recordablePeople = useMemo<RecordablePerson[]>(() => {
    const people: RecordablePerson[] = []
    for (const { docId: fpId, fosterPerson: fp } of fosterPersons) {
      people.push({ kind: 'fosterPerson', id: fpId, label: `${fp.firstName} ${fp.lastName}` })
    }
    for (const { docId: childId, child } of children) {
      people.push({ kind: 'child', id: childId, label: `${child.firstName} ${child.lastName}` })
    }
    return people
  }, [fosterPersons, children])

  /** §A3 bod 3: Giant Timer (VisitTimerPage) po ukončení návštěvy naviguje
   * sem se stavem `openVisitRecorder`. */
  useEffect(() => {
    const state = location.state as { openVisitRecorder?: VisitContext } | null
    if (!state?.openVisitRecorder || !docId || !loaded) return
    setRecorder({
      implicitSubjects: [{ kind: 'family', id: docId }],
      preselectedPeopleKeys: recordablePeople.map((p) => `${p.kind}:${p.id}`),
      visit: state.openVisitRecorder,
    })
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, docId, loaded])

  function openRecorderFor(subject: SubjectRef) {
    if (!docId) return
    const implicitSubjects: SubjectRef[] = [{ kind: 'family', id: docId }]
    if (subject.kind === 'agreement') implicitSubjects.push(subject)

    const preselectedPeopleKeys =
      subject.kind === 'family'
        ? recordablePeople.map((p) => `${p.kind}:${p.id}`)
        : subject.kind === 'agreement'
          ? []
          : [`${subject.kind}:${subject.id}`]

    setRecorder({ implicitSubjects, preselectedPeopleKeys })
  }

  async function handleFamilyAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !docId) return
    setUploadingAvatar(true)
    setError(null)
    try {
      await uploadEntityAvatar({ kind: 'family', id: docId, file })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotku se nepodařilo nahrát.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  function startEditName() {
    setNameDraft(family?.displayName ?? '')
    setEditingName(true)
  }

  async function handleSaveName() {
    if (!docId) return
    const next = nameDraft.trim()
    setFamily((prev) => (prev ? { ...prev, displayName: next || undefined } : prev))
    try {
      await runSaveName(async () => {
        await updateFamilyDisplayName(docId, next)
      })
      setEditingName(false)
    } catch {
      setError('Název se nepodařilo uložit.')
      await reload()
    }
  }

  /** DOPLNENI_ZADANI-DO-M5 §2 — výchozí stav "Sdílet s oběma pěstouny" pro
   * příští záznamy v týhle rodině (optimistický update, ověřeno reloadem). */
  async function handlePartnerSharingDefaultChange(next: boolean) {
    if (!docId) return
    setFamily((prev) => (prev ? { ...prev, partnerSharingDefault: next } : prev))
    try {
      await updateFamilyPartnerSharingDefault(docId, next)
    } catch {
      setError('Výchozí sdílení se nepodařilo uložit.')
      await reload()
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyUid, organizationId])

  async function handleAddFoster(e: FormEvent) {
    e.preventDefault()
    if (!docId || !organizationId) return
    const phoneCheck = checkPhone(fosterPhone)
    const emailCheck = checkEmail(fosterEmail)
    setFosterPhone(phoneCheck.value)
    setFosterEmail(emailCheck.value)
    setFosterPhoneError(phoneCheck.ok ? null : phoneCheck.message ?? null)
    setFosterEmailError(emailCheck.ok ? null : emailCheck.message ?? null)
    if (!phoneCheck.ok || !emailCheck.ok) return
    setError(null)
    try {
      await runAddFoster(async () => {
        const org = await getOrganization(organizationId)
        if (!org) throw new Error('org not found')
        await addFosterPersonToFamily(docId, organizationId, org.orgCode, {
          firstName: fosterFirstName,
          lastName: fosterLastName,
          ...(phoneCheck.value ? { phone: phoneCheck.value } : {}),
          ...(emailCheck.value ? { email: emailCheck.value } : {}),
        })
        await reload()
      })
      setFosterFirstName('')
      setFosterLastName('')
      setFosterPhone('')
      setFosterEmail('')
      setShowFosterForm(false)
    } catch {
      setError('Přidání pěstouna se nezdařilo.')
    }
  }

  function resolveAuthorName(uid: string): string {
    return staffList.find((s) => s.uid === uid)?.displayName ?? 'Neznámý uživatel'
  }

  function resolveSubjectLabels(subjectRefs: SubjectRef[]): string[] {
    const labels: string[] = []
    for (const ref of subjectRefs) {
      if (ref.kind === 'fosterPerson') {
        const fp = fosterPersons.find((f) => f.docId === ref.id)?.fosterPerson
        if (fp) labels.push(`${fp.firstName} ${fp.lastName}`)
      } else if (ref.kind === 'child') {
        const c = children.find((ch) => ch.docId === ref.id)?.child
        if (c) labels.push(`${c.firstName} ${c.lastName}`)
      }
    }
    return labels
  }

  async function handleAddChild(e: FormEvent) {
    e.preventDefault()
    if (!docId || !organizationId) return
    setError(null)
    try {
      await runAddChild(async () => {
        const org = await getOrganization(organizationId)
        if (!org) throw new Error('org not found')
        await addChildToFamily(docId, organizationId, org.orgCode, {
          firstName: childFirstName,
          lastName: childLastName,
          birthNumber: childBirthNumber,
        })
        await reload()
      })
      setChildFirstName('')
      setChildLastName('')
      setChildBirthNumber('')
      setShowChildForm(false)
    } catch {
      setError('Přidání dítěte se nezdařilo.')
    }
  }

  function toggleDocSubject(key: string) {
    setDocSubjectKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleCreateDocument(e: FormEvent) {
    e.preventDefault()
    if (!docId || !organizationId || !userDoc) return
    setError(null)
    try {
      let newDocId = ''
      await runCreateDocument(async () => {
        const org = await getOrganization(organizationId)
        if (!org) throw new Error('org not found')
        const subjectRefs: SubjectRef[] = recordablePeople
          .filter((p) => docSubjectKeys.has(`${p.kind}:${p.id}`))
          .map(({ kind, id }) => ({ kind, id }))
        const result = await createDocument({
          familyDocId: docId,
          organizationId,
          orgCode: org.orgCode,
          createdByUid: userDoc.uid,
          title: docTitle,
          body: docBody,
          subjectRefs,
        })
        newDocId = result.docId
      })
      setDocTitle('')
      setDocBody('')
      setDocSubjectKeys(new Set())
      setShowDocumentForm(false)
      navigate(`/rodiny/${familyUid}/dokumenty/${newDocId}`)
    } catch {
      setError('Založení dokumentu se nezdařilo.')
    }
  }

  if (notFound) {
    return (
      <AppShell breadcrumb={[{ label: 'Rodiny', href: '/rodiny' }, { label: 'Nenalezeno' }]}>
        <p className="text-sm text-text-secondary">Tenhle Spis se nepodařilo najít.</p>
      </AppShell>
    )
  }

  return (
    <AppShell
      breadcrumb={[{ label: 'Rodiny', href: '/rodiny' }, { label: displayName }]}
      secondaryPanel={<ProfileSectionNav sections={SECTIONS} active={activeSection} onSelect={setActiveSection} />}
    >
      <div className="flex items-center gap-4">
        <EntityAvatar
          photoURL={family?.avatarUrl}
          label={displayName || 'Spis'}
          fallbackIcon={Home}
          size="lg"
          onChangePhoto={uploadingAvatar ? undefined : () => familyAvatarInputRef.current?.click()}
        />
        <div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="h-9 w-64"
                placeholder={primaryFosterName ?? family?.address ?? ''}
              />
              <Button size="sm" onClick={handleSaveName} loading={savingName} success={savingNameSuccess}>
                Uložit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)} disabled={savingName}>
                Zrušit
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-normal leading-normal text-text-primary">{displayName}</h1>
              <button
                type="button"
                onClick={startEditName}
                aria-label="Upravit název rodiny"
                title="Upravit název rodiny"
                className="text-text-tertiary transition-colors duration-150 hover:text-text-primary"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
          <p className="mt-1 font-mono text-xs text-text-tertiary">{familyUid}</p>
          {family?.address && <p className="text-sm text-text-secondary">{family.address}</p>}
        </div>
      </div>
      <input
        ref={familyAvatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFamilyAvatarChange}
      />

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {activeSection === 'prehled' && (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-normal leading-tight text-text-primary">Dohoda</h2>
            <Link
              to={`/rodiny/${familyUid}/dohoda`}
              className="mt-3 flex items-center justify-between gap-3 max-w-[560px] rounded-lg border border-border bg-surface p-5 transition-colors duration-150 hover:bg-overlay-hover"
            >
              <div className="flex items-center gap-3">
                <EntityAvatar label="Dohoda" fallbackIcon={Handshake} />
                {agreement ? (
                  <div>
                    <p className="text-sm text-text-primary">{CARE_TYPE_LABELS[agreement.careType]}</p>
                    <p className="mt-0.5 text-sm text-text-secondary">
                      Platí od {new Date(agreement.validFrom).toLocaleDateString('cs-CZ')}
                      {agreement.assignedTo &&
                        ` · klíčová osoba: ${koOptions.find((k) => k.uid === agreement.assignedTo)?.displayName ?? agreement.assignedTo}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">Zatím žádná Dohoda s vaší organizací — založit →</p>
                )}
              </div>
            </Link>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-normal leading-tight text-text-primary">Pěstouni</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowFosterForm((v) => !v)}>
                {showFosterForm ? (
                  'Zrušit'
                ) : (
                  <>
                    <Plus size={16} /> Přidat pěstouna
                  </>
                )}
              </Button>
            </div>
            {family && family.fosterPersonRefs.length >= 2 && (
              <div className="mt-3 flex items-center justify-between gap-4 max-w-[560px] rounded-lg border border-border bg-surface p-4">
                <span className="text-sm text-text-primary">Nové zápisy výchozí sdílet s oběma pěstouny</span>
                <Switch
                  checked={family.partnerSharingDefault ?? true}
                  onChange={handlePartnerSharingDefaultChange}
                  label="Nové zápisy výchozí sdílet s oběma pěstouny"
                />
              </div>
            )}

            {showFosterForm && (
              <form
                onSubmit={handleAddFoster}
                className="mt-4 flex flex-col gap-4 max-w-[560px] rounded-lg border border-border bg-surface p-5"
              >
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
                    <Input required value={fosterFirstName} onChange={(e) => setFosterFirstName(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium leading-relaxed text-text-primary">Příjmení</span>
                    <Input required value={fosterLastName} onChange={(e) => setFosterLastName(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium leading-relaxed text-text-primary">Telefon</span>
                    <Input
                      value={fosterPhone}
                      onChange={(e) => { setFosterPhone(e.target.value); setFosterPhoneError(null) }}
                      onBlur={() => {
                        const result = checkPhone(fosterPhone)
                        setFosterPhone(result.value)
                        setFosterPhoneError(result.ok ? null : (result.message ?? null))
                      }}
                    />
                    {fosterPhoneError && <span className="text-xs text-danger">{fosterPhoneError}</span>}
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium leading-relaxed text-text-primary">E-mail</span>
                    <Input
                      type="email"
                      value={fosterEmail}
                      onChange={(e) => { setFosterEmail(e.target.value); setFosterEmailError(null) }}
                      onBlur={() => {
                        const result = checkEmail(fosterEmail)
                        setFosterEmail(result.value)
                        setFosterEmailError(result.ok ? null : (result.message ?? null))
                      }}
                    />
                    {fosterEmailError && <span className="text-xs text-danger">{fosterEmailError}</span>}
                  </label>
                </div>
                <Button type="submit" loading={addingFoster} success={addingFosterSuccess} className="w-fit">
                  Přidat
                </Button>
              </form>
            )}

            <div className="mt-4 max-w-[928px]">
              {fosterPersons.length === 0 ? (
                <EmptyState icon={UserRound} text="Zatím žádní pěstouni." />
              ) : (
                <Table>
                  <TableHeaderRow columns={FOSTER_COLUMNS} labels={['', 'Jméno', 'Telefon', '']} />
                  {fosterPersons.map(({ docId: fpId, fosterPerson: fp }) => (
                    <Link key={fpId} to={`/rodiny/${familyUid}/pestoun/${fpId}`} className="contents">
                      <TableRow columns={FOSTER_COLUMNS}>
                        <EntityAvatar
                          photoURL={fp.avatarUrl}
                          label={`${fp.firstName} ${fp.lastName}`}
                          onQuickRecord={() => openRecorderFor({ kind: 'fosterPerson', id: fpId })}
                          quickRecordDisabledReason={
                            !agreement || agreement.status !== 'active' ? NO_ACTIVE_AGREEMENT_REASON : undefined
                          }
                        />
                        <span className="text-sm text-text-primary">
                          {fp.firstName} {fp.lastName}
                        </span>
                        <span className="text-sm text-text-secondary">{fp.phone || '—'}</span>
                        <span className="text-text-tertiary">›</span>
                      </TableRow>
                    </Link>
                  ))}
                </Table>
              )}
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-normal leading-tight text-text-primary">Svěřené děti</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowChildForm((v) => !v)}>
                {showChildForm ? (
                  'Zrušit'
                ) : (
                  <>
                    <Plus size={16} /> Přidat dítě
                  </>
                )}
              </Button>
            </div>

            {showChildForm && (
              <form
                onSubmit={handleAddChild}
                className="mt-4 flex flex-col gap-4 max-w-[560px] rounded-lg border border-border bg-surface p-5"
              >
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
                    <Input required value={childFirstName} onChange={(e) => setChildFirstName(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium leading-relaxed text-text-primary">Příjmení</span>
                    <Input required value={childLastName} onChange={(e) => setChildLastName(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium leading-relaxed text-text-primary">Rodné číslo</span>
                    <Input required value={childBirthNumber} onChange={(e) => setChildBirthNumber(e.target.value)} />
                  </label>
                </div>
                <Button type="submit" loading={addingChild} success={addingChildSuccess} className="w-fit">
                  Přidat
                </Button>
              </form>
            )}

            <div className="mt-4 max-w-[928px]">
              {children.length === 0 ? (
                <EmptyState icon={Baby} text="Zatím žádné svěřené děti." />
              ) : (
                <Table>
                  <TableHeaderRow columns={CHILD_COLUMNS} labels={['', 'Jméno', '']} />
                  {children.map(({ docId: childId, child }) => (
                    <Link key={childId} to={`/rodiny/${familyUid}/dite/${childId}`} className="contents">
                      <TableRow columns={CHILD_COLUMNS}>
                        <EntityAvatar
                          photoURL={child.avatarUrl}
                          label={`${child.firstName} ${child.lastName}`}
                          onQuickRecord={() => openRecorderFor({ kind: 'child', id: childId })}
                          quickRecordDisabledReason={
                            !agreement || agreement.status !== 'active' ? NO_ACTIVE_AGREEMENT_REASON : undefined
                          }
                        />
                        <span className="text-sm text-text-primary">
                          {child.firstName} {child.lastName}
                        </span>
                        <span className="text-text-tertiary">›</span>
                      </TableRow>
                    </Link>
                  ))}
                </Table>
              )}
            </div>
          </section>

          {docId && organizationId && userDoc && (
            <FamilyCareEventsSection
              familyDocId={docId}
              organizationId={organizationId}
              currentUid={userDoc.uid}
              children={children}
            />
          )}
        </>
      )}

      {activeSection === 'casova-osa' && (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-normal leading-tight text-text-primary">Časová osa</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/rodiny/${familyUid}/navsteva`)}
              disabled={!agreement || agreement.status !== 'active'}
              title={!agreement || agreement.status !== 'active' ? NO_ACTIVE_AGREEMENT_REASON : undefined}
            >
              + Návštěva
            </Button>
          </div>

          <div className="mt-4">
            {timelineEntries.length === 0 ? (
              <EmptyState icon={Clock} text="Zatím žádné zápisy v časové ose." />
            ) : (
              <div className="flex flex-col gap-2 max-w-[928px]">
                {timelineEntries.map(({ docId: entryId, entry }) => {
                  const Icon = TIMELINE_TYPE_ICONS[entry.type]
                  const subjectLabels = resolveSubjectLabels(entry.subjectRefs)
                  return (
                    <button
                      key={entryId}
                      type="button"
                      onClick={() => setSelectedEntry({ docId: entryId, entry })}
                      className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors duration-150 hover:bg-overlay-hover"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-inset text-text-secondary">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-text-primary">{TIMELINE_TYPE_LABELS[entry.type]}</p>
                          <p className="shrink-0 text-xs text-text-tertiary">
                            {new Date(entry.occurredAt).toLocaleString('cs-CZ')}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-text-secondary">
                          {resolveAuthorName(entry.createdByUid)}
                          {subjectLabels.length > 0 && ` · ${subjectLabels.join(', ')}`}
                        </p>
                        {entry.body && <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{entry.body}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {activeSection === 'dokumenty' && (
        <>
          {docId && organizationId && userDoc && (
            <OspodReportSection
              familyDocId={docId}
              familyUid={familyUid ?? ''}
              organizationId={organizationId}
              createdByUid={userDoc.uid}
              childIds={children.map((c) => c.docId)}
              fosterPersons={fosterPersons}
            />
          )}

          <section className="mt-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-normal leading-tight text-text-primary">Dokumenty</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDocumentForm((v) => !v)}
                disabled={!agreement || agreement.status !== 'active'}
                title={!agreement || agreement.status !== 'active' ? NO_ACTIVE_AGREEMENT_REASON : undefined}
              >
                {showDocumentForm ? (
                  'Zrušit'
                ) : (
                  <>
                    <Plus size={16} /> Nový dokument
                  </>
                )}
              </Button>
            </div>

            {showDocumentForm && (
              <form
                onSubmit={handleCreateDocument}
                className="mt-4 flex flex-col gap-4 max-w-[560px] rounded-lg border border-border bg-surface p-5"
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Název</span>
                  <Input required value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Obsah (markdown)</span>
                  <textarea
                    value={docBody}
                    onChange={(e) => setDocBody(e.target.value)}
                    rows={8}
                    className="w-full resize-y rounded-sm border border-border-medium bg-inset px-3 py-2 text-[16px] leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-2 focus:border-accent focus:outline-none"
                  />
                </label>
                {recordablePeople.length > 0 && (
                  <div>
                    <p className="text-xs font-medium leading-none text-text-secondary">Zařadit k (volitelné)</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {recordablePeople.map((p) => {
                        const key = `${p.kind}:${p.id}`
                        const checked = docSubjectKeys.has(key)
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleDocSubject(key)}
                            className={
                              checked
                                ? 'inline-flex h-7 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground'
                                : 'inline-flex h-7 items-center rounded-full border border-border-strong px-3 text-xs font-medium text-text-secondary hover:bg-overlay-active'
                            }
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <Button type="submit" loading={creatingDocument} success={creatingDocumentSuccess} className="w-fit">
                  Založit koncept
                </Button>
              </form>
            )}

            <div className="mt-4">
              {documents.length === 0 ? (
                <EmptyState icon={FileText} text="Zatím žádné dokumenty." />
              ) : (
                <div className="flex flex-col gap-2 max-w-[928px]">
                  {documents.map(({ docId: fdId, document: fd }) => (
                    <button
                      key={fdId}
                      type="button"
                      onClick={() => navigate(`/rodiny/${familyUid}/dokumenty/${fdId}`)}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors duration-150 hover:bg-overlay-hover"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">{fd.title}</p>
                        <p className="mt-0.5 text-xs text-text-tertiary">
                          {fd.uid} · v{fd.currentVersion}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-text-secondary">{DOCUMENT_STATUS_LABELS[fd.status]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {recorder && docId && organizationId && userDoc && (
        <VoiceRecorderPanel
          familyDocId={docId}
          organizationId={organizationId}
          createdByUid={userDoc.uid}
          implicitSubjects={recorder.implicitSubjects}
          people={recordablePeople}
          preselectedPeopleKeys={recorder.preselectedPeopleKeys}
          partnerSharingDefault={family?.partnerSharingDefault ?? true}
          visit={recorder.visit}
          onClose={() => setRecorder(null)}
          onSaved={reload}
        />
      )}

      {selectedEntry && (
        <TimelineEntryDetail
          entry={selectedEntry.entry}
          authorName={resolveAuthorName(selectedEntry.entry.createdByUid)}
          subjectLabels={resolveSubjectLabels(selectedEntry.entry.subjectRefs)}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </AppShell>
  )
}
