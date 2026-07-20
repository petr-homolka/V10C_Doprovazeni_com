import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { VoiceRecorderPanel, type RecordablePerson, type VisitContext } from '@/components/timeline/VoiceRecorderPanel'
import { TimelineEntryDetail } from '@/components/timeline/TimelineEntryDetail'
import { useAuth } from '@/hooks/useAuth'
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
} from '@/services/familyService'
import { checkKoCapacity, createAgreement, endAgreement, getActiveAgreement } from '@/services/agreementService'
import { sendFosterInvitation } from '@/services/fosterInvitationService'
import { createDocument, listFamilyDocuments } from '@/services/documentService'
import { DOCUMENT_STATUS_LABELS } from '@/components/documents/documentStatusLabels'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { AgreementDoc, CareType } from '@/types/agreement'
import type { UserDoc } from '@/types/user'
import type { FamilyDocumentDoc } from '@/types/familyDocument'
import type { SubjectRef, TimelineEntryDoc, TimelineEntryKind } from '@/types/timelineEntry'
import { Baby, Clock, FileText, Handshake, Home, Mic, StickyNote, UserRound } from 'lucide-react'

const FOSTER_COLUMNS = '40px 1.1fr 0.9fr 1.1fr 120px'
const TIMELINE_TYPE_LABELS: Record<TimelineEntryKind, string> = {
  note: 'Poznámka',
  visit: 'Návštěva',
  voice_entry: 'Hlasový zápis',
  system: 'Systémová událost',
  document: 'Dokument',
}
const TIMELINE_TYPE_ICONS: Record<TimelineEntryKind, typeof Mic> = {
  note: StickyNote,
  visit: Clock,
  voice_entry: Mic,
  system: FileText,
  document: FileText,
}
const CHILD_COLUMNS = '40px 1fr'
const NO_ACTIVE_AGREEMENT_REASON = 'Tahle rodina nemá s vaší organizací aktivní Dohodu — zápis by nešlo uložit.'

const CARE_TYPE_LABELS: Record<CareType, string> = {
  zprostredkovana: 'Zprostředkovaná (24 h/12 měsíců)',
  nezprostredkovana: 'Nezprostředkovaná — příbuzenská (18 h/12 měsíců)',
}

/**
 * /rodiny/:familyUid — M1 základ. `familyUid` v URL je vždy human-facing
 * `uid` (§4.3 pozn. 1), viz getFamilyByUid. Pěstouni a děti se přidávají
 * přímo tady — je to jeden kontextový celek, ne tři samostatné stránky.
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

  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [careType, setCareType] = useState<CareType>('zprostredkovana')
  const [assignedTo, setAssignedTo] = useState('')
  const [capacityNote, setCapacityNote] = useState<string | null>(null)

  const [showFosterForm, setShowFosterForm] = useState(false)
  const [fosterFirstName, setFosterFirstName] = useState('')
  const [fosterLastName, setFosterLastName] = useState('')
  const [fosterPhone, setFosterPhone] = useState('')
  const [fosterEmail, setFosterEmail] = useState('')

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

  const [submitting, setSubmitting] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const [invitingFosterId, setInvitingFosterId] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState<{ fpId: string; text: string } | null>(null)

  const [documents, setDocuments] = useState<Array<{ docId: string; document: FamilyDocumentDoc }>>([])
  const [showDocumentForm, setShowDocumentForm] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docBody, setDocBody] = useState('')
  const [docSubjectKeys, setDocSubjectKeys] = useState<Set<string>>(new Set())

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
      // příznak potvrzující, že `recordablePeople` je už opravdu hotové,
      // jinak se "Zařadit k" předvybere jako PRÁZDNÉ (skutečně nalezený bug
      // při živém ověření M3.2 — návštěva se uložila bez jediné osoby).
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
   * sem se stavem `openVisitRecorder` — otevře se stejný VoiceRecorderPanel
   * jako z avatarů, jen v `visit` režimu, s implicitně předvybranými VŠEMI
   * osobami rodiny (návštěva se týká rodiny jako celku, ne jedné osoby). */
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

  /**
   * §7.3: klik na avatar rodiny předvybere VŠECHNY osoby (pěstouny + děti),
   * klik na avatar konkrétní osoby předvybere jen ji. Rodina se do
   * `subjectRefs` zapíše VŽDY potichu (`implicitSubjects`), Dohoda jen když
   * se nahrávání spustilo z jejího avataru — ani jedno se needitovatelně
   * nezobrazuje jako "Zařadit k" položka.
   */
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

  async function handleCreateAgreement(e: FormEvent) {
    e.preventDefault()
    if (!docId || !organizationId) return
    setSubmitting(true)
    setError(null)
    try {
      const org = await getOrganization(organizationId)
      if (!org) throw new Error('org not found')
      await createAgreement({
        familyDocId: docId,
        organizationId,
        orgCode: org.orgCode,
        careType,
        assignedTo: assignedTo || undefined,
      })
      setShowAgreementForm(false)
      setCapacityNote(null)
      await reload()
    } catch {
      setError('Založení Dohody se nezdařilo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEndAgreement() {
    if (!docId || !organizationId) return
    setSubmitting(true)
    setError(null)
    try {
      await endAgreement(docId, organizationId)
      await reload()
    } catch {
      setError('Ukončení Dohody se nezdařilo.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyUid, organizationId])

  async function handleAddFoster(e: FormEvent) {
    e.preventDefault()
    if (!docId || !organizationId) return
    setSubmitting(true)
    setError(null)
    try {
      const org = await getOrganization(organizationId)
      if (!org) throw new Error('org not found')
      await addFosterPersonToFamily(docId, organizationId, org.orgCode, {
        firstName: fosterFirstName,
        lastName: fosterLastName,
        phone: fosterPhone || undefined,
        email: fosterEmail || undefined,
      })
      setFosterFirstName('')
      setFosterLastName('')
      setFosterPhone('')
      setFosterEmail('')
      setShowFosterForm(false)
      await reload()
    } catch {
      setError('Přidání pěstouna se nezdařilo.')
    } finally {
      setSubmitting(false)
    }
  }

  /** §6 A6: magic link pozvánka — vyžaduje e-mail na FosterPersonDoc (viz
   * "Přidat pěstouna" formulář výš), tlačítko je jinak vypnuté s tooltipem
   * místo skrytého/matoucího chování. */
  async function handleInviteFoster(fpId: string, email: string | undefined) {
    if (!docId || !organizationId || !userDoc || !email) return
    setInvitingFosterId(fpId)
    setInviteMessage(null)
    try {
      const fp = fosterPersons.find((f) => f.docId === fpId)?.fosterPerson
      await sendFosterInvitation({
        email,
        organizationId,
        familyId: docId,
        fosterPersonRef: fpId,
        fosterPersonDisplayName: fp ? `${fp.firstName} ${fp.lastName}` : email,
        invitedByUid: userDoc.uid,
        invitedByDisplayName: userDoc.displayName,
      })
      setInviteMessage({ fpId, text: `Pozvánka odeslána na ${email}.` })
    } catch {
      setInviteMessage({ fpId, text: 'Pozvánku se nepodařilo odeslat.' })
    } finally {
      setInvitingFosterId(null)
    }
  }

  function resolveAuthorName(uid: string): string {
    return staffList.find((s) => s.uid === uid)?.displayName ?? 'Neznámý uživatel'
  }

  /** Chipy v detailu zápisu ukazují jen OSOBY (stejné pravidlo jako "Zařadit
   * k" ve VoiceRecorderPanel) — rodina/Dohoda jsou implicitní, needitovatelné. */
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
    setSubmitting(true)
    setError(null)
    try {
      const org = await getOrganization(organizationId)
      if (!org) throw new Error('org not found')
      await addChildToFamily(docId, organizationId, org.orgCode, {
        firstName: childFirstName,
        lastName: childLastName,
        birthNumber: childBirthNumber,
      })
      setChildFirstName('')
      setChildLastName('')
      setChildBirthNumber('')
      setShowChildForm(false)
      await reload()
    } catch {
      setError('Přidání dítěte se nezdařilo.')
    } finally {
      setSubmitting(false)
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

  /** §6 A1 bod 1: KO založí dokument (`draft`). "Zařadit k" je VOLITELNÉ
   * (na rozdíl od hlasového zápisníku) — ne každý dokument se týká
   * konkrétní osoby (§6 A2 report ovšem typicky ano). */
  async function handleCreateDocument(e: FormEvent) {
    e.preventDefault()
    if (!docId || !organizationId || !userDoc) return
    setSubmitting(true)
    setError(null)
    try {
      const org = await getOrganization(organizationId)
      if (!org) throw new Error('org not found')
      const subjectRefs: SubjectRef[] = recordablePeople
        .filter((p) => docSubjectKeys.has(`${p.kind}:${p.id}`))
        .map(({ kind, id }) => ({ kind, id }))
      const { docId: newDocId } = await createDocument({
        familyDocId: docId,
        organizationId,
        orgCode: org.orgCode,
        createdByUid: userDoc.uid,
        title: docTitle,
        body: docBody,
        subjectRefs,
      })
      setDocTitle('')
      setDocBody('')
      setDocSubjectKeys(new Set())
      setShowDocumentForm(false)
      navigate(`/rodiny/${familyUid}/dokumenty/${newDocId}`)
    } catch {
      setError('Založení dokumentu se nezdařilo.')
    } finally {
      setSubmitting(false)
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
      breadcrumb={[{ label: 'Rodiny', href: '/rodiny' }, { label: familyUid ?? '' }]}
    >
      <div className="flex items-center gap-4">
        <EntityAvatar
          photoURL={family?.avatarUrl}
          label={family?.address || 'Spis'}
          fallbackIcon={Home}
          size="lg"
          onChangePhoto={uploadingAvatar ? undefined : () => familyAvatarInputRef.current?.click()}
        />
        <div>
          <h1 className="font-mono text-lg font-normal leading-normal text-text-primary">
            {familyUid}
          </h1>
          {family?.address && <p className="mt-1 text-sm text-text-secondary">{family.address}</p>}
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

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {agreement && organizationId && (
              <EntityAvatar
                label="Dohoda"
                fallbackIcon={Handshake}
                onQuickRecord={() => openRecorderFor({ kind: 'agreement', id: organizationId })}
                quickRecordDisabledReason={agreement.status !== 'active' ? NO_ACTIVE_AGREEMENT_REASON : undefined}
              />
            )}
            <h2 className="text-lg font-normal leading-tight text-text-primary">Dohoda</h2>
          </div>
          {!agreement && (
            <Button variant="secondary" size="sm" onClick={() => setShowAgreementForm((v) => !v)}>
              {showAgreementForm ? 'Zrušit' : '+ Založit Dohodu'}
            </Button>
          )}
          {agreement && (
            <Button variant="outline" size="sm" onClick={handleEndAgreement} disabled={submitting}>
              Ukončit Dohodu
            </Button>
          )}
        </div>

        {agreement ? (
          <div className="mt-4 rounded-lg border border-border bg-surface p-5">
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
          </div>
        ) : (
          !showAgreementForm && <EmptyState icon={FileText} text="Zatím žádná Dohoda s vaší organizací." />
        )}

        {showAgreementForm && !agreement && (
          <form
            onSubmit={handleCreateAgreement}
            className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
          >
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Typ péče</span>
                <select
                  value={careType}
                  onChange={(e) => setCareType(e.target.value as CareType)}
                  className="h-10 w-full rounded-sm border border-border-medium bg-inset px-3 text-text-primary"
                >
                  {(Object.keys(CARE_TYPE_LABELS) as CareType[]).map((ct) => (
                    <option key={ct} value={ct}>
                      {CARE_TYPE_LABELS[ct]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Klíčová osoba</span>
                <select
                  value={assignedTo}
                  onChange={(e) => handleAssignedToChange(e.target.value)}
                  className="h-10 w-full rounded-sm border border-border-medium bg-inset px-3 text-text-primary"
                >
                  <option value="">Nepřiřazeno</option>
                  {koOptions.map((ko) => (
                    <option key={ko.uid} value={ko.uid}>
                      {ko.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {capacityNote && <p className="text-sm text-warning">{capacityNote}</p>}
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? 'Zakládám…' : 'Založit Dohodu'}
            </Button>
          </form>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-normal leading-tight text-text-primary">Pěstouni</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowFosterForm((v) => !v)}>
            {showFosterForm ? 'Zrušit' : '+ Přidat pěstouna'}
          </Button>
        </div>

        {showFosterForm && (
          <form
            onSubmit={handleAddFoster}
            className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
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
                <Input value={fosterPhone} onChange={(e) => setFosterPhone(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">E-mail</span>
                <Input type="email" value={fosterEmail} onChange={(e) => setFosterEmail(e.target.value)} />
              </label>
            </div>
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? 'Přidávám…' : 'Přidat'}
            </Button>
          </form>
        )}

        <div className="mt-4">
          {fosterPersons.length === 0 ? (
            <EmptyState icon={UserRound} text="Zatím žádní pěstouni." />
          ) : (
            <Table>
              <TableHeaderRow columns={FOSTER_COLUMNS} labels={['', 'Jméno', 'Telefon', 'E-mail', '']} />
              {fosterPersons.map(({ docId: fpId, fosterPerson: fp }) => (
                <TableRow key={fpId} columns={FOSTER_COLUMNS}>
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
                  <span className="truncate text-sm text-text-secondary">{fp.email || '—'}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!fp.email || invitingFosterId === fpId}
                    onClick={() => handleInviteFoster(fpId, fp.email)}
                    title={!fp.email ? 'Pěstoun nemá vyplněný e-mail' : undefined}
                  >
                    {invitingFosterId === fpId ? 'Odesílám…' : 'Pozvat'}
                  </Button>
                </TableRow>
              ))}
            </Table>
          )}
          {inviteMessage && <p className="mt-2 text-sm text-text-secondary">{inviteMessage.text}</p>}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-normal leading-tight text-text-primary">Svěřené děti</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowChildForm((v) => !v)}>
            {showChildForm ? 'Zrušit' : '+ Přidat dítě'}
          </Button>
        </div>

        {showChildForm && (
          <form
            onSubmit={handleAddChild}
            className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
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
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? 'Přidávám…' : 'Přidat'}
            </Button>
          </form>
        )}

        <div className="mt-4">
          {children.length === 0 ? (
            <EmptyState icon={Baby} text="Zatím žádné svěřené děti." />
          ) : (
            <Table>
              <TableHeaderRow columns={CHILD_COLUMNS} labels={['', 'Jméno']} />
              {children.map(({ docId: childId, child }) => (
                <TableRow key={childId} columns={CHILD_COLUMNS}>
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
                </TableRow>
              ))}
            </Table>
          )}
        </div>
      </section>

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
            <div className="flex flex-col gap-2">
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
            {showDocumentForm ? 'Zrušit' : '+ Nový dokument'}
          </Button>
        </div>

        {showDocumentForm && (
          <form
            onSubmit={handleCreateDocument}
            className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
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
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? 'Zakládám…' : 'Založit koncept'}
            </Button>
          </form>
        )}

        <div className="mt-4">
          {documents.length === 0 ? (
            <EmptyState icon={FileText} text="Zatím žádné dokumenty." />
          ) : (
            <div className="flex flex-col gap-2">
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

      {recorder && docId && organizationId && userDoc && (
        <VoiceRecorderPanel
          familyDocId={docId}
          organizationId={organizationId}
          createdByUid={userDoc.uid}
          implicitSubjects={recorder.implicitSubjects}
          people={recordablePeople}
          preselectedPeopleKeys={recorder.preselectedPeopleKeys}
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
