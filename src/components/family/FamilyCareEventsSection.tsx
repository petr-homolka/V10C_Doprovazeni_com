import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { HeartHandshake, Plus } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgressBar } from '@/components/ui/progress-bar'
import { cn } from '@/lib/utils'

const RESPIT_ANNUAL_MIN = 14
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import {
  computeDaysCount,
  computeStravaUbytovaniSplit,
  createRespitEvent,
  getChildRespitDaysForYear,
} from '@/services/respitEventService'
import {
  cancelOccurrence,
  createAssistedContactSeries,
  evaluateOccurrence,
  listAssistedContactSeries,
  listOccurrences,
  markAssistanceDone,
  markPreparationDone,
  scheduleOccurrence,
} from '@/services/assistedContactService'
import type { RespitEventKind } from '@/types/respitEvent'
import type {
  AssistedContactOccurrenceDoc,
  AssistedContactScheduleRecurrence,
  AssistedContactSeriesDoc,
} from '@/types/assistedContactSeries'

/** "Zaznamenat respit"/"Založit sérii" formuláře se renderují portálem
 * (`createPortal`) do jednoho sdíleného pravého panelu na
 * `FamilyDetailPage` místo inline pod nadpisem sekce. Panel samotný
 * (otevřeno/zavřeno, DOM uzel) vlastní `FamilyDetailPage` — sekce dostává
 * jen "je otevřeno"/"otevři"/"zavři" a cílový DOM uzel, o vnitřní stav
 * formuláře (vybrané dítě, datum, …) se pořád stará ona sama. */
export interface FamilyCarePanelHost {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  panelTarget: HTMLElement | null
}

export interface FamilyCareEventsSectionProps {
  familyDocId: string
  organizationId: string
  currentUid: string
  children: Array<{ docId: string; child: { firstName: string; lastName: string } }>
  respitPanel: FamilyCarePanelHost
  seriesPanel: FamilyCarePanelHost
}

const SERIES_STATUS_LABELS: Record<AssistedContactSeriesDoc['status'], string> = {
  aktivni: 'Aktivní',
  ukoncena: 'Ukončena',
  prerusena: 'Přerušena',
}

const OCCURRENCE_STATUS_LABELS: Record<AssistedContactOccurrenceDoc['status'], string> = {
  planovano: 'Plánováno',
  priprava_hotova: 'Příprava hotova',
  probehlo: 'Proběhlo',
  neprobehlo: 'Neproběhlo',
  zruseno: 'Zrušeno',
}

const RECURRENCE_LABELS: Record<AssistedContactScheduleRecurrence['frequency'], string> = {
  weekly: 'Týdně',
  biweekly: 'Jednou za 2 týdny',
  monthly: 'Měsíčně',
}

const TEXTAREA_CLASSNAME =
  'w-full resize-y rounded-sm border border-transparent bg-field px-3 py-2 text-lg leading-relaxed ' +
  'text-text-primary placeholder:text-text-tertiary transition-shadow duration-150 focus:border-accent focus:shadow-focus focus:outline-none'

function StatusBadge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'warning' }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium',
        tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-surface-soft text-text-primary',
      )}
    >
      {label}
    </span>
  )
}

function childName(children: FamilyCareEventsSectionProps['children'], childRef: string): string {
  const match = children.find((c) => c.docId === childRef)?.child
  return match ? `${match.firstName} ${match.lastName}` : 'Neznámé dítě'
}

// ---- Respit (§4.4.B) ----------------------------------------------------

function RespitSubsection({
  familyDocId,
  organizationId,
  currentUid,
  children,
  respitPanel,
}: FamilyCareEventsSectionProps) {
  const currentYear = new Date().getFullYear()
  const [daysUsed, setDaysUsed] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<RespitEventKind>('celodenni_pece')
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reason, setReason] = useState('')
  const [cost, setCost] = useState('')
  const [costCoveredByOrg, setCostCoveredByOrg] = useState('')
  const [includeStravaUbytovani, setIncludeStravaUbytovani] = useState(false)
  const [skutecneNaklady, setSkutecneNaklady] = useState('')
  const [includeUbytovani, setIncludeUbytovani] = useState(false)
  const { loading: submitting, success, run } = useAsyncSubmit()

  async function reloadStats() {
    setError(null)
    try {
      const entries = await Promise.all(
        children.map(async (c) => [c.docId, await getChildRespitDaysForYear(c.docId, currentYear)] as const),
      )
      setDaysUsed(Object.fromEntries(entries))
    } catch {
      setError('Přehled respitu se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reloadStats()
    // `children` (rodinné děti) dorazí z FamilyDetailPage asynchronně PO
    // `familyDocId` (samostatný state update přes await hranici) — bez
    // `children` v poli závislostí by se `reloadStats` spustilo jednou s
    // prázdným polem a nikdy znovu, viz FamilyDetailPage komentář o stejném
    // jevu u `recordablePeople`/Giant Timeru.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyDocId, children])

  function toggleChild(id: string) {
    setSelectedChildIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (selectedChildIds.size === 0) {
      setError('Vyberte aspoň jedno dítě.')
      return
    }
    try {
      await run(async () => {
        const stravaUbytovani =
          kind === 'pobyt' && includeStravaUbytovani && skutecneNaklady
            ? await computeStravaUbytovaniSplit(
                organizationId,
                computeDaysCount(new Date(dateFrom).toISOString(), new Date(dateTo).toISOString()),
                Number(skutecneNaklady),
                includeUbytovani,
              )
            : null
        await createRespitEvent({
          familyId: familyDocId,
          organizationId,
          childIds: Array.from(selectedChildIds),
          dateFrom: new Date(dateFrom).toISOString(),
          dateTo: new Date(dateTo).toISOString(),
          reason: reason || undefined,
          kind,
          cost: kind === 'celodenni_pece' && cost ? Number(cost) : null,
          costCoveredByOrg: kind === 'pobyt' && costCoveredByOrg ? Number(costCoveredByOrg) : null,
          stravaUbytovani,
          createdBy: currentUid,
        })
        await reloadStats()
      })
      respitPanel.onClose()
      setKind('celodenni_pece')
      setSelectedChildIds(new Set())
      setDateFrom('')
      setDateTo('')
      setReason('')
      setCost('')
      setCostCoveredByOrg('')
      setIncludeStravaUbytovani(false)
      setSkutecneNaklady('')
      setIncludeUbytovani(false)
    } catch {
      setError('Respit se nepodařilo zaznamenat.')
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-medium text-text-primary">Respit</h3>
          <p className="mt-0.5 text-sm text-text-tertiary">
            Nárok pěstouna na odpočinek — min. 14 dní / rok (§47a ZSPOD)
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={respitPanel.onOpen}>
          <Plus size={16} /> Zaznamenat respit
        </Button>
      </div>

      <div className="mt-4 flex max-w-[560px] flex-col gap-3">
        {daysUsed === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-text-secondary">Nejdřív přidejte svěřené děti.</p>
        ) : (
          children.map((c) => {
            const used = daysUsed[c.docId] ?? 0
            return (
              <div key={c.docId} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-text-primary">
                    {c.child.firstName} {c.child.lastName}
                  </span>
                  <span className="text-sm tabular-nums text-text-secondary">
                    {used} / {RESPIT_ANNUAL_MIN} dní <span className="text-text-tertiary">· {currentYear}</span>
                  </span>
                </div>
                <ProgressBar value={used} max={RESPIT_ANNUAL_MIN} />
              </div>
            )
          })
        )}
      </div>

      {respitPanel.isOpen &&
        respitPanel.panelTarget &&
        createPortal(
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Druh
            <Select value={kind} onChange={(e) => setKind(e.target.value as RespitEventKind)}>
              <option value="celodenni_pece">Celodenní péče</option>
              <option value="pobyt">Pobyt</option>
            </Select>
          </label>

          <div className="flex flex-col gap-1">
            <p className="text-sm text-text-secondary">Děti</p>
            <div className="flex flex-wrap gap-2">
              {children.map((c) => (
                <label key={c.docId} className="flex items-center gap-2 rounded-md border border-border-subtle px-2.5 py-1.5 text-sm">
                  <input type="checkbox" checked={selectedChildIds.has(c.docId)} onChange={() => toggleChild(c.docId)} />
                  {c.child.firstName} {c.child.lastName}
                </label>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Období
            <DateRangePicker from={dateFrom} to={dateTo} onChange={({ from, to }) => { setDateFrom(from); setDateTo(to) }} />
          </label>

          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Důvod (povinné nad 14 dní/rok)
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>

          {kind === 'celodenni_pece' && (
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Náklady (Kč)
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
            </label>
          )}

          {kind === 'pobyt' && (
            <>
              <label className="flex flex-col gap-1 text-sm text-text-secondary">
                Náklady hrazené organizací (Kč) — vlastní péče/program
                <Input type="number" value={costCoveredByOrg} onChange={(e) => setCostCoveredByOrg(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={includeStravaUbytovani}
                  onChange={(e) => setIncludeStravaUbytovani(e.target.checked)}
                />
                Zahrnout stravu/ubytování (hradí rodina, organizace jen doplácí nad strop)
              </label>
              {includeStravaUbytovani && (
                <>
                  <label className="flex flex-col gap-1 text-sm text-text-secondary">
                    Skutečné náklady na stravu/ubytování (Kč)
                    <Input type="number" value={skutecneNaklady} onChange={(e) => setSkutecneNaklady(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input type="checkbox" checked={includeUbytovani} onChange={(e) => setIncludeUbytovani(e.target.checked)} />
                    Zahrnout ubytování (ne jen stravu)
                  </label>
                </>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-border-default pt-4">
            <Button type="submit" loading={submitting} success={success}>
              Uložit
            </Button>
            <Button type="button" variant="ghost" onClick={respitPanel.onClose} disabled={submitting}>
              Zrušit
            </Button>
          </div>
          </form>,
          respitPanel.panelTarget,
        )}
    </div>
  )
}

// ---- Asistovaný kontakt (§B.10.2) ----------------------------------------

interface SeriesRow {
  docId: string
  series: AssistedContactSeriesDoc
  occurrences: Array<{ docId: string; occurrence: AssistedContactOccurrenceDoc }> | null
}

function AssistedContactSubsection({
  familyDocId,
  organizationId,
  currentUid,
  children,
  seriesPanel,
}: FamilyCareEventsSectionProps) {
  const [rows, setRows] = useState<SeriesRow[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [childRef, setChildRef] = useState('')
  const [purpose, setPurpose] = useState('')
  const [participants, setParticipants] = useState('')
  const [startDate, setStartDate] = useState('')
  const [frequency, setFrequency] = useState<AssistedContactScheduleRecurrence['frequency']>('weekly')
  const [interval, setInterval] = useState('1')
  const [defaultLocation, setDefaultLocation] = useState('')
  const { loading: submitting, success, run } = useAsyncSubmit()
  const [formError, setFormError] = useState<string | null>(null)

  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({})
  const [prepNotes, setPrepNotes] = useState<Record<string, string>>({})
  const [assistLocation, setAssistLocation] = useState<Record<string, string>>({})
  const [assistNote, setAssistNote] = useState<Record<string, string>>({})
  const [evalSummary, setEvalSummary] = useState<Record<string, string>>({})
  const [evalRecommendation, setEvalRecommendation] = useState<Record<string, string>>({})
  const [cancelReasonDraft, setCancelReasonDraft] = useState<Record<string, string>>({})
  const [openAction, setOpenAction] = useState<string | null>(null)

  async function reload() {
    setListError(null)
    try {
      const series = await listAssistedContactSeries(familyDocId, organizationId)
      const withOccurrences = await Promise.all(
        series.map(async (s) => ({ ...s, occurrences: await listOccurrences(familyDocId, s.docId) })),
      )
      setRows(withOccurrences)
    } catch {
      setListError('Asistovaný kontakt se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyDocId])

  async function handleCreateSeries(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!childRef) {
      setFormError('Vyberte dítě.')
      return
    }
    try {
      // participantRefs → external_participants (§5.1) NENÍ v týhle dávce
      // napojeno na výběr existujících účastníků (plný grant engine je M8),
      // takže se tu jen textově zapíše "kdo" do `purpose`, samotné pole
      // zůstává prázdné pole.
      await run(async () => {
        await createAssistedContactSeries(familyDocId, {
          organizationId,
          childRef,
          participantRefs: [],
          purpose: participants ? `${purpose} (účastní se: ${participants})` : purpose,
          schedule: {
            startDate: new Date(startDate).toISOString(),
            recurrence: { frequency, interval: Number(interval) },
          },
          ...(defaultLocation ? { defaultLocation } : {}),
          createdBy: currentUid,
        })
        await reload()
      })
      seriesPanel.onClose()
      setChildRef('')
      setPurpose('')
      setParticipants('')
      setStartDate('')
      setFrequency('weekly')
      setInterval('1')
      setDefaultLocation('')
    } catch {
      setFormError('Založení série se nezdařilo.')
    }
  }

  async function handleSchedule(seriesId: string) {
    const date = scheduleDates[seriesId]
    if (!date) return
    setActionError(null)
    try {
      await scheduleOccurrence(familyDocId, seriesId, new Date(date).toISOString())
      setScheduleDates((prev) => ({ ...prev, [seriesId]: '' }))
      await reload()
    } catch {
      setActionError('Naplánování termínu se nezdařilo.')
    }
  }

  async function handlePrepDone(seriesId: string, occurrenceId: string) {
    setActionError(null)
    try {
      await markPreparationDone(familyDocId, seriesId, occurrenceId, currentUid, prepNotes[occurrenceId] || undefined)
      setOpenAction(null)
      await reload()
    } catch {
      setActionError('Uložení přípravy se nezdařilo.')
    }
  }

  async function handleAssistDone(seriesId: string, occurrenceId: string) {
    const location = assistLocation[occurrenceId]
    if (!location) {
      setActionError('Zadejte místo konání.')
      return
    }
    setActionError(null)
    try {
      await markAssistanceDone(familyDocId, seriesId, occurrenceId, currentUid, location, assistNote[occurrenceId] || undefined)
      setOpenAction(null)
      await reload()
    } catch {
      setActionError('Uložení průběhu se nezdařilo.')
    }
  }

  async function handleEvaluate(seriesId: string, occurrenceId: string) {
    const summary = evalSummary[occurrenceId]
    if (!summary?.trim()) {
      setActionError('Vyhodnocení vyžaduje shrnutí.')
      return
    }
    setActionError(null)
    try {
      await evaluateOccurrence(familyDocId, seriesId, occurrenceId, currentUid, summary, evalRecommendation[occurrenceId] || undefined)
      setOpenAction(null)
      await reload()
    } catch {
      setActionError('Vyhodnocení se nepodařilo uložit.')
    }
  }

  async function handleCancel(seriesId: string, occurrenceId: string) {
    const reason = cancelReasonDraft[occurrenceId]
    if (!reason?.trim()) {
      setActionError('Zrušení vyžaduje důvod.')
      return
    }
    setActionError(null)
    try {
      await cancelOccurrence(familyDocId, seriesId, occurrenceId, reason)
      setOpenAction(null)
      await reload()
    } catch {
      setActionError('Zrušení termínu se nezdařilo.')
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-medium text-text-primary">Asistovaný kontakt</h3>
          <p className="mt-0.5 text-sm text-text-tertiary">Opakovaný styk dítěte s biologickou rodinou</p>
        </div>
        <Button variant="secondary" size="sm" onClick={seriesPanel.onOpen}>
          <Plus size={16} /> Založit sérii
        </Button>
      </div>

      {seriesPanel.isOpen &&
        seriesPanel.panelTarget &&
        createPortal(
          <form onSubmit={handleCreateSeries} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Dítě
            <Select value={childRef} onChange={(e) => setChildRef(e.target.value)}>
              <option value="">Vyberte…</option>
              {children.map((c) => (
                <option key={c.docId} value={c.docId}>
                  {c.child.firstName} {c.child.lastName}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Účel
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Kdo se účastní (volný text — plný výběr účastníků je mimo rozsah)
            <Input value={participants} onChange={(e) => setParticipants(e.target.value)} />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Začátek
              <DatePicker value={startDate} onChange={setStartDate} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Opakování
              <Select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as AssistedContactScheduleRecurrence['frequency'])}
              >
                <option value="weekly">Týdně</option>
                <option value="biweekly">Jednou za 2 týdny</option>
                <option value="monthly">Měsíčně</option>
              </Select>
            </label>
            <label className="flex w-24 flex-col gap-1 text-sm text-text-secondary">
              Interval
              <Input type="number" min={1} value={interval} onChange={(e) => setInterval(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Výchozí místo konání (volitelné)
            <Input value={defaultLocation} onChange={(e) => setDefaultLocation(e.target.value)} />
          </label>
          {formError && (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          )}
          <div className="flex gap-2 border-t border-border-default pt-4">
            <Button type="submit" loading={submitting} success={success}>
              Založit sérii
            </Button>
            <Button type="button" variant="ghost" onClick={seriesPanel.onClose} disabled={submitting}>
              Zrušit
            </Button>
          </div>
          </form>,
          seriesPanel.panelTarget,
        )}

      <div className="mt-4">
        {listError ? (
          <p className="text-sm text-danger" role="alert">
            {listError}
          </p>
        ) : rows === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={HeartHandshake} text="Zatím žádná série asistovaného kontaktu." />
        ) : (
          <div className="flex max-w-[928px] flex-col gap-3">
            {rows.map(({ docId: seriesId, series, occurrences }) => (
              <div key={seriesId} className="flex flex-col gap-3 rounded-lg bg-surface-soft p-4 shadow-raised">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-primary">{childName(children, series.childRef)} — {series.purpose}</p>
                    <p className="text-xs text-text-secondary">
                      {RECURRENCE_LABELS[series.schedule.recurrence.frequency]}, interval {series.schedule.recurrence.interval}, od{' '}
                      {new Date(series.schedule.startDate).toLocaleDateString('cs-CZ')}
                    </p>
                  </div>
                  <StatusBadge label={SERIES_STATUS_LABELS[series.status]} />
                </div>

                <div className="flex items-center gap-2">
                  <DatePicker
                    value={scheduleDates[seriesId] ?? ''}
                    onChange={(v) => setScheduleDates((prev) => ({ ...prev, [seriesId]: v }))}
                    className="w-auto"
                  />
                  <Button variant="secondary" size="sm" onClick={() => handleSchedule(seriesId)}>
                    <Plus size={16} /> Naplánovat termín
                  </Button>
                </div>

                {actionError && (
                  <p className="text-sm text-danger" role="alert">
                    {actionError}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {(occurrences ?? []).map(({ docId: occId, occurrence }) => {
                    const key = `${seriesId}/${occId}`
                    const needsEvaluation = occurrence.status === 'probehlo' && !occurrence.evaluation
                    return (
                      <div key={occId} className="rounded-md bg-inset p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-text-primary">{new Date(occurrence.plannedDate).toLocaleDateString('cs-CZ')}</p>
                          <StatusBadge
                            label={needsEvaluation ? 'Čeká na vyhodnocení' : OCCURRENCE_STATUS_LABELS[occurrence.status]}
                            tone={needsEvaluation ? 'warning' : 'default'}
                          />
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {occurrence.status === 'planovano' && (
                            <Button variant="secondary" size="sm" onClick={() => setOpenAction(openAction === `prep-${key}` ? null : `prep-${key}`)}>
                              Příprava hotova
                            </Button>
                          )}
                          {occurrence.status === 'priprava_hotova' && (
                            <Button variant="secondary" size="sm" onClick={() => setOpenAction(openAction === `assist-${key}` ? null : `assist-${key}`)}>
                              Proběhlo
                            </Button>
                          )}
                          {needsEvaluation && (
                            <Button
                              size="sm"
                              className="bg-warning text-white hover:opacity-90"
                              onClick={() => setOpenAction(openAction === `eval-${key}` ? null : `eval-${key}`)}
                            >
                              Vyhodnotit (povinné)
                            </Button>
                          )}
                          {(occurrence.status === 'planovano' || occurrence.status === 'priprava_hotova') && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setOpenAction(openAction === `cancel-${key}` ? null : `cancel-${key}`)}
                            >
                              Zrušit
                            </Button>
                          )}
                        </div>

                        {openAction === `prep-${key}` && (
                          <div className="mt-2 flex flex-col gap-2">
                            <Input
                              placeholder="Poznámka (volitelné)"
                              value={prepNotes[occId] ?? ''}
                              onChange={(e) => setPrepNotes((prev) => ({ ...prev, [occId]: e.target.value }))}
                            />
                            <Button size="sm" onClick={() => handlePrepDone(seriesId, occId)}>
                              Uložit
                            </Button>
                          </div>
                        )}
                        {openAction === `assist-${key}` && (
                          <div className="mt-2 flex flex-col gap-2">
                            <Input
                              placeholder="Místo konání"
                              value={assistLocation[occId] ?? ''}
                              onChange={(e) => setAssistLocation((prev) => ({ ...prev, [occId]: e.target.value }))}
                            />
                            <Input
                              placeholder="Poznámka (volitelné)"
                              value={assistNote[occId] ?? ''}
                              onChange={(e) => setAssistNote((prev) => ({ ...prev, [occId]: e.target.value }))}
                            />
                            <Button size="sm" onClick={() => handleAssistDone(seriesId, occId)}>
                              Uložit
                            </Button>
                          </div>
                        )}
                        {openAction === `eval-${key}` && (
                          <div className="mt-2 flex flex-col gap-2">
                            <textarea
                              placeholder="Shrnutí vyhodnocení"
                              value={evalSummary[occId] ?? ''}
                              onChange={(e) => setEvalSummary((prev) => ({ ...prev, [occId]: e.target.value }))}
                              rows={3}
                              className={TEXTAREA_CLASSNAME}
                            />
                            <Input
                              placeholder="Doporučení pro příště (volitelné)"
                              value={evalRecommendation[occId] ?? ''}
                              onChange={(e) => setEvalRecommendation((prev) => ({ ...prev, [occId]: e.target.value }))}
                            />
                            <Button size="sm" onClick={() => handleEvaluate(seriesId, occId)}>
                              Uložit vyhodnocení
                            </Button>
                          </div>
                        )}
                        {openAction === `cancel-${key}` && (
                          <div className="mt-2 flex flex-col gap-2">
                            <Input
                              placeholder="Důvod zrušení"
                              value={cancelReasonDraft[occId] ?? ''}
                              onChange={(e) => setCancelReasonDraft((prev) => ({ ...prev, [occId]: e.target.value }))}
                            />
                            <Button variant="destructive" size="sm" onClick={() => handleCancel(seriesId, occId)}>
                              Potvrdit zrušení
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * M7 §4.4.B — respit (nárok pěstouna na odpočinek) a asistovaný kontakt
 * (opakovaný styk s biologickou rodinou) jsou DVĚ NEZÁVISLÉ rodinné
 * agendy, každá vlastní sekce s vlastním nadpisem (UX zpětná vazba
 * 2026-07-21 — dřívější sdružující nadpis "Respit, asistovaný kontakt a
 * předání dítěte" mísil nesouvisející věci). Jednorázové PŘEDÁNÍ dítěte
 * se přestěhovalo na profil dítěte (ChildDetailPage) — je vždy o
 * konkrétním dítěti, ne o rodině jako celku.
 */
export function FamilyCareEventsSection(props: FamilyCareEventsSectionProps) {
  return (
    <>
      <section className="mt-10">
        <RespitSubsection {...props} />
      </section>
      <section className="mt-10">
        <AssistedContactSubsection {...props} />
      </section>
    </>
  )
}
