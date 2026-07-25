import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { Tabs, type TabItem } from '@/components/ui/tabs'
import { SidePanel } from '@/components/ui/side-panel'
import { EntityAgenda } from '@/components/calendar/EntityAgenda'
import { EntityTasks } from '@/components/tasks/EntityTasks'
import { RecordCard, RecordCardList } from '@/components/ui/record-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { EditableAvatar } from '@/components/ui/editable-avatar'
import { Switch } from '@/components/ui/switch'
import { Combobox } from '@/components/ui/combobox'
import { Modal } from '@/components/ui/modal'
import { AddressLink } from '@/components/ui/address-link'
import { PersonLink } from '@/components/ui/person-link'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { VoiceRecorderPanel, type RecordablePerson, type VisitContext } from '@/components/timeline/VoiceRecorderPanel'
import { TimelineEntryDetail } from '@/components/timeline/TimelineEntryDetail'
import { OspodReportSection } from '@/components/family/OspodReportSection'
import { FamilyCareEventsSection } from '@/components/family/FamilyCareEventsSection'
import { FamilyChatSection } from '@/components/family/FamilyChatSection'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { getOrganization } from '@/services/organizationService'
import { listStaff } from '@/services/staffService'
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
import { assignEntityToCollaborator } from '@/services/collaboratorService'
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
import { Baby, Clock, FileText, Handshake, Mic, Pencil, Plus, StickyNote, UserRound, UserSquare2 } from '@/components/ui/icons'

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

const SECTIONS: TabItem[] = [
  { key: 'prehled', label: 'Přehled' },
  { key: 'casova-osa', label: 'Časová osa' },
  { key: 'kalendar', label: 'Kalendář' },
  { key: 'ukoly', label: 'Úkoly' },
  { key: 'dokumenty', label: 'Dokumenty' },
  { key: 'chat', label: 'Chat' },
]

/**
 * /rodiny/:familyUid — hub odkazující na samostatné profily Dohody/
 * pěstouna/dítěte (`AgreementDetailPage`/`FosterPersonDetailPage`/
 * `ChildDetailPage`). `familyUid` v URL je vždy human-facing `uid`, viz
 * `getFamilyByUid`.
 *
 * Respit/asistovaný kontakt (`FamilyCareEventsSection`) zůstává tady, ne
 * na profilu dítěte — respit typicky pokrývá víc dětí najednou, nedá se
 * čistě rozdělit na jedno dítě.
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

  /** Jeden sdílený pravý panel pro všechny "+ Přidat…" akce na týhle
   * stránce. Respit/série žijou uvnitř `FamilyCareEventsSection` (jiná
   * datová doména) — jejich formulář se do `panelSlotEl` renderuje
   * portálem (`FamilyCarePanelHost`), pěstoun/dítě se renderují přímo tady. */
  const [panelMode, setPanelMode] = useState<'foster' | 'child' | 'respit' | 'series' | null>(null)
  const [panelSlotEl, setPanelSlotEl] = useState<HTMLDivElement | null>(null)
  const [fosterFirstName, setFosterFirstName] = useState('')
  const [fosterLastName, setFosterLastName] = useState('')
  const [fosterPhone, setFosterPhone] = useState('')
  const [fosterPhoneError, setFosterPhoneError] = useState<string | null>(null)
  const [fosterEmail, setFosterEmail] = useState('')
  const [fosterEmailError, setFosterEmailError] = useState<string | null>(null)

  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childBirthNumber, setChildBirthNumber] = useState('')

  const [recorder, setRecorder] = useState<{
    implicitSubjects: SubjectRef[]
    preselectedPeopleKeys: string[]
    visit?: VisitContext
  } | null>(null)

  const { loading: addingFoster, success: addingFosterSuccess, run: runAddFoster } = useAsyncSubmit()
  const { loading: addingChild, success: addingChildSuccess, run: runAddChild } = useAsyncSubmit()

  const [assigningEntity, setAssigningEntity] = useState<{
    entityType: 'child' | 'fosterPerson'
    entityId: string
    label: string
  } | null>(null)
  const [assignTarget, setAssignTarget] = useState('')
  const { loading: assigningCollaborator, success: assignCollaboratorSuccess, run: runAssignCollaborator } =
    useAsyncSubmit()
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
  const collaboratorOptions = staffList.filter((s) => s.role === 'spolupracovnik')

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
      setPanelMode(null)
    } catch {
      setError('Přidání pěstouna se nezdařilo.')
    }
  }

  function resolveAuthorName(uid: string): string {
    return staffList.find((s) => s.uid === uid)?.displayName ?? 'Neznámý uživatel'
  }

  /** uid autora jen tehdy, když ho v týmu skutečně známe — jinak by odkaz
   * vedl na profil, který neexistuje. */
  function authorLinkId(uid: string): string | null {
    return staffList.some((s) => s.uid === uid) ? uid : null
  }

  /** uid → jméno, pro proklik na řešitele úkolu. */
  const staffNamesByUid = useMemo(
    () => new Map(staffList.map((s) => [s.uid, s.displayName])),
    [staffList],
  )

  /** Pěstouni/děti, kterých se zápis týká — jako prokliky na profil,
   * protože jméno v platformě nikdy není jen text. */
  function renderSubjectLinks(subjectRefs: SubjectRef[]) {
    const parts: Array<{ key: string; node: React.ReactNode }> = []
    for (const ref of subjectRefs) {
      if (ref.kind === 'fosterPerson') {
        const fp = fosterPersons.find((f) => f.docId === ref.id)?.fosterPerson
        if (fp) {
          parts.push({
            key: ref.id,
            node: (
              <PersonLink kind="fosterPerson" id={ref.id} familyUid={familyUid} name={`${fp.firstName} ${fp.lastName}`} muted />
            ),
          })
        }
      } else if (ref.kind === 'child') {
        const c = children.find((ch) => ch.docId === ref.id)?.child
        if (c) {
          parts.push({
            key: ref.id,
            node: <PersonLink kind="child" id={ref.id} familyUid={familyUid} name={`${c.firstName} ${c.lastName}`} muted />,
          })
        }
      }
    }
    return parts
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
      setPanelMode(null)
    } catch {
      setError('Přidání dítěte se nezdařilo.')
    }
  }

  async function handleAssignCollaborator(e: FormEvent) {
    e.preventDefault()
    if (!assigningEntity || !organizationId || !userDoc || !assignTarget) return
    setError(null)
    try {
      await runAssignCollaborator(async () => {
        await assignEntityToCollaborator({
          organizationId,
          collaboratorUid: assignTarget,
          entityType: assigningEntity.entityType,
          entityId: assigningEntity.entityId,
          createdBy: userDoc.uid,
        })
      })
      setAssigningEntity(null)
      setAssignTarget('')
    } catch {
      setError('Přiřazení spolupracovníkovi se nezdařilo.')
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
      <AppShell>
        <p className="text-sm text-text-secondary">Tenhle Spis se nepodařilo najít.</p>
      </AppShell>
    )
  }

  const sidePanel =
    panelMode === 'foster' ? (
      <SidePanel title="Přidat pěstouna" onClose={() => setPanelMode(null)}>
        <form onSubmit={handleAddFoster} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg bg-inset p-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
              <Input required autoFocus value={fosterFirstName} onChange={(e) => setFosterFirstName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Příjmení</span>
              <Input required value={fosterLastName} onChange={(e) => setFosterLastName(e.target.value)} />
            </label>
          </div>
          <div className="flex flex-col gap-3 rounded-lg bg-inset p-3">
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

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-border-default pt-4">
            <Button type="submit" loading={addingFoster} success={addingFosterSuccess}>
              Přidat
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPanelMode(null)} disabled={addingFoster}>
              Zrušit
            </Button>
          </div>
        </form>
      </SidePanel>
    ) : panelMode === 'child' ? (
      <SidePanel title="Přidat dítě" onClose={() => setPanelMode(null)}>
        <form onSubmit={handleAddChild} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg bg-inset p-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
              <Input required autoFocus value={childFirstName} onChange={(e) => setChildFirstName(e.target.value)} />
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

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-border-default pt-4">
            <Button type="submit" loading={addingChild} success={addingChildSuccess}>
              Přidat
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPanelMode(null)} disabled={addingChild}>
              Zrušit
            </Button>
          </div>
        </form>
      </SidePanel>
    ) : panelMode === 'respit' || panelMode === 'series' ? (
      <SidePanel title={panelMode === 'respit' ? 'Zaznamenat respit' : 'Založit sérii'} onClose={() => setPanelMode(null)}>
        <div ref={setPanelSlotEl} />
      </SidePanel>
    ) : undefined

  return (
    <AppShell fullBleed sidePanel={sidePanel}>
      <div className="flex h-full min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-8">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {docId && family && (
            <EditableAvatar
              kind="family"
              id={docId}
              photoURL={family.avatarUrl}
              label={displayName}
              fallbackIcon={UserRound}
              onUploaded={(url) => setFamily((prev) => (prev ? { ...prev, avatarUrl: url } : prev))}
            />
          )}
          <div className="min-w-0">
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
              <h1 className="font-heading text-xl font-bold leading-tight text-text-primary">{displayName}</h1>
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
          {family?.address && (
            <p className="mt-1 text-sm">
              <AddressLink address={family.address} />
            </p>
          )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">Spis</p>
          <p className="font-mono text-sm text-text-secondary">{familyUid}</p>
        </div>
      </div>

      <div className="max-w-[928px]">
        <Tabs items={SECTIONS} active={activeSection} onSelect={setActiveSection} />

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
                className="mt-3 flex items-center gap-3 max-w-[560px] rounded-lg bg-surface-soft p-5 shadow-raised transition-shadow duration-150 hover:shadow-md"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-inset text-text-secondary">
                  <Handshake size={18} strokeWidth={1.75} />
                </span>
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
              </Link>
            </section>

          <section className="mt-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-normal leading-tight text-text-primary">Pěstouni</h2>
              <Button variant="secondary" size="sm" onClick={() => setPanelMode('foster')}>
                <Plus size={16} /> Přidat pěstouna
              </Button>
            </div>
            {family && family.fosterPersonRefs.length >= 2 && (
              <div className="mt-3 flex items-center justify-between gap-4 max-w-[560px] rounded-lg bg-surface-soft p-4 shadow-raised">
                <span className="text-sm text-text-primary">Nové zápisy výchozí sdílet s oběma pěstouny</span>
                <Switch
                  checked={family.partnerSharingDefault ?? true}
                  onChange={handlePartnerSharingDefaultChange}
                  label="Nové zápisy výchozí sdílet s oběma pěstouny"
                />
              </div>
            )}

            <div className="mt-4 max-w-[928px]">
              {fosterPersons.length === 0 ? (
                <EmptyState icon={UserRound} text="Zatím žádní pěstouni." />
              ) : (
                <RecordCardList>
                  {fosterPersons.map(({ docId: fpId, fosterPerson: fp }) => (
                    <RecordCard
                      key={fpId}
                      onClick={() => navigate(`/rodiny/${familyUid}/pestoun/${fpId}`)}
                      leading={
                        <EntityAvatar
                          photoURL={fp.avatarUrl}
                          label={`${fp.firstName} ${fp.lastName}`}
                          onQuickRecord={() => openRecorderFor({ kind: 'fosterPerson', id: fpId })}
                          quickRecordDisabledReason={
                            !agreement || agreement.status !== 'active' ? NO_ACTIVE_AGREEMENT_REASON : undefined
                          }
                        />
                      }
                      title={`${fp.firstName} ${fp.lastName}`}
                      subtitle={fp.phone || undefined}
                      trailing={
                        <>
                          <button
                            type="button"
                            title="Přiřadit spolupracovníkovi"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setAssigningEntity({
                                entityType: 'fosterPerson',
                                entityId: fpId,
                                label: `${fp.firstName} ${fp.lastName}`,
                              })
                            }}
                            className="flex size-8 items-center justify-center rounded-full text-text-tertiary hover:bg-overlay-active hover:text-text-primary"
                          >
                            <UserSquare2 size={14} strokeWidth={2} />
                          </button>
                          <span className="text-text-tertiary">›</span>
                        </>
                      }
                    />
                  ))}
                </RecordCardList>
              )}
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-normal leading-tight text-text-primary">Svěřené děti</h2>
              <Button variant="secondary" size="sm" onClick={() => setPanelMode('child')}>
                <Plus size={16} /> Přidat dítě
              </Button>
            </div>

            <div className="mt-4 max-w-[928px]">
              {children.length === 0 ? (
                <EmptyState icon={Baby} text="Zatím žádné svěřené děti." />
              ) : (
                <RecordCardList>
                  {children.map(({ docId: childId, child }) => (
                    <RecordCard
                      key={childId}
                      onClick={() => navigate(`/rodiny/${familyUid}/dite/${childId}`)}
                      leading={
                        <EntityAvatar
                          photoURL={child.avatarUrl}
                          label={`${child.firstName} ${child.lastName}`}
                          onQuickRecord={() => openRecorderFor({ kind: 'child', id: childId })}
                          quickRecordDisabledReason={
                            !agreement || agreement.status !== 'active' ? NO_ACTIVE_AGREEMENT_REASON : undefined
                          }
                        />
                      }
                      title={`${child.firstName} ${child.lastName}`}
                      trailing={
                        <>
                          <button
                            type="button"
                            title="Přiřadit spolupracovníkovi"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setAssigningEntity({
                                entityType: 'child',
                                entityId: childId,
                                label: `${child.firstName} ${child.lastName}`,
                              })
                            }}
                            className="flex size-8 items-center justify-center rounded-full text-text-tertiary hover:bg-overlay-active hover:text-text-primary"
                          >
                            <UserSquare2 size={14} strokeWidth={2} />
                          </button>
                          <span className="text-text-tertiary">›</span>
                        </>
                      }
                    />
                  ))}
                </RecordCardList>
              )}
            </div>
          </section>

          {docId && organizationId && userDoc && (
            <FamilyCareEventsSection
              familyDocId={docId}
              organizationId={organizationId}
              currentUid={userDoc.uid}
              children={children}
              respitPanel={{
                isOpen: panelMode === 'respit',
                onOpen: () => setPanelMode('respit'),
                onClose: () => setPanelMode(null),
                panelTarget: panelMode === 'respit' ? panelSlotEl : null,
              }}
              seriesPanel={{
                isOpen: panelMode === 'series',
                onOpen: () => setPanelMode('series'),
                onClose: () => setPanelMode(null),
                panelTarget: panelMode === 'series' ? panelSlotEl : null,
              }}
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
                  const subjectLinks = renderSubjectLinks(entry.subjectRefs)
                  // Řádek je `div role="button"`, ne `<button>` — jména
                  // autora i subjektů jsou prokliky na profil a `<a>` uvnitř
                  // `<button>` je nevalidní HTML.
                  return (
                    <div
                      key={entryId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedEntry({ docId: entryId, entry })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedEntry({ docId: entryId, entry })
                        }
                      }}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors duration-150 hover:bg-overlay-hover"
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
                          <PersonLink
                            kind="staff"
                            id={authorLinkId(entry.createdByUid)}
                            name={resolveAuthorName(entry.createdByUid)}
                            muted
                          />
                          {subjectLinks.map(({ key, node }) => (
                            <span key={key}>
                              {' · '}
                              {node}
                            </span>
                          ))}
                        </p>
                        {entry.body && <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{entry.body}</p>}
                      </div>
                    </div>
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
                className="mt-4 flex flex-col gap-4 max-w-[928px] rounded-lg border border-border bg-surface p-5"
              >
                <label className="flex flex-col gap-1.5 max-w-[560px]">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Název</span>
                  <Input required value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Obsah</span>
                  <RichTextEditor value={docBody} onChange={setDocBody} minHeight={220} placeholder="Začněte psát obsah dokumentu…" />
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

      {activeSection === 'kalendar' && docId && organizationId && (
        <section className="mt-8">
          <EntityAgenda organizationId={organizationId} subjectKind="family" subjectId={docId} />
        </section>
      )}

      {activeSection === 'ukoly' && docId && organizationId && (
        <section className="mt-8">
          <EntityTasks
            organizationId={organizationId}
            subjectKind="family"
            subjectId={docId}
            staffNames={staffNamesByUid}
          />
        </section>
      )}

      {activeSection === 'chat' && docId && organizationId && userDoc && (
        <div className="mt-8">
          <FamilyChatSection
            familyDocId={docId}
            organizationId={organizationId}
            currentUid={userDoc.uid}
            staffList={staffList}
          />
        </div>
      )}
      </div>
          </div>
        </div>
      </div>

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
          authorName={
            <PersonLink
              kind="staff"
              id={authorLinkId(selectedEntry.entry.createdByUid)}
              name={resolveAuthorName(selectedEntry.entry.createdByUid)}
              muted
            />
          }
          subjectLabels={renderSubjectLinks(selectedEntry.entry.subjectRefs)}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {assigningEntity && (
        <Modal onClose={() => setAssigningEntity(null)}>
          <form onSubmit={handleAssignCollaborator} className="flex flex-col gap-4">
            <h2 className="text-base font-medium text-text-primary">
              Přiřadit spolupracovníkovi — {assigningEntity.label}
            </h2>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Spolupracovník</span>
              <Combobox
                options={collaboratorOptions.map((c) => ({ value: c.uid, label: c.displayName }))}
                value={assignTarget}
                onChange={setAssignTarget}
                placeholder="Vybrat…"
                emptyText="V organizaci zatím není žádný spolupracovník (založíte na stránce Zaměstnanci)."
              />
            </label>
            <p className="text-xs text-text-tertiary">
              Uvidí jen moduly, co mu KO/vedení povolí na stránce Zaměstnanci.
            </p>
            <div className="flex gap-2">
              <Button
                type="submit"
                loading={assigningCollaborator}
                success={assignCollaboratorSuccess}
                disabled={!assignTarget}
              >
                Přiřadit
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAssigningEntity(null)}
                disabled={assigningCollaborator}
              >
                Zrušit
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  )
}
