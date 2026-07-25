import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { SpisCheck, SpisSection } from '@/components/spis/SpisSection'
import { DataAddRow, DataLabels, DataRow, DataRowReveal, SpisGroupLabel } from '@/components/spis/DataRow'
import { LimitRow } from '@/components/spis/LimitRow'
import { SidePanel } from '@/components/ui/side-panel'
import { EntityAgenda } from '@/components/calendar/EntityAgenda'
import { EntityTasks } from '@/components/tasks/EntityTasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { EditableAvatar } from '@/components/ui/editable-avatar'
import { Switch } from '@/components/ui/switch'
import { Combobox } from '@/components/ui/combobox'
import { Modal } from '@/components/ui/modal'
import { AddressLink } from '@/components/ui/address-link'
import { PersonLink } from '@/components/ui/person-link'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { PropertyEmpty, PropertyList, PropertyRow } from '@/components/ui/property-list'
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
import { useScrollTopOnRoute } from '@/hooks/useScrollTopOnRoute'
import {
  ageYears, buildCareLimits, dayCount, daysAgo, educationHoursInLastYear, lastSeenInPerson, nextVisitDue,
  shortDate,
} from '@/lib/spisInsights'
import { listCalendarEventsForSubject } from '@/services/calendarEventService'
import type { CalendarEventDoc } from '@/types/calendarEvent'
import { checkEmail, checkPhone } from '@/lib/contactValidation'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import { EDUCATION_HOURS_TARGET } from '@/types/agreement'
import type { AgreementDoc, CareType } from '@/types/agreement'
import type { UserDoc } from '@/types/user'
import type { FamilyDocumentDoc } from '@/types/familyDocument'
import type { SubjectRef, TimelineEntryDoc, TimelineEntryKind } from '@/types/timelineEntry'
import {
  ChevronDown, ChevronRight, Clock, FileText, Mic, Pencil, StickyNote, UserRound, UserSquare2,
} from '@/components/ui/icons'

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

/* Bez hodin v závorce: „Zprostředkovaná (24 h/12 měsíců)" byly dva slepené
   údaje v jednom. Hodiny mají vlastní řádek „Vzdělávání" — a hlavně se
   u nich dá poznat, když v Dohodě chybí. */
const CARE_TYPE_LABELS: Record<CareType, string> = {
  zprostredkovana: 'Zprostředkovaná',
  nezprostredkovana: 'Nezprostředkovaná — příbuzenská',
}

/*
  STRÁNKA MÍSTO ZÁLOŽEK.

  Do 2026-07-25 byla rodina rozřezaná na šest obrazovek (Přehled / Časová osa
  / Kalendář / Úkoly / Dokumenty / Chat) a člověk se mezi nimi proklikával,
  aby si dal dohromady, jak se rodině vede. Petr: „bych rád jiné řešení než
  co bylo, zahoď to". Je to teď JEDNA stránka a orientaci v ní drží NÁZVY
  SEKCÍ V LEVÉM OKRAJI (`SpisSection`) — sazba z referenční stránky, kterou
  poslal, když řekl, že první verze je nepřehledná.

  Pořadí není podle entit, ale podle toho, co se s rodinou opravdu dělá:
  stav a lhůty → kdo v ní je → co bylo (zápisy) → co se plánuje (kalendář,
  úkoly) → péče → papíry → řeč.
*/

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

  const [events, setEvents] = useState<Array<{ docId: string; event: CalendarEventDoc }>>([])
  /** Vlastnosti Dohody: pět vidět, ostatní na požádání. Adresu ani spisovku
   * nikdo nehledá pětkrát denně — nemají trvale brát nejlepší místo. */
  const [allProps, setAllProps] = useState(false)
  /** Rolovací kontejner stránky. `useScrollTopOnRoute` ho při přechodu na
   * jinou rodinu vrátí na začátek — stránka je `fullBleed`, takže si scroll
   * řídí sama a `AppShell` na něj nedosáhne. */
  const scroller = useScrollTopOnRoute<HTMLDivElement>(useRef<HTMLDivElement>(null))

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
      const [fosters, kids, activeAgreement, staff, entries, docs, familyEvents] = await Promise.all([
        listFosterPersonsByRefs(found.family.fosterPersonRefs),
        listChildrenForFamily(found.docId, organizationId),
        getActiveAgreement(found.docId, organizationId),
        listStaff(organizationId),
        listTimelineEntries(found.docId, organizationId, userDoc?.uid ?? ''),
        listFamilyDocuments(found.docId, organizationId),
        // Události rodiny se čtou i tady (ne jen v kalendáři): z délky
        // vzdělávacích událostí se počítá ZÁKONNÝ LIMIT hodin, který je
        // v bloku „Lhůty a limity" hned na začátku stránky.
        listCalendarEventsForSubject(organizationId, 'family', found.docId),
      ])
      setFosterPersons(fosters)
      setChildren(kids)
      setAgreement(activeAgreement)
      setStaffList(staff)
      setKoOptions(staff.filter((s) => s.role === 'klicova_osoba'))
      setTimelineEntries(entries)
      setDocuments(docs)
      setEvents(familyEvents)
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

  /* ---------- co se dá spočítat (viz `lib/spisInsights.ts`) ---------- */

  /*
    POZOR NA POŘADÍ: tyhle `useMemo` MUSÍ být nad `if (notFound) return` níž.
    Chvíli byly pod ním a v produkci to spadlo na „Minified React error #300"
    (rendered fewer hooks than expected) — jakmile se rodina nenašla, funkce
    se vrátila dřív, čtyři hooky se nezavolaly a React ztratil jejich pořadí.
    Tady je to strukturálně bezpečné: mezi začátkem funkce a hooky není žádný
    `return`. Hlídá to i `npm run lint` (oxlint, react-hooks/rules-of-hooks),
    který jsem si tehdy nepustil.
  */
  const educationHours = useMemo(() => educationHoursInLastYear(events), [events])
  const limits = useMemo(
    () => buildCareLimits({ agreement, entries: timelineEntries, educationHours }),
    [agreement, timelineEntries, educationHours],
  )
  const due = agreement ? nextVisitDue(agreement) : null
  const noActiveAgreement = !agreement || agreement.status !== 'active'

  /** Lidé ve spisu s datem „naposledy osobně". Tohle je jádro nového
   * profilu: telefon se nemění a nikdo ho v profilu nehledá, ale „koho
   * z nich jsem půl roku neviděl" se jinak nikde nedozví. */
  const people = useMemo(
    () =>
      [
        ...fosterPersons.map(({ docId: fpId, fosterPerson: fp }) => ({
          group: 'Pěstouni',
          kind: 'fosterPerson' as const,
          id: fpId,
          name: `${fp.firstName} ${fp.lastName}`,
          age: ageYears(fp.birthDate),
          contact: fp.phone ?? fp.email ?? null,
          avatarUrl: fp.avatarUrl ?? null,
          href: `/rodiny/${familyUid}/pestoun/${fpId}`,
          lastSeen: lastSeenInPerson(timelineEntries, { kind: 'fosterPerson', id: fpId }),
        })),
        ...children.map(({ docId: childId, child }) => ({
          group: 'Děti v péči',
          kind: 'child' as const,
          id: childId,
          name: `${child.firstName} ${child.lastName}`,
          age: ageYears(child.birthDate),
          contact: null,
          avatarUrl: child.avatarUrl ?? null,
          href: `/rodiny/${familyUid}/dite/${childId}`,
          lastSeen: lastSeenInPerson(timelineEntries, { kind: 'child', id: childId }),
        })),
      ] as const,
    [fosterPersons, children, timelineEntries, familyUid],
  )

  /** Kdo je nejdéle bez osobního kontaktu. Kdyby to na obrazovce nebylo,
   * musel by si to člověk odvodit ze pěti řádků — a proto se to zapomíná. */
  const longestUnseen = people.reduce<(typeof people)[number] | null>((worst, person) => {
    if (!person.lastSeen) return person
    if (!worst) return person
    if (!worst.lastSeen) return worst
    return person.lastSeen < worst.lastSeen ? person : worst
  }, null)

  /** Zápisy po měsících. Skupina se nekreslí jako rám, jen jako tichý
   * popisek — dělí to čas, ne obsah. */
  const entriesByMonth = useMemo(() => {
    const map = new Map<string, typeof timelineEntries>()
    for (const item of [...timelineEntries].sort((a, b) => b.entry.occurredAt.localeCompare(a.entry.occurredAt))) {
      const key = new Date(item.entry.occurredAt).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
    return [...map]
  }, [timelineEntries])


  /* Rodina, která pod tímhle `uid` neexistuje (nebo na ni tahle organizace
     nevidí). Vlastní obrazovka, ne jedna větička: člověk se sem dostane
     z odkazu ve zprávě nebo ze zálohy prohlížeče a potřebuje vědět, kam dál. */
  if (notFound) {
    return (
      <AppShell
        pageContext={
          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link to="/rodiny" className="text-text-tertiary transition-colors duration-150 hover:text-text-primary">
              Rodiny
            </Link>
            <span className="text-text-faint">/</span>
            <span className="text-text-primary">Nenalezeno</span>
          </nav>
        }
      >
        <div className="mx-auto max-w-[560px] py-16 text-center">
          <h1 className="text-xl text-text-primary">Tenhle spis jsme nenašli</h1>
          <p className="mt-2 text-base text-text-secondary">
            Spis {familyUid} v téhle organizaci neexistuje, nebo na něj nevidíte. Zkontrolujte odkaz, nebo rodinu
            najděte v seznamu.
          </p>
          <Link
            to="/rodiny"
            className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary-hover"
          >
            Zpátky na Rodiny
          </Link>
        </div>
      </AppShell>
    )
  }

  const sidePanel =
    panelMode === 'foster' ? (
      <SidePanel title="Přidat pěstouna" onClose={() => setPanelMode(null)}>
        <form onSubmit={handleAddFoster} className="flex flex-col gap-4">
          <div className="sp__group">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
              <Input required autoFocus value={fosterFirstName} onChange={(e) => setFosterFirstName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Příjmení</span>
              <Input required value={fosterLastName} onChange={(e) => setFosterLastName(e.target.value)} />
            </label>
          </div>
          <div className="sp__group">
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
          <div className="sp__group">
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

  const quietAction =
    'flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-overlay-active disabled:opacity-50'

  /* Souhrnný pás „stav spisu" — z reference: hned pod jménem řada
     kontrolních bodů, každý s ikonou a jednou hodnotou. Odpovídá na „je něco
     v nepořádku?" bez rolování. */
  const checks: Array<{ tone: 'ok' | 'blizko' | 'po'; label: string; value: string }> = []
  if (noActiveAgreement) {
    checks.push({ tone: 'po', label: 'Dohoda', value: agreement ? 'Ukončená' : 'Chybí' })
  } else {
    checks.push({
      tone: 'ok',
      label: 'Dohoda',
      value: `Aktivní od ${new Date(agreement.validFrom).toLocaleDateString('cs-CZ')}`,
    })
  }
  if (due) {
    checks.push({
      tone: due.overdue ? 'po' : due.daysLeft <= 14 ? 'blizko' : 'ok',
      label: 'Osobní návštěva',
      value: due.overdue
        ? `Po termínu o ${dayCount(due.daysLeft)}`
        : due.daysLeft === 0
          ? 'Termín je dnes'
          : `Zbývá ${dayCount(due.daysLeft)}`,
    })
  }
  for (const limit of limits) {
    if (limit.id === 'navsteva') continue
    checks.push({
      tone: limit.tone,
      label: limit.label,
      value: `${limit.state} (${limit.done} / ${limit.target} ${limit.unit})`,
    })
  }
  if (longestUnseen) {
    checks.push({
      tone: longestUnseen.lastSeen === null ? 'po' : daysAgo(longestUnseen.lastSeen) > 90 ? 'blizko' : 'ok',
      label: 'Nejdéle bez osobního kontaktu',
      value:
        longestUnseen.lastSeen === null
          ? `${longestUnseen.name} — nikdy`
          : `${longestUnseen.name} — ${dayCount(daysAgo(longestUnseen.lastSeen))}`,
    })
  }
  checks.push({
    tone: 'ok',
    label: 'Klíčová osoba',
    value: agreement?.assignedTo
      ? (koOptions.find((k) => k.uid === agreement.assignedTo)?.displayName ?? 'Přiřazena')
      : 'Nepřiřazená',
  })

  return (
    <AppShell
      fullBleed
      sidePanel={sidePanel}
      /* Kontext a akce jdou do hlavičky appky (`TopBar`), ne do vlastní
         lišty pod ni — dvě vodorovné linky nad obsahem jsou 88 px chromu
         a nic navíc neřeknou. */
      pageContext={
        <nav className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link to="/rodiny" className="shrink-0 text-text-tertiary transition-colors duration-150 hover:text-text-primary">
            Rodiny
          </Link>
          <span className="text-text-faint">/</span>
          <span className="truncate text-text-primary">{displayName}</span>
        </nav>
      }
      pageActions={
        <>
          <button
            type="button"
            onClick={() => navigate(`/rodiny/${familyUid}/navsteva`)}
            disabled={noActiveAgreement}
            title={noActiveAgreement ? NO_ACTIVE_AGREEMENT_REASON : 'Spustit návštěvu'}
            className={quietAction}
          >
            <Clock size={16} />
            Návštěva
          </button>
          <button
            type="button"
            onClick={() => docId && openRecorderFor({ kind: 'family', id: docId })}
            disabled={noActiveAgreement}
            title={noActiveAgreement ? NO_ACTIVE_AGREEMENT_REASON : undefined}
            className="ml-1 flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm text-primary-foreground transition-colors duration-150 hover:bg-primary-hover disabled:opacity-50"
          >
            <Mic size={16} />
            Zapsat
          </button>
        </>
      }
    >
      <div className="sp sp__page flex h-full min-w-0 flex-1">
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          <div className="sp__sections">
            {/* ---------- HLAVIČKA A STAV SPISU ---------- */}
            <header id="prehled" className="sp__card sp__card--pad">
              <div className="flex items-start gap-4">
                {docId && family && (
                  <EditableAvatar
                    kind="family"
                    id={docId}
                    photoURL={family.avatarUrl}
                    label={displayName}
                    fallbackIcon={UserRound}
                    size="sm"
                    onUploaded={(url) => setFamily((prev) => (prev ? { ...prev, avatarUrl: url } : prev))}
                  />
                )}
                <div className="min-w-0 flex-1">
                  {editingName ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        autoFocus
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        className="h-10 w-72"
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
                      <h1 className="min-w-0 truncate text-2xl text-text-primary">{displayName}</h1>
                      <button
                        type="button"
                        onClick={startEditName}
                        aria-label="Upravit název rodiny"
                        title="Upravit název rodiny"
                        className="shrink-0 text-text-faint transition-colors duration-150 hover:text-text-primary"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-text-tertiary">
                    <span>Spis {familyUid}</span>
                    {family?.address && (
                      <>
                        <span>·</span>
                        <AddressLink address={family.address} />
                      </>
                    )}
                  </p>
                </div>
              </div>

              {error && (
                <p className="mt-4 text-sm text-danger" role="alert">
                  {error}
                </p>
              )}

              {/* Kontrolní body — celý stav spisu na jeden pohled. */}
              <div className="sp__checks mt-4 border-t border-border-subtle pt-2">
                {checks.map((check) => (
                  <SpisCheck key={check.label} tone={check.tone} label={check.label} value={check.value} />
                ))}
              </div>

              {/* Jediná věta, kvůli které se profil otevírá, a akce k ní. */}
              {noActiveAgreement ? (
                <div className="mt-4 border-t border-border-subtle pt-4">
                  <p className="text-base text-text-primary">Rodina nemá s vaší organizací aktivní Dohodu.</p>
                  <p className="mt-1 text-sm text-text-tertiary">
                    Bez ní nejde uložit zápis ani spustit návštěvu — a lhůty se nemají z čeho počítat.
                  </p>
                  <Link
                    to={`/rodiny/${familyUid}/dohoda`}
                    className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary-hover"
                  >
                    {agreement ? 'Otevřít Dohodu' : 'Založit Dohodu'}
                  </Link>
                </div>
              ) : (
                due && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
                    <p className="text-base text-text-primary">
                      {due.overdue
                        ? `Osobní návštěva je po termínu o ${dayCount(due.daysLeft)}.`
                        : due.daysLeft === 0
                          ? 'Termín osobní návštěvy je dnes.'
                          : `Do termínu osobní návštěvy zbývá ${dayCount(due.daysLeft)}.`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => docId && openRecorderFor({ kind: 'family', id: docId })}
                        className="flex h-9 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary-hover"
                      >
                        Zapsat návštěvu
                      </button>
                      <button type="button" onClick={() => navigate('/kalendar')} className={quietAction}>
                        Naplánovat na {shortDate(due.at)}
                      </button>
                    </div>
                  </div>
                )
              )}
            </header>

            {/* ---------- DOHODA ---------- */}
            {agreement && (
              <SpisSection
                id="dohoda"
                title="Dohoda"
                description="Podmínky, ze kterých se počítají všechny lhůty."
                actions={
                  <Link
                    to={`/rodiny/${familyUid}/dohoda`}
                    className="text-sm text-text-tertiary transition-colors duration-150 hover:text-text-primary"
                  >
                    Otevřít Dohodu
                  </Link>
                }
              >
                <PropertyList>
                  <PropertyRow label="Klíčová osoba">
                    {agreement.assignedTo ? (
                      <PersonLink
                        kind="staff"
                        id={agreement.assignedTo}
                        name={koOptions.find((k) => k.uid === agreement.assignedTo)?.displayName ?? agreement.assignedTo}
                      />
                    ) : (
                      <PropertyEmpty />
                    )}
                  </PropertyRow>
                  <PropertyRow label="Platí od">
                    {new Date(agreement.validFrom).toLocaleDateString('cs-CZ')}
                  </PropertyRow>
                  <PropertyRow label="Typ péče">{CARE_TYPE_LABELS[agreement.careType]}</PropertyRow>
                  <PropertyRow label="Interval návštěv">{dayCount(agreement.visitIntervalDays)}</PropertyRow>
                  {/* Cíl hodin je v Dohodě, ale u starších záznamů chybět
                      může — pak se dopočítá z typu péče, protože ho určuje
                      zákon (24 h zprostředkovaná, 18 h příbuzenská). */}
                  <PropertyRow label="Vzdělávání">
                    {agreement.educationHoursTarget ?? EDUCATION_HOURS_TARGET[agreement.careType]} h / 12 měsíců
                  </PropertyRow>
                  {family && family.fosterPersonRefs.length >= 2 && (
                    <PropertyRow label="Sdílení zápisů" align="right">
                      <Switch
                        checked={family.partnerSharingDefault ?? true}
                        onChange={handlePartnerSharingDefaultChange}
                        label="Nové zápisy výchozí sdílet s oběma pěstouny"
                        showLabel={false}
                      />
                    </PropertyRow>
                  )}
                  {allProps && (
                    <>
                      <PropertyRow label="Poslední návštěva">
                        {agreement.lastVisitAt ? (
                          new Date(agreement.lastVisitAt).toLocaleDateString('cs-CZ')
                        ) : (
                          <PropertyEmpty />
                        )}
                      </PropertyRow>
                      <PropertyRow label="Zápis z návštěvy">do {agreement.noteDeadlineHours || 72} h</PropertyRow>
                      <PropertyRow label="Adresa">
                        {family?.address ? <AddressLink address={family.address} /> : <PropertyEmpty />}
                      </PropertyRow>
                    </>
                  )}
                </PropertyList>
                <button
                  type="button"
                  onClick={() => setAllProps((v) => !v)}
                  className="flex h-11 items-center gap-1.5 text-sm text-text-faint transition-colors duration-150 hover:text-text-secondary"
                >
                  <ChevronDown size={15} className={allProps ? 'rotate-180' : undefined} />
                  {allProps ? 'Skrýt další podmínky' : 'Zobrazit další podmínky'}
                </button>
              </SpisSection>
            )}

            {/* ---------- LIDÉ ---------- */}
            <SpisSection
              id="lide"
              title="Lidé"
              description="Kdo do rodiny patří — a kdy ho někdo naposledy viděl osobně."
              count={people.length}
            >
              <DataLabels variant="lide">
                <span>Jméno</span>
                <span className="sp__col--vek">Věk</span>
                <span className="sp__col--kontakt">Kontakt</span>
                <span className="text-right">Naposledy osobně</span>
                <span />
              </DataLabels>

              {(['Pěstouni', 'Děti v péči'] as const).map((group) => {
                const rows = people.filter((p) => p.group === group)
                return (
                  <div key={group}>
                    <SpisGroupLabel label={group} count={rows.length} />
                    {rows.length === 0 ? (
                      <p className="pb-3 text-sm text-text-faint">
                        {group === 'Pěstouni' ? 'Zatím žádní pěstouni.' : 'Zatím žádné svěřené děti.'}
                      </p>
                    ) : (
                      rows.map((person) => (
                        <DataRow key={person.id} variant="lide" onOpen={() => navigate(person.href)}>
                          <span className="flex min-w-0 items-center gap-3">
                            <EntityAvatar
                              photoURL={person.avatarUrl}
                              label={person.name}
                              size="sm"
                              onQuickRecord={() => openRecorderFor({ kind: person.kind, id: person.id })}
                              quickRecordDisabledReason={noActiveAgreement ? NO_ACTIVE_AGREEMENT_REASON : undefined}
                            />
                            <span className="truncate text-base text-text-primary">{person.name}</span>
                          </span>
                          <span className="sp__col--vek text-sm text-text-tertiary">
                            {person.age === null ? '—' : `${person.age} let`}
                          </span>
                          <span className="sp__col--kontakt truncate text-sm text-text-tertiary">
                            {person.contact ?? '—'}
                          </span>
                          <span className="text-right text-sm">
                            {person.lastSeen === null ? (
                              <span className="text-accent">nikdy osobně</span>
                            ) : (
                              <>
                                <span className="text-text-primary">{shortDate(person.lastSeen)}</span>
                                <span className="ml-2 text-text-faint">{dayCount(daysAgo(person.lastSeen))}</span>
                              </>
                            )}
                          </span>
                          <span className="sp__reveal sp__col--rev flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              title="Přiřadit spolupracovníkovi"
                              onClick={(e) => {
                                e.stopPropagation()
                                setAssigningEntity({
                                  entityType: person.kind,
                                  entityId: person.id,
                                  label: person.name,
                                })
                              }}
                              className="flex size-7 items-center justify-center rounded-md text-text-tertiary hover:bg-overlay-active hover:text-text-primary"
                            >
                              <UserSquare2 size={15} />
                            </button>
                            <ChevronRight size={16} className="text-text-tertiary" />
                          </span>
                        </DataRow>
                      ))
                    )}
                  </div>
                )
              })}

              <DataAddRow label="Přidat pěstouna" onClick={() => setPanelMode('foster')} />
              <DataAddRow label="Přidat dítě do péče" onClick={() => setPanelMode('child')} />
            </SpisSection>

            {/* ---------- LHŮTY A LIMITY ---------- */}
            <SpisSection
              id="lhuty"
              title="Lhůty a limity"
              description="Počítá se z Dohody, ze zápisů a z délky vzdělávacích událostí. Nic se sem nepíše ručně."
            >
              {limits.length === 0 ? (
                <p className="py-4 text-sm text-text-faint">Bez aktivní Dohody se lhůty nemají z čeho počítat.</p>
              ) : (
                limits.map((limit) => <LimitRow key={limit.id} limit={limit} />)
              )}
            </SpisSection>

            {/* ---------- ZÁPISY ---------- */}
            <SpisSection
              id="zapisy"
              title="Zápisy"
              description="Celá historie rodiny: návštěvy, telefonáty, poznámky. Kliknutí otevře záznam vedle seznamu."
              count={timelineEntries.length}
            >
              {/* Psaní zápisu je nad rodinou nejčastější práce — patří NAD
                  seznam, ne za tlačítko v hlavičce. */}
              <button
                type="button"
                onClick={() => docId && openRecorderFor({ kind: 'family', id: docId })}
                disabled={noActiveAgreement}
                title={noActiveAgreement ? NO_ACTIVE_AGREEMENT_REASON : undefined}
                className="mt-3 flex h-11 w-full items-center gap-2 rounded-md border border-border-default px-3 text-left text-sm text-text-faint transition-colors duration-150 hover:border-border-strong disabled:opacity-50"
              >
                <Mic size={16} className="shrink-0" />
                <span className="flex-1">Napsat nebo nadiktovat zápis…</span>
              </button>

              <DataLabels variant="zapis">
                <span className="sp__col--when text-right">Kdy</span>
                <span>Zápis</span>
                <span className="sp__col--subjects">Koho se týká</span>
                <span className="sp__col--author">Kdo</span>
                <span />
              </DataLabels>

              {timelineEntries.length === 0 ? (
                <p className="py-4 text-sm text-text-faint">Zatím žádné zápisy.</p>
              ) : (
                entriesByMonth.map(([month, items]) => (
                  <div key={month}>
                    <SpisGroupLabel label={month} count={items.length} />
                    {items.map(({ docId: entryId, entry }) => {
                      const Icon = TIMELINE_TYPE_ICONS[entry.type]
                      const at = new Date(entry.occurredAt)
                      const subjectLinks = renderSubjectLinks(entry.subjectRefs)
                      return (
                        <DataRow
                          key={entryId}
                          variant="zapis"
                          onOpen={() => setSelectedEntry({ docId: entryId, entry })}
                        >
                          <span className="sp__col--when text-right">
                            <span className="block text-sm text-text-primary">{shortDate(at)}</span>
                            <span className="block text-2xs text-text-faint">
                              {at.toLocaleDateString('cs-CZ', { weekday: 'short' })}
                            </span>
                          </span>
                          <span className="flex min-w-0 items-start gap-3">
                            <Icon size={16} className="mt-0.5 shrink-0 text-text-faint" />
                            <span className="min-w-0">
                              <span className="block truncate text-base text-text-primary">
                                {entry.body?.trim() || TIMELINE_TYPE_LABELS[entry.type]}
                              </span>
                              <span className="block truncate text-sm text-text-tertiary">
                                {TIMELINE_TYPE_LABELS[entry.type]}
                              </span>
                            </span>
                          </span>
                          <span className="sp__col--subjects flex min-w-0 items-center gap-1.5 text-sm">
                            {/* JEDNO jméno celé + počet zbytku. Dvě zkrácená
                                jména („Jana Nov… Dominik No…") jsou horší než
                                jedno čitelné a „+1" — chip je od toho, aby se
                                dal přečíst, ne aby vyplnil sloupec. */}
                            {subjectLinks.slice(0, 1).map(({ key, node }) => (
                              <span key={key} className="truncate rounded-sm bg-overlay-active px-2 py-0.5">
                                {node}
                              </span>
                            ))}
                            {subjectLinks.length > 1 && (
                              <span className="shrink-0 text-text-faint">+{subjectLinks.length - 1}</span>
                            )}
                          </span>
                          <span className="sp__col--author truncate text-sm text-text-tertiary">
                            {resolveAuthorName(entry.createdByUid)
                              .split(' ')
                              .map((part) => part[0])
                              .join('')}
                          </span>
                          <DataRowReveal />
                        </DataRow>
                      )
                    })}
                  </div>
                ))
              )}
            </SpisSection>

            {/* ---------- KALENDÁŘ ---------- */}
            <SpisSection
              id="kalendar"
              title="Kalendář"
              description="Co se blíží a co proběhlo — jen události téhle rodiny."
              lazy
              actions={
                <button type="button" onClick={() => navigate('/kalendar')} className={quietAction}>
                  Otevřít celý kalendář
                </button>
              }
            >
              {docId && organizationId && (
                <EntityAgenda organizationId={organizationId} subjectKind="family" subjectId={docId} />
              )}
            </SpisSection>

            {/* ---------- ÚKOLY ---------- */}
            <SpisSection
              id="ukoly"
              title="Úkoly"
              description="Co je k téhle rodině potřeba udělat."
              lazy
              padded
            >
              {docId && organizationId && (
                <EntityTasks
                  organizationId={organizationId}
                  subjectKind="family"
                  subjectId={docId}
                  staffNames={staffNamesByUid}
                />
              )}
            </SpisSection>

            {/* ---------- RESPIT A ASISTOVANÝ KONTAKT ----------
                Zůstává na rodině, ne na dítěti: respit typicky pokrývá víc
                dětí najednou a nedá se čistě rozdělit. */}
            <SpisSection
              id="pece"
              title="Respit a kontakt"
              description="Nárok pěstouna na odpočinek a opakovaný styk dítěte s biologickou rodinou."
              lazy
              padded
            >
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
            </SpisSection>

            {/* ---------- DOKUMENTY ---------- */}
            <SpisSection
              id="dokumenty"
              title="Dokumenty"
              description="Koncepty a hotové dokumenty ke spisu, včetně reportu pro OSPOD."
              count={documents.length}
              lazy
            >
              {showDocumentForm && (
                <form
                  onSubmit={handleCreateDocument}
                  className="mt-4 flex flex-col gap-4 border-t border-border-subtle pt-4"
                >
                  <label className="flex max-w-[560px] flex-col gap-1.5">
                    <span className="text-sm font-medium text-text-primary">Název</span>
                    <Input required value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-text-primary">Obsah</span>
                    <RichTextEditor
                      value={docBody}
                      onChange={setDocBody}
                      minHeight={220}
                      placeholder="Začněte psát obsah dokumentu…"
                    />
                  </label>
                  {recordablePeople.length > 0 && (
                    <div>
                      <p className="text-sm text-text-tertiary">Zařadit k (volitelné)</p>
                      <div className="mt-2 flex flex-wrap gap-2">
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
                                  ? 'inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground'
                                  : 'inline-flex h-8 items-center rounded-md border border-border-default px-3 text-sm text-text-secondary hover:border-border-strong'
                              }
                            >
                              {p.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" loading={creatingDocument} success={creatingDocumentSuccess} className="w-fit">
                      Založit koncept
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowDocumentForm(false)}>
                      Zrušit
                    </Button>
                  </div>
                </form>
              )}

              {documents.length === 0 ? (
                <p className="py-4 text-sm text-text-faint">Zatím žádné dokumenty.</p>
              ) : (
                documents.map(({ docId: fdId, document: fd }) => (
                  <DataRow
                    key={fdId}
                    variant="blizi"
                    onOpen={() => navigate(`/rodiny/${familyUid}/dokumenty/${fdId}`)}
                  >
                    <span className="sp__col--when text-right text-sm text-text-faint">v{fd.currentVersion}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-base text-text-primary">{fd.title}</span>
                      <span className="block truncate text-sm text-text-tertiary">{fd.uid}</span>
                    </span>
                    <span className="sp__col--subjects text-sm text-text-tertiary">
                      {DOCUMENT_STATUS_LABELS[fd.status]}
                    </span>
                    <DataRowReveal />
                  </DataRow>
                ))
              )}

              <DataAddRow
                label="Nový dokument"
                onClick={() => setShowDocumentForm((v) => !v)}
                disabled={noActiveAgreement}
                title={noActiveAgreement ? NO_ACTIVE_AGREEMENT_REASON : undefined}
              />

              {docId && organizationId && userDoc && (
                <div className="border-t border-border-subtle pt-2">
                  <OspodReportSection
                    familyDocId={docId}
                    familyUid={familyUid ?? ''}
                    organizationId={organizationId}
                    createdByUid={userDoc.uid}
                    childIds={children.map((c) => c.docId)}
                    fosterPersons={fosterPersons}
                  />
                </div>
              )}
            </SpisSection>

            {/* ---------- CHAT ---------- */}
            <SpisSection
              id="chat"
              title="Chat"
              description="Zprávy, které vidí i pěstoun na svém portálu."
              lazy
              padded
            >
              {docId && organizationId && userDoc && (
                <FamilyChatSection
                  familyDocId={docId}
                  organizationId={organizationId}
                  currentUid={userDoc.uid}
                  staffList={staffList}
                />
              )}
            </SpisSection>
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
