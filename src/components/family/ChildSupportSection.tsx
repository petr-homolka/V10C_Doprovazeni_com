import { useEffect, useState, type FormEvent } from 'react'
import { CalendarClock, Plus, Receipt } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import {
  addOccurrence,
  confirmOccurrence,
  createScheduledActivity,
  listOccurrences,
  listScheduledActivities,
} from '@/services/scheduledActivityService'
import { addSupportExpense, listSupportExpenses, summarizeExpenses } from '@/services/supportExpenseService'
import type {
  ScheduledActivityConfirmationMode,
  ScheduledActivityDoc,
  ScheduledActivityOccurrenceDoc,
  ScheduledActivityProviderKind,
  ScheduledActivityType,
} from '@/types/scheduledActivity'
import type { SupportExpenseCategory, SupportExpenseDoc, SupportExpenseSource } from '@/types/supportExpense'

export interface ChildSupportSectionProps {
  childId: string
  childName: string
  organizationId: string
  currentUid: string
}

const ACTIVITY_TYPE_LABELS: Record<ScheduledActivityType, string> = {
  doucovani: 'Doučování',
  hlidani: 'Hlídání',
  krouzek: 'Kroužek',
  jine: 'Jiné',
}
const PROVIDER_KIND_LABELS: Record<ScheduledActivityProviderKind, string> = { interni: 'Interní', externi: 'Externí' }
const CONFIRMATION_MODE_LABELS: Record<ScheduledActivityConfirmationMode, string> = {
  potvrzuje_se: 'Potvrzuje se ručně',
  presumuje_se: 'Presumuje se automaticky',
}
const FREQUENCY_LABELS: Record<'weekly' | 'daily', string> = { weekly: 'Týdně', daily: 'Denně' }
const OCCURRENCE_STATUS_LABELS: Record<ScheduledActivityOccurrenceDoc['status'], string> = {
  planovano: 'Plánováno',
  probehlo: 'Proběhlo',
  neprobehlo: 'Neproběhlo',
  presumovano: 'Presumováno',
}
const DAY_LABELS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']

const EXPENSE_CATEGORY_LABELS: Record<SupportExpenseCategory, string> = {
  doucovani: 'Doučování',
  hlidani: 'Hlídání',
  tabor: 'Tábor',
  jine: 'Jiné',
  poradenstvi: 'Poradenství',
  terapie: 'Terapie',
  supervizePodpurna: 'Podpůrná supervize',
}
const EXPENSE_SOURCE_LABELS: Record<SupportExpenseSource, string> = { interni: 'Interní', smluvni: 'Smluvní', rucni: 'Ruční' }

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-surface-soft px-2.5 text-xs font-medium text-text-primary">
      {label}
    </span>
  )
}

// ---- Naplánované aktivity (§4.4.B.1) -------------------------------------

interface ActivityRow {
  docId: string
  activity: ScheduledActivityDoc
  occurrences: Array<{ docId: string; occurrence: ScheduledActivityOccurrenceDoc }> | null
}

function ScheduledActivitiesSubsection({ childId, organizationId, currentUid }: ChildSupportSectionProps) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [newOccurrenceDate, setNewOccurrenceDate] = useState<Record<string, string>>({})

  const [showForm, setShowForm] = useState(false)
  const [activityType, setActivityType] = useState<ScheduledActivityType>('doucovani')
  const [providerKind, setProviderKind] = useState<ScheduledActivityProviderKind>('interni')
  const [internalStaffUid, setInternalStaffUid] = useState('')
  const [isRespit, setIsRespit] = useState(false)
  const [confirmationMode, setConfirmationMode] = useState<ScheduledActivityConfirmationMode>('potvrzuje_se')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [frequency, setFrequency] = useState<'weekly' | 'daily'>('weekly')
  const [daysOfWeek, setDaysOfWeek] = useState<Set<number>>(new Set())
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [amountPerHour, setAmountPerHour] = useState('')
  const [rateWasOverridden, setRateWasOverridden] = useState(false)
  const { loading: submitting, success, run } = useAsyncSubmit()
  const [formError, setFormError] = useState<string | null>(null)

  async function reload() {
    setListError(null)
    try {
      const activities = await listScheduledActivities(childId)
      const withOccurrences = await Promise.all(
        activities.map(async (a) => ({ ...a, occurrences: await listOccurrences(childId, a.docId) })),
      )
      setRows(withOccurrences)
    } catch {
      setListError('Aktivity se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId])

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    try {
      await run(async () => {
        await createScheduledActivity(childId, {
          organizationId,
          activityType,
          providerKind,
          // Žádný výběr zaměstnance tady není k dispozici (mimo rozsah), jen
          // volný text.
          internalStaffUid: providerKind === 'interni' ? internalStaffUid || null : null,
          externalInstitutionRef: null,
          isRespit,
          confirmationMode,
          schedule: {
            startDate: new Date(startDate).toISOString(),
            endDate: endDate ? new Date(endDate).toISOString() : null,
            recurrence: { frequency, daysOfWeek: Array.from(daysOfWeek), durationMinutes: Number(durationMinutes) },
          },
          rate: { amountPerHour: Number(amountPerHour) },
          // Bez napojení na `resolveRate` kaskádu (žádný lookup tady) — pole
          // přepíná uživatel ručně, jen pokud sazbu sám upravil.
          rateWasOverridden,
          osobniPeceDuvod: null,
          createdBy: currentUid,
        })
        await reload()
      })
      setShowForm(false)
      setActivityType('doucovani')
      setProviderKind('interni')
      setInternalStaffUid('')
      setIsRespit(false)
      setConfirmationMode('potvrzuje_se')
      setStartDate('')
      setEndDate('')
      setFrequency('weekly')
      setDaysOfWeek(new Set())
      setDurationMinutes('60')
      setAmountPerHour('')
      setRateWasOverridden(false)
    } catch {
      setFormError('Naplánování aktivity se nezdařilo.')
    }
  }

  async function handleAddOccurrence(activityId: string) {
    const date = newOccurrenceDate[activityId]
    if (!date) return
    setActionError(null)
    try {
      await addOccurrence(childId, activityId, new Date(date).toISOString(), 'planovano')
      setNewOccurrenceDate((prev) => ({ ...prev, [activityId]: '' }))
      await reload()
    } catch {
      setActionError('Přidání termínu se nezdařilo.')
    }
  }

  async function handleConfirm(activityId: string, occurrenceId: string, status: 'probehlo' | 'neprobehlo') {
    setActionError(null)
    try {
      await confirmOccurrence(childId, activityId, occurrenceId, status, currentUid)
      await reload()
    } catch {
      setActionError('Potvrzení termínu se nezdařilo.')
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium text-text-primary">Naplánované aktivity</h3>
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Zrušit' : (<><Plus size={16} /> Naplánovat aktivitu</>)}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-3 max-w-[560px] flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Typ aktivity
              <Select value={activityType} onChange={(e) => setActivityType(e.target.value as ScheduledActivityType)}>
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Poskytovatel
              <Select
                value={providerKind}
                onChange={(e) => setProviderKind(e.target.value as ScheduledActivityProviderKind)}
              >
                <option value="interni">Interní</option>
                <option value="externi">Externí</option>
              </Select>
            </label>
          </div>

          {providerKind === 'interni' && (
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Zaměstnanec (jméno/uid — bez výběru ze seznamu)
              <Input value={internalStaffUid} onChange={(e) => setInternalStaffUid(e.target.value)} />
            </label>
          )}

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={isRespit} onChange={(e) => setIsRespit(e.target.checked)} />
              Respit (hradí organizace)
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Potvrzování termínů
            <Select
              value={confirmationMode}
              onChange={(e) => setConfirmationMode(e.target.value as ScheduledActivityConfirmationMode)}
            >
              {Object.entries(CONFIRMATION_MODE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Začátek
              <DatePicker value={startDate} onChange={setStartDate} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Konec (volitelné)
              <DatePicker value={endDate} onChange={setEndDate} />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Opakování
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as 'weekly' | 'daily')}>
              <option value="weekly">Týdně</option>
              <option value="daily">Denně</option>
            </Select>
          </label>

          <div className="flex flex-col gap-1">
            <p className="text-sm text-text-secondary">Dny v týdnu</p>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, day) => (
                <label
                  key={day}
                  className={cn(
                    'flex size-9 cursor-pointer items-center justify-center rounded-md border border-border-subtle text-xs',
                    daysOfWeek.has(day) && 'border-accent bg-primary text-primary-foreground',
                  )}
                >
                  <input type="checkbox" className="sr-only" checked={daysOfWeek.has(day)} onChange={() => toggleDay(day)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Délka (min)
              <Input type="number" required value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Sazba (Kč/h)
              <Input type="number" required value={amountPerHour} onChange={(e) => setAmountPerHour(e.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={rateWasOverridden} onChange={(e) => setRateWasOverridden(e.target.checked)} />
            Sazba byla ručně upravena oproti výchozí
          </label>

          {formError && (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" loading={submitting} success={success}>
              Naplánovat
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>
              Zrušit
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4">
        {listError ? (
          <p className="text-sm text-danger" role="alert">
            {listError}
          </p>
        ) : rows === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={CalendarClock} text="Zatím žádná naplánovaná aktivita." />
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map(({ docId: activityId, activity, occurrences }) => (
              <div key={activityId} className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-primary">
                      {ACTIVITY_TYPE_LABELS[activity.activityType]} · {PROVIDER_KIND_LABELS[activity.providerKind]}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {FREQUENCY_LABELS[activity.schedule.recurrence.frequency]}, {activity.schedule.recurrence.durationMinutes} min ·{' '}
                      {activity.rate.amountPerHour} Kč/h
                    </p>
                  </div>
                  {activity.isRespit && <StatusBadge label="Respit" />}
                </div>

                {actionError && (
                  <p className="text-sm text-danger" role="alert">
                    {actionError}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {(occurrences ?? []).map(({ docId: occId, occurrence }) => (
                    <div key={occId} className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-soft px-3 py-2">
                      <span className="text-sm text-text-primary">{new Date(occurrence.date).toLocaleDateString('cs-CZ')}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge label={OCCURRENCE_STATUS_LABELS[occurrence.status]} />
                        {occurrence.status === 'planovano' && (
                          <>
                            <Button variant="secondary" size="sm" onClick={() => handleConfirm(activityId, occId, 'probehlo')}>
                              Proběhlo
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleConfirm(activityId, occId, 'neprobehlo')}>
                              Neproběhlo
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <DatePicker
                    value={newOccurrenceDate[activityId] ?? ''}
                    onChange={(v) => setNewOccurrenceDate((prev) => ({ ...prev, [activityId]: v }))}
                    className="w-auto"
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleAddOccurrence(activityId)}>
                    <Plus size={16} /> Přidat termín
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Podpůrné výdaje (§4.4.E) ---------------------------------------------

const EXPENSE_COLUMNS = '1fr 1fr 0.8fr 1.4fr 1.5fr'

function SupportExpensesSubsection({ childId, organizationId, currentUid }: ChildSupportSectionProps) {
  const [expenses, setExpenses] = useState<SupportExpenseDoc[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [category, setCategory] = useState<SupportExpenseCategory>('doucovani')
  const [source, setSource] = useState<SupportExpenseSource>('interni')
  const [amount, setAmount] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [note, setNote] = useState('')
  const [documentRef, setDocumentRef] = useState('')
  const { loading: submitting, success, run } = useAsyncSubmit()
  const [formError, setFormError] = useState<string | null>(null)

  async function reload() {
    setListError(null)
    try {
      const result = await listSupportExpenses(childId)
      setExpenses(result.map((r) => r.expense))
    } catch {
      setListError('Výdaje se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (source === 'rucni' && !documentRef.trim()) {
      setFormError('Ruční výdaj vyžaduje doklad.')
      return
    }
    try {
      await run(async () => {
        await addSupportExpense(childId, {
          organizationId,
          category,
          source,
          providerRef: null,
          amount: Number(amount),
          periodFrom: new Date(periodFrom).toISOString(),
          periodTo: new Date(periodTo).toISOString(),
          documentRef: source === 'rucni' ? documentRef : null,
          createdBy: currentUid,
          ...(note ? { note } : {}),
        })
        await reload()
      })
      setShowForm(false)
      setCategory('doucovani')
      setSource('interni')
      setAmount('')
      setPeriodFrom('')
      setPeriodTo('')
      setNote('')
      setDocumentRef('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Přidání dokladu se nezdařilo.')
    }
  }

  const summary = expenses ? summarizeExpenses(expenses) : null

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium text-text-primary">Podpůrné výdaje</h3>
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Zrušit' : (<><Plus size={16} /> Přidat doklad</>)}
        </Button>
      </div>

      {summary && (
        <div className="mt-3 flex gap-3">
          <div className="rounded-lg border border-border-subtle bg-surface p-3">
            <p className="text-xs text-text-secondary">Posledních 90 dní</p>
            <p className="text-sm text-text-primary">{summary.last90Days} Kč</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface p-3">
            <p className="text-xs text-text-secondary">Posledních 182 dní</p>
            <p className="text-sm text-text-primary">{summary.last182Days} Kč</p>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface p-3">
            <p className="text-xs text-text-secondary">Posledních 365 dní</p>
            <p className="text-sm text-text-primary">{summary.last365Days} Kč</p>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-3 max-w-[560px] flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Kategorie
              <Select value={category} onChange={(e) => setCategory(e.target.value as SupportExpenseCategory)}>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Zdroj
              <Select value={source} onChange={(e) => setSource(e.target.value as SupportExpenseSource)}>
                <option value="interni">Interní</option>
                <option value="smluvni">Smluvní</option>
                <option value="rucni">Ruční</option>
              </Select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Částka (Kč)
            <Input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Období od
              <DatePicker value={periodFrom} onChange={setPeriodFrom} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Období do
              <DatePicker value={periodTo} onChange={setPeriodTo} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Poznámka (volitelné)
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {source === 'rucni' && (
            <label className="flex flex-col gap-1 text-sm text-text-secondary">
              Doklad (povinné pro ruční výdaj)
              <Input value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} />
            </label>
          )}
          {formError && (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" loading={submitting} success={success}>
              Uložit
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>
              Zrušit
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4">
        {listError ? (
          <p className="text-sm text-danger" role="alert">
            {listError}
          </p>
        ) : expenses === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : expenses.length === 0 ? (
          <EmptyState icon={Receipt} text="Zatím žádný doklad." />
        ) : (
          <div className="max-w-[928px]">
            <Table>
              <TableHeaderRow columns={EXPENSE_COLUMNS} labels={['Kategorie', 'Zdroj', 'Částka', 'Období', 'Poznámka']} />
              {expenses.map((expense, i) => (
                <TableRow key={i} columns={EXPENSE_COLUMNS}>
                  <span className="text-sm text-text-primary">{EXPENSE_CATEGORY_LABELS[expense.category]}</span>
                  <span className="text-sm text-text-secondary">{EXPENSE_SOURCE_LABELS[expense.source]}</span>
                  <span className="text-sm text-text-secondary">{expense.amount} Kč</span>
                  <span className="text-sm text-text-secondary">
                    {new Date(expense.periodFrom).toLocaleDateString('cs-CZ')} – {new Date(expense.periodTo).toLocaleDateString('cs-CZ')}
                  </span>
                  <span className="text-sm text-text-secondary">{expense.note ?? ''}</span>
                </TableRow>
              ))}
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

/** M7 §4.4.B.1 + §4.4.E — profil dítěte NIKDY nezobrazuje procenta/grafy
 * čerpání SPVPP (viz supportExpenseService.ts komentář), jen tabulka
 * dokladů + tři prosté souhrnné částky. */
export function ChildSupportSection(props: ChildSupportSectionProps) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-medium text-text-primary">Podpůrné aktivity a výdaje — {props.childName}</h2>
      <ScheduledActivitiesSubsection {...props} />
      <SupportExpensesSubsection {...props} />
    </section>
  )
}
