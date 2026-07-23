import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Combobox } from '@/components/ui/combobox'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
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
import { listActiveAgreementsForOrg, updateAgreementAssignedTo } from '@/services/agreementService'
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
import { cn } from '@/lib/utils'
import { Mic, Plus, Star, Users } from 'lucide-react'

const TABLE_COLUMNS = '92px 2fr 130px 110px 110px 140px'
const SORT_OPTIONS = [
  { value: 'adresa' as const, label: 'Adresa' },
  { value: 'dotek' as const, label: 'Poslední kontakt' },
  { value: 'navsteva' as const, label: 'Poslední návštěva' },
]
type SortBy = (typeof SORT_OPTIONS)[number]['value']

interface FamilyRow {
  docId: string
  family: FamilyDoc
  displayName: string
  agreement: AgreementDoc | null
  assignedToDisplay: string | null
  alert: ActiveFamilyAlert | null
}

/**
 * /rodiny — M1 základ, rozšířeno UX zpětnou vazbou 2026-07-21: název rodiny
 * (displayName → primární pěstoun → adresa, `resolveFamilyDisplayName`),
 * checkbox+hvězdička místo avataru (hromadné akce "+ Poznámka"/"Předat",
 * hvězdička je OSOBNÍ — `familyStarService.ts`), sloupec klíčové osoby
 * (schovaný, pokud je KO přihlášený uživatel sám — "ví, že je to její
 * skupina"), segmentace (Adresa/Poslední kontakt/Poslední návštěva) a
 * "hoří?" štítek (`familyAlertStatus.ts`).
 */
export default function FamilyListPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }> | null>(null)
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
      setFamilies(familyList)
      const allFosterRefs = [...new Set(familyList.flatMap(({ family }) => family.fosterPersonRefs))]
      const [fosters, agreements, staffList, starred] = await Promise.all([
        listFosterPersonsByRefs(allFosterRefs),
        listActiveAgreementsForOrg(organizationId),
        listStaff(organizationId),
        listStarredFamilyIds(userDoc.uid),
      ])
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

  if (!organizationId) {
    return (
      <AppShell breadcrumb={[{ label: 'Rodiny' }]}>
        <h1 className="text-lg font-normal leading-normal text-text-primary">Rodiny</h1>
        <p className="mt-4 text-sm text-text-secondary">
          Tahle stránka je pro zaměstnance konkrétní organizace.
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumb={[{ label: 'Rodiny' }]}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-normal leading-normal text-text-primary">Rodiny</h1>
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? (
            'Zrušit'
          ) : (
            <>
              <Plus size={16} /> Nová rodina
            </>
          )}
        </Button>
      </div>

      {error && (
        <p className="mt-3 max-w-[928px] text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 flex max-w-[560px] flex-col gap-4 rounded-lg border border-border bg-surface p-5"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">
              Adresa (volitelné)
            </span>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <Button type="submit" loading={submitting} success={success} className="w-fit">
            Založit Spis
          </Button>
        </form>
      )}

      <div className="mt-6 flex max-w-[928px] items-center justify-between gap-4">
        <SegmentedTabs options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
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

      <div className="mt-3 max-w-[928px]">
        {families === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : sortedRows.length === 0 ? (
          <EmptyState icon={Users} text="Zatím tu nejsou žádné rodiny." />
        ) : (
          <Table>
            <TableHeaderRow
              columns={TABLE_COLUMNS}
              labels={['', 'Rodina', 'Klíčová osoba', 'Poslední kontakt', 'Poslední návštěva', 'Stav']}
            />
            {sortedRows.map((row) => {
              const { docId, family, displayName, assignedToDisplay, alert } = row
              const isCrisis = alert?.tier === 'crisis'
              return (
                // Ne `<Link>` — řádek teď obsahuje `AddressLink` (taky `<a>`),
                // a `<a>` uvnitř `<a>` je neplatné HTML (React na to živě
                // upozorňuje, prohlížeč DOM tiše "opraví" nepředvídatelně).
                // Klik na řádek naviguje ručně, jednotlivé vnořené ovládací
                // prvky (checkbox/hvězdička/mikrofon/adresa) mají vlastní
                // `stopPropagation` už od dřívějška.
                <div
                  key={family.uid}
                  onClick={() => navigate(`/rodiny/${family.uid}`)}
                  className="contents cursor-pointer">
                  <TableRow
                    columns={TABLE_COLUMNS}
                    className={cn('group', isCrisis && 'bg-crisis-bg')}
                  >
                    <div className="flex items-center gap-1.5">
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          toggleStar(docId)
                        }}
                        title={starredIds.has(docId) ? 'Odebrat hvězdičku' : 'Označit hvězdičkou'}
                        className="flex shrink-0 items-center justify-center text-text-tertiary hover:text-warning"
                      >
                        <Star
                          size={16}
                          strokeWidth={2}
                          className={starredIds.has(docId) ? 'fill-warning text-warning' : ''}
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
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-text-tertiary opacity-0 transition-opacity hover:bg-danger-solid hover:text-white group-hover:opacity-100 disabled:opacity-40"
                      >
                        <Mic size={13} strokeWidth={2} />
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text-primary">{displayName}</p>
                      {family.address ? (
                        <span className="text-xs">
                          <AddressLink address={family.address} className="text-xs" />
                        </span>
                      ) : (
                        <p className="truncate text-xs text-text-tertiary">Adresa neuvedena</p>
                      )}
                    </div>
                    <span className="truncate text-sm text-text-secondary">{assignedToDisplay ?? '—'}</span>
                    <span className="text-sm text-text-secondary">
                      {family.lastTouchAt ? new Date(family.lastTouchAt).toLocaleDateString('cs-CZ') : 'Nikdy'}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {row.agreement?.lastVisitAt
                        ? new Date(row.agreement.lastVisitAt).toLocaleDateString('cs-CZ')
                        : 'Nikdy'}
                    </span>
                    <div>{alert && <AlertTag tier={alert.tier} title={`${alert.reason} — ${alert.action}`} />}</div>
                  </TableRow>
                </div>
              )
            })}
          </Table>
        )}
      </div>

      {noteModalOpen && (
        <Modal onClose={() => setNoteModalOpen(false)}>
          <form onSubmit={handleAddNote} className="flex flex-col gap-4">
            <h2 className="text-base font-medium text-text-primary">
              Poznámka pro {selected.size} {selected.size === 1 ? 'rodinu' : 'rodin'}
            </h2>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Text poznámky</span>
              <textarea
                required
                rows={4}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Např. byla oznámena dovolená klíčové osoby…"
                className="w-full rounded-sm border border-border-medium bg-inset px-3 py-2 text-[15px] text-text-primary placeholder:text-text-tertiary focus:border-2 focus:border-accent focus:outline-none"
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
