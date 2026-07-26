import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { PageBody, PageHead } from '@/components/spis/PageBody'
import { SidePanel } from '@/components/ui/side-panel'
import { ViewMenu } from '@/components/ui/view-menu'
import { RecordCard, RecordCardList, RecordGroup } from '@/components/ui/record-card'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Combobox } from '@/components/ui/combobox'
import { Modal } from '@/components/ui/modal'
import { AlertTag } from '@/components/ui/alert-tag'
import { AddressLink } from '@/components/ui/address-link'
import { VoiceRecorderPanel, type RecordablePerson } from '@/components/timeline/VoiceRecorderPanel'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { getOrganization } from '@/services/organizationService'
import {
  createFamily,
  listChildrenForFamily,
  listFamiliesWithDocIds,
  listFosterPersonsByRefs,
} from '@/services/familyService'
import {
  listActiveAgreementsForOrg,
  listArchivedFamilyIds,
  updateAgreementAssignedTo,
} from '@/services/agreementService'
import { listStaff } from '@/services/staffService'
import { listStarredFamilyIds, setFamilyStarred } from '@/services/familyStarService'
import { createNoteTimelineEntry } from '@/services/timelineService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import {
  computeAgreementExpiryTier,
  computeVisitAlertTier,
  daysSince,
  pickWorstAlert,
  type ActiveFamilyAlert,
  type FamilyAlert,
} from '@/lib/familyAlertStatus'
import type { FamilyDoc } from '@/types/family'
import type { AgreementDoc } from '@/types/agreement'
import type { UserDoc } from '@/types/user'
import type { SubjectRef } from '@/types/timelineEntry'
import { Mic, Plus, Star, Users } from '@/components/ui/icons'
import { Textarea } from '@/components/ui/textarea'

const SORT_OPTIONS = [
  { value: 'adresa' as const, label: 'Adresa' },
  { value: 'dotek' as const, label: 'Poslední kontakt' },
  { value: 'navsteva' as const, label: 'Poslední návštěva' },
]
type SortBy = (typeof SORT_OPTIONS)[number]['value']

/**
 * SESKUPENÍ (Routine: jejich tabulka dělí řádky do „Leads 6" / „Qualified 7").
 *
 * Rozdíl proti řazení je v tom, na co seznam odpovídá. Řazený podle data říká
 * „tady je dvanáct rodin". Seskupený podle lhůty říká „tři hoří, dvě se
 * blíží, sedm je v pořádku" — a s tou otázkou tam člověk chodí.
 *
 * Výchozí je proto STAV, ne „bez seskupení".
 */
const GROUP_OPTIONS = [
  { value: 'stav' as const, label: 'Stav' },
  { value: 'ko' as const, label: 'Klíčová osoba' },
  { value: 'zadne' as const, label: 'Bez seskupení' },
]
type GroupBy = (typeof GROUP_OPTIONS)[number]['value']

/** Skupiny podle lhůty. Pořadí je od nejnaléhavější — ne abecedně. */
const STAV_BUCKETS: Array<{ key: string; label: string; tone: 'hot' | 'warm' | 'calm' }> = [
  { key: 'crisis', label: 'Po termínu', tone: 'hot' },
  { key: 'warning', label: 'Naléhavé', tone: 'hot' },
  { key: 'waiting', label: 'Blíží se', tone: 'warm' },
  { key: 'ok', label: 'V pořádku', tone: 'calm' },
]

interface FamilyRow {
  docId: string
  family: FamilyDoc
  displayName: string
  agreement: AgreementDoc | null
  assignedToDisplay: string | null
  alert: ActiveFamilyAlert | null
}

/**
 * /rodiny — název rodiny je displayName → primární pěstoun → adresa
 * (`resolveFamilyDisplayName`). Hvězdička je osobní (`familyStarService.ts`),
 * checkbox slouží hromadným akcím. Sloupec klíčové osoby se schová, pokud
 * je KO přihlášený uživatel sám. "Hoří?" štítek viz `familyAlertStatus.ts`.
 */
export default function FamilyListPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }> | null>(null)
  const [archivedCount, setArchivedCount] = useState(0)
  const [fosterNamesById, setFosterNamesById] = useState<Record<string, string>>({})
  const [agreementsByFamilyId, setAgreementsByFamilyId] = useState<Record<string, AgreementDoc>>({})
  const [staff, setStaff] = useState<UserDoc[]>([])
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { loading: submitting, success, run } = useAsyncSubmit()
  const [address, setAddress] = useState('')
  const [recorderState, setRecorderState] = useState<{ docId: string; people: RecordablePerson[] } | null>(null)
  const [recorderLoadingDocId, setRecorderLoadingDocId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('adresa')
  const [groupBy, setGroupBy] = useState<GroupBy>('stav')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const { loading: noteSubmitting, success: noteSuccess, run: runNote } = useAsyncSubmit()
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [reassignTarget, setReassignTarget] = useState('')
  const { loading: reassignSubmitting, success: reassignSuccess, run: runReassign } = useAsyncSubmit()

  const organizationId = userDoc?.organizationId

  const staffByUid = useMemo(() => Object.fromEntries(staff.map((s) => [s.uid, s])), [staff])
  const koOptions = useMemo(
    () =>
      staff.filter((s) =>
        (['klicova_osoba', 'asistent_ko', 'vedouci_pobocky', 'teamleader', 'org_admin'] as const).includes(
          s.role as never,
        ),
      ),
    [staff],
  )

  async function reload() {
    if (!organizationId || !userDoc) return
    setError(null)
    try {
      const familyList = await listFamiliesWithDocIds(organizationId)
      const allFosterRefs = [...new Set(familyList.flatMap(({ family }) => family.fosterPersonRefs))]
      const [fosters, agreements, staffList, starred, archived] = await Promise.all([
        listFosterPersonsByRefs(allFosterRefs),
        listActiveAgreementsForOrg(organizationId),
        listStaff(organizationId),
        listStarredFamilyIds(userDoc.uid),
        listArchivedFamilyIds(organizationId),
      ])
      // Archivované spisy se v běžném seznamu neobjeví — jsou v sekci
      // Archivováno. Filtruje se tady, ne až v `rows`, aby na nich
      // nestavěly ani počty a seskupení.
      setArchivedCount(familyList.filter(({ docId }) => archived.has(docId)).length)
      setFamilies(familyList.filter(({ docId }) => !archived.has(docId)))
      setFosterNamesById(
        Object.fromEntries(fosters.map(({ docId, fosterPerson }) => [docId, `${fosterPerson.firstName} ${fosterPerson.lastName}`])),
      )
      setAgreementsByFamilyId(agreements)
      setStaff(staffList)
      setStarredIds(new Set(starred))
    } catch {
      setError('Seznam rodin se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const rows = useMemo((): FamilyRow[] => {
    if (!families) return []
    const now = Date.now()
    return families.map(({ docId, family }) => {
      const primaryFosterName = family.fosterPersonRefs[0] ? fosterNamesById[family.fosterPersonRefs[0]] ?? null : null
      const displayName = resolveFamilyDisplayName(family, primaryFosterName)
      const agreement = agreementsByFamilyId[docId] ?? null

      const assignedToDisplay =
        agreement?.assignedTo && agreement.assignedTo !== userDoc?.uid
          ? staffByUid[agreement.assignedTo]?.displayName ?? agreement.assignedTo
          : null

      const alerts: FamilyAlert[] = []
      if (agreement) {
        const visitTier = computeVisitAlertTier(daysSince(agreement.lastVisitAt, now), agreement.visitIntervalDays)
        if (visitTier !== 'ok') alerts.push({ tier: visitTier, reason: 'Návštěva', action: 'Naplánovat návštěvu' })
        const expiryTier = computeAgreementExpiryTier(agreement.validTo, now)
        if (expiryTier !== 'ok') alerts.push({ tier: expiryTier, reason: 'Konec Dohody', action: 'Prodloužit Dohodu' })
      }

      return { docId, family, displayName, agreement, assignedToDisplay, alert: pickWorstAlert(alerts) }
    })
  }, [families, fosterNamesById, agreementsByFamilyId, staffByUid, userDoc?.uid])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    if (sortBy === 'adresa') {
      copy.sort((a, b) => (a.family.address ?? '').localeCompare(b.family.address ?? '', 'cs'))
    } else if (sortBy === 'dotek') {
      copy.sort((a, b) => daysSince(b.family.lastTouchAt, Date.now()) - daysSince(a.family.lastTouchAt, Date.now()))
    } else {
      copy.sort(
        (a, b) =>
          daysSince(b.agreement?.lastVisitAt, Date.now()) - daysSince(a.agreement?.lastVisitAt, Date.now()),
      )
    }
    return copy
  }, [rows, sortBy])

  /** Řádek v seznamu nemá pěstouny/děti předem načtené (jen jejich počet) —
   * "Zařadit k" (VoiceRecorderPanel) potřebuje skutečné osoby, takže se
   * dotáhnou až tady, na vyžádání (§10 provozní úspornost — ne pro každý
   * řádek dopředu). */
  async function handleOpenRecorder(docId: string, family: FamilyDoc) {
    if (!organizationId) return
    setRecorderLoadingDocId(docId)
    setError(null)
    try {
      const [fosters, kids] = await Promise.all([
        listFosterPersonsByRefs(family.fosterPersonRefs),
        listChildrenForFamily(docId, organizationId),
      ])
      const people: RecordablePerson[] = [
        ...fosters.map(
          ({ docId: fpId, fosterPerson: fp }): RecordablePerson => ({
            kind: 'fosterPerson',
            id: fpId,
            label: `${fp.firstName} ${fp.lastName}`,
          }),
        ),
        ...kids.map(
          ({ docId: childId, child }): RecordablePerson => ({
            kind: 'child',
            id: childId,
            label: `${child.firstName} ${child.lastName}`,
          }),
        ),
      ]
      setRecorderState({ docId, people })
    } catch {
      setError('Osoby rodiny se nepodařilo načíst.')
    } finally {
      setRecorderLoadingDocId(null)
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!organizationId) return
    setError(null)
    try {
      await run(async () => {
        const org = await getOrganization(organizationId)
        if (!org) throw new Error('org not found')
        await createFamily(organizationId, org.orgCode, address || undefined)
        await reload()
      })
      setAddress('')
      setShowForm(false)
    } catch {
      setError('Založení rodiny se nezdařilo.')
    }
  }

  function toggleSelected(docId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }

  async function toggleStar(docId: string) {
    if (!userDoc) return
    const willBeStarred = !starredIds.has(docId)
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (willBeStarred) next.add(docId)
      else next.delete(docId)
      return next
    })
    try {
      await setFamilyStarred(userDoc.uid, docId, willBeStarred)
    } catch {
      // Optimistická změna se při chybě vrátí zpět — hvězdička není kritická
      // data, další reload seznamu ji stejně dorovná ze skutečného stavu.
      setStarredIds((prev) => {
        const next = new Set(prev)
        if (willBeStarred) next.delete(docId)
        else next.add(docId)
        return next
      })
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault()
    if (!organizationId || !userDoc || !noteText.trim()) return
    setError(null)
    try {
      await runNote(async () => {
        await Promise.all(
          [...selected].map((docId) =>
            createNoteTimelineEntry({
              familyDocId: docId,
              organizationId,
              createdByUid: userDoc.uid,
              subjectRefs: [{ kind: 'family', id: docId } satisfies SubjectRef],
              sharingLevel: 'internal',
              body: noteText,
            }),
          ),
        )
        await reload()
      })
      setNoteText('')
      setNoteModalOpen(false)
      setSelected(new Set())
    } catch {
      setError('Poznámku se nepodařilo přidat všem označeným rodinám.')
    }
  }

  async function handleReassign(e: FormEvent) {
    e.preventDefault()
    if (!organizationId || !reassignTarget) return
    setError(null)
    try {
      await runReassign(async () => {
        const targets = sortedRows.filter((r) => selected.has(r.docId) && r.agreement)
        await Promise.all(targets.map((r) => updateAgreementAssignedTo(r.docId, organizationId, reassignTarget)))
        await reload()
      })
      setReassignModalOpen(false)
      setSelected(new Set())
    } catch {
      setError('Přeřazení se nepodařilo u všech označených rodin.')
    }
  }

  /*
    POZOR NA POŘADÍ: `columnPlan` i `groups` musí zůstat NAD `if
    (!organizationId) return` níž. Chvíli byly pod ním a je to stejná mina,
    na jakou 2026-07-25 spadl profil rodiny v produkci („Minified React error
    #300" — rendered fewer hooks than expected): jakmile funkce vyskočí dřív,
    hooky se nezavolají a React ztratí jejich pořadí. Hlídá to
    `npm run lint`.
  */
  /**
   * Sloupce podle seskupení. Sloupec, který nese totéž jako nadpis skupiny,
   * se nekreslí — a mřížka se musí zkrátit s ním, jinak zbude prázdný pruh
   * (přesně tuhle vadu měl seznam po prvním převodu na mřížku).
   */
  const columnPlan = useMemo(() => {
    if (groupBy === 'stav') {
      return {
        headers: ['Poslední kontakt', 'Klíčová osoba'],
        columns: {
          lg: 'minmax(220px,1fr) minmax(0,150px) minmax(0,180px)',
          md: 'minmax(200px,1fr) minmax(0,150px)',
          sm: 'minmax(160px,1fr) minmax(0,150px)',
        },
      }
    }
    if (groupBy === 'ko') {
      return {
        headers: ['Stav', 'Poslední kontakt'],
        columns: {
          lg: 'minmax(220px,1fr) minmax(0,130px) minmax(0,150px)',
          md: 'minmax(200px,1fr) minmax(0,130px)',
          sm: 'minmax(160px,1fr) minmax(0,130px)',
        },
      }
    }
    return {
      headers: ['Stav', 'Poslední kontakt', 'Klíčová osoba'],
      columns: {
        lg: 'minmax(220px,1fr) minmax(0,130px) minmax(0,150px) minmax(0,180px)',
        md: 'minmax(200px,1fr) minmax(0,130px) minmax(0,150px)',
        sm: 'minmax(160px,1fr) minmax(0,130px)',
      },
    }
  }, [groupBy])

  /**
   * Seskupení řádků. Řazení zůstává v platnosti UVNITŘ skupiny — jsou to dvě
   * nezávislé věci: skupina odpovídá „co hoří", řazení „v jakém pořadí".
   *
   * Přišpendlené (hvězdička) jdou vždy první a mimo seskupení. Kdo si rodinu
   * označí, chce ji vidět hned, ne ji hledat ve skupině podle lhůty.
   */
  const groups = useMemo(() => {
    const pinned = sortedRows.filter((r) => starredIds.has(r.docId))
    const rest = sortedRows.filter((r) => !starredIds.has(r.docId))
    const head =
      pinned.length > 0 && groupBy !== 'zadne'
        ? [{ key: 'pinned', label: 'Přišpendlené', tone: 'calm' as const, rows: pinned }]
        : []

    if (groupBy === 'zadne') {
      return [{ key: 'vse', label: 'Vše', tone: 'calm' as const, rows: sortedRows }]
    }

    if (groupBy === 'ko') {
      const byKo = new Map<string, FamilyRow[]>()
      for (const row of rest) {
        const key = row.assignedToDisplay ?? 'Bez klíčové osoby'
        const list = byKo.get(key)
        if (list) list.push(row)
        else byKo.set(key, [row])
      }
      return [
        ...head,
        ...[...byKo.entries()]
          // „Bez klíčové osoby" nakonec — je to díra, ne osoba.
          .sort(([a], [b]) =>
            a === 'Bez klíčové osoby' ? 1 : b === 'Bez klíčové osoby' ? -1 : a.localeCompare(b, 'cs'),
          )
          .map(([label, rows]) => ({
            key: label,
            label,
            tone: (label === 'Bez klíčové osoby' ? 'warm' : 'calm') as 'warm' | 'calm',
            rows,
          })),
      ]
    }

    return [
      ...head,
      ...STAV_BUCKETS.map(({ key, label, tone }) => ({
        key,
        label,
        tone,
        rows: rest.filter((row) => (row.alert?.tier ?? 'ok') === key),
      })),
    ]
  }, [sortedRows, starredIds, groupBy])

  if (!organizationId) {
    return (
      <AppShell>
        <h1 className="text-2xl text-text-primary">Rodiny</h1>
        <p className="mt-4 text-sm text-text-secondary">
          Tahle stránka je pro zaměstnance konkrétní organizace.
        </p>
      </AppShell>
    )
  }

  const sidePanel = showForm && (
    <SidePanel title="Nová rodina" onClose={() => setShowForm(false)}>
      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium leading-relaxed text-text-primary">Adresa (volitelné)</span>
          <Input autoFocus value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <div className="flex gap-2 border-t border-border-default pt-4">
          <Button type="submit" loading={submitting} success={success}>
            Založit Spis
          </Button>
          <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>
            Zrušit
          </Button>
        </div>
      </form>
    </SidePanel>
  )



  /** Řádek seznamu. Vytažené z mapy, protože se teď vykresluje uvnitř
   * skupin (viz `groups`) — a stejná JSX na dvou místech je začátek
   * rozjezdu. */
  const renderRow = (row: FamilyRow, opts?: { alertInline?: boolean }) => {
              const { docId, family, displayName, assignedToDisplay, alert } = row
              return (
                <RecordCard
                  key={family.uid}
                  onClick={() => navigate(`/rodiny/${family.uid}`)}
                  leading={
                    <>
                      <input
                        type="checkbox"
                        checked={selected.has(docId)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleSelected(docId)
                        }}
                        className="size-4 shrink-0 rounded-sm border-border-medium accent-primary"
                      />
                      <EntityAvatar photoURL={family.avatarUrl} label={displayName} fallbackIcon={Users} />
                    </>
                  }
                  title={
                    // V přišpendlené skupině není sloupec „Stav" (nadpis skupiny
                    // říká „Přišpendlené", ne naléhavost), takže by u té jedné
                    // rodiny, kterou si člověk vytáhl nahoru, zmizela informace
                    // o tom, že hoří. Štítek jde proto k jménu.
                    opts?.alertInline && alert ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{displayName}</span>
                        <AlertTag tier={alert.tier} title={`${alert.reason} — ${alert.action}`} />
                      </span>
                    ) : (
                      displayName
                    )
                  }
                  subtitle={
                    family.address ? (
                      <AddressLink address={family.address} className="text-sm" />
                    ) : (
                      'Adresa neuvedena'
                    )
                  }
                  cells={[
                    // Pořadí = důležitost, ubývá se ZPRAVA (DESIGN_RULES.md §4).
                    // Stav je vedle jména schválně: seznam se skenuje kvůli
                    // "komu hoří", ne kvůli tomu, kdo je klíčová osoba.
                    //
                    // Když se ale seskupuje PODLE STAVU, sloupec zmizí: nadpis
                    // skupiny říká „Po termínu" a každý řádek pod ním by to
                    // opakoval ještě jednou. Totéž u klíčové osoby.
                    ...(groupBy === 'stav'
                      ? []
                      : [
                          {
                            label: 'Stav',
                            value: alert ? (
                              <AlertTag tier={alert.tier} title={`${alert.reason} — ${alert.action}`} />
                            ) : (
                              // Klidný stav nesmí soutěžit se štítkem naléhavosti.
                              <span className="text-text-tertiary">V pořádku</span>
                            ),
                          },
                        ]),
                    {
                      label: 'Poslední kontakt',
                      value: family.lastTouchAt ? new Date(family.lastTouchAt).toLocaleDateString('cs-CZ') : 'Nikdy',
                    },
                    ...(groupBy === 'ko' ? [] : [{ label: 'Klíčová osoba', value: assignedToDisplay || '—' }]),
                  ]}
                  trailing={
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleStar(docId)
                        }}
                        title={starredIds.has(docId) ? 'Odebrat hvězdičku' : 'Označit hvězdičkou'}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-tertiary hover:bg-overlay-active hover:text-text-primary"
                      >
                        <Star
                          size={16}
                          strokeWidth={2}
                          className={starredIds.has(docId) ? 'fill-current text-text-primary' : ''}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleOpenRecorder(docId, family)
                        }}
                        title={recorderLoadingDocId === docId ? 'Načítám…' : 'Nahrát hlasový zápis'}
                        disabled={recorderLoadingDocId === docId}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-tertiary opacity-0 transition-opacity hover:bg-danger-solid hover:text-white group-hover:opacity-100 disabled:opacity-40"
                      >
                        <Mic size={14} strokeWidth={2} />
                      </button>
                    </>
                  }
                />
              )
  }

  return (
    <AppShell fullBleed sidePanel={sidePanel}>
      <PageBody>
        {/* Hlavička je TATÁŽ komponenta jako na profilu rodiny — název, akce
            vpravo, pod linkou ovládání seznamu. */}
        <PageHead
          title="Rodiny"
          count={sortedRows.length || undefined}
          actions={
            <Button onClick={() => setShowForm(true)}>
              <Plus size={17} /> Nová rodina
            </Button>
          }
        >
            {error && (
              <p className="mb-3 max-w-xl text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            {/* Volby zobrazení jsou v JEDNOM tlačítku: trvale je vidět jen
                výsledek volby, ne všech šest možností. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ViewMenu
                groups={[
                  {
                    label: 'Seskupit',
                    value: groupBy,
                    options: GROUP_OPTIONS,
                    onChange: (v) => setGroupBy(v as GroupBy),
                  },
                  { label: 'Řadit', value: sortBy, options: SORT_OPTIONS, onChange: (v) => setSortBy(v as SortBy) },
                ]}
              />
              {/* Archiv se nepřipomíná sám od sebe — jen tichým počtem.
                  Kdyby byl vedle „Rodiny" jako záložka, tlačil by se do
                  pozornosti, a to je přesně to, čemu se archivací
                  vyhýbáme. */}
              {archivedCount > 0 && (
                <Link to="/archiv" className="text-sm text-text-tertiary hover:text-text-secondary">
                  Archivováno: {archivedCount}
                </Link>
              )}
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">Označeno: {selected.size}</span>
                  <Button variant="secondary" size="sm" onClick={() => setNoteModalOpen(true)}>
                    + Poznámka
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setReassignModalOpen(true)}>
                    Předat
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                    Zrušit výběr
                  </Button>
                </div>
              )}
            </div>
        </PageHead>

            {families === null ? (
              <p className="text-sm text-text-tertiary">Načítám…</p>
            ) : sortedRows.length === 0 ? (
              <div className="sp__card sp__card--pad">
                <EmptyState icon={Users} text="Zatím tu nejsou žádné rodiny." />
              </div>
            ) : (
              // Sloupce definuje SEZNAM (DESIGN_RULES.md §4) — pořadí buněk je
              // od nejdůležitější a na užších šířkách ubývají zprava:
              // Stav → Poslední kontakt → Klíčová osoba. Jméno nikdy.
              <RecordCardList
                cellCount={columnPlan.headers.length}
                headers={columnPlan.headers}
                lead={56}
                trail={64}
                columns={columnPlan.columns}
              >
                {groups.map(({ key, label, tone, rows: groupRows }) =>
                  groupRows.length === 0 ? null : groupBy === 'zadne' ? (
                    groupRows.map((row) => renderRow(row))
                  ) : (
                    <RecordGroup key={key} title={label} count={groupRows.length} tone={tone}>
                      {groupRows.map((row) =>
                        renderRow(row, { alertInline: key === 'pinned' && groupBy === 'stav' }),
                      )}
                    </RecordGroup>
                  ),
                )}
              </RecordCardList>
            )}
      </PageBody>

      {noteModalOpen && (
        <Modal onClose={() => setNoteModalOpen(false)}>
          <form onSubmit={handleAddNote} className="flex flex-col gap-4">
            <h2 className="text-base font-medium text-text-primary">
              Poznámka pro {selected.size} {selected.size === 1 ? 'rodinu' : 'rodin'}
            </h2>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Text poznámky</span>
              <Textarea
                required
                rows={4}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Např. byla oznámena dovolená klíčové osoby…"
              />
            </label>
            <p className="text-xs text-text-tertiary">
              Zobrazí se v časové ose všech označených rodin, jen týmu (interní).
            </p>
            <div className="flex gap-2">
              <Button type="submit" loading={noteSubmitting} success={noteSuccess}>
                Uložit poznámku
              </Button>
              <Button type="button" variant="ghost" onClick={() => setNoteModalOpen(false)} disabled={noteSubmitting}>
                Zrušit
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {reassignModalOpen && (
        <Modal onClose={() => setReassignModalOpen(false)}>
          <form onSubmit={handleReassign} className="flex flex-col gap-4">
            <h2 className="text-base font-medium text-text-primary">
              Předat {selected.size} {selected.size === 1 ? 'rodinu' : 'rodin'}
            </h2>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Nová klíčová osoba / vedení</span>
              <Combobox
                options={koOptions.map((k) => ({ value: k.uid, label: `${k.displayName} (${k.role})` }))}
                value={reassignTarget}
                onChange={setReassignTarget}
                placeholder="Vybrat…"
              />
            </label>
            <p className="text-xs text-text-tertiary">
              Rodiny bez vlastní Dohody vaší organizace se přeskočí — přeřazuje se KO na Dohodě, ne Spis samotný.
            </p>
            <div className="flex gap-2">
              <Button type="submit" loading={reassignSubmitting} success={reassignSuccess} disabled={!reassignTarget}>
                Předat
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setReassignModalOpen(false)}
                disabled={reassignSubmitting}
              >
                Zrušit
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {recorderState && organizationId && userDoc && (
        <VoiceRecorderPanel
          familyDocId={recorderState.docId}
          organizationId={organizationId}
          createdByUid={userDoc.uid}
          implicitSubjects={[{ kind: 'family', id: recorderState.docId } satisfies SubjectRef]}
          people={recorderState.people}
          preselectedPeopleKeys={recorderState.people.map((p) => `${p.kind}:${p.id}`)}
          onClose={() => setRecorderState(null)}
          onSaved={reload}
        />
      )}

    </AppShell>
  )
}
