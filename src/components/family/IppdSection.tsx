import { useEffect, useState, type FormEvent } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { closeIppd, createIppd, evaluateIppd, listIppds } from '@/services/ippdService'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import type { IppdDoc, IppdGoal } from '@/types/ippd'

export interface IppdSectionProps {
  familyDocId: string
  organizationId: string
  currentUid: string
  fosterPersons: Array<{ docId: string; fosterPerson: { firstName: string; lastName: string } }>
  children: Array<{ docId: string; child: { firstName: string; lastName: string } }>
}

const STATUS_LABELS: Record<IppdDoc['status'], string> = {
  aktivni: 'Aktivní',
  vyhodnoceno: 'Vyhodnoceno',
  uzavreno: 'Uzavřeno',
}

const GOAL_STATUS_LABELS: Record<IppdGoal['status'], string> = {
  aktivni: 'Aktivní',
  splneno: 'Splněno',
  zruseno: 'Zrušeno',
}

type ResponsibleKind = IppdGoal['responsibleRef']['kind']

interface GoalDraft {
  description: string
  kind: ResponsibleKind
  refId: string
}

function emptyGoalDraft(): GoalDraft {
  return { description: '', kind: 'fosterPerson', refId: '' }
}

function defaultPeriod(): { from: string; to: string } {
  const from = new Date()
  const to = new Date(from)
  to.setMonth(to.getMonth() + 6)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-surface-soft px-2.5 text-xs font-medium text-text-primary">
      {label}
    </span>
  )
}

const TEXTAREA_CLASSNAME =
  'w-full resize-y rounded-sm border border-border-medium bg-inset px-3 py-2 text-[16px] leading-relaxed ' +
  'text-text-primary placeholder:text-text-tertiary transition-shadow duration-150 focus:border-accent focus:shadow-focus focus:outline-none'

/**
 * M7 §B.4 — IPPD je per Dohoda (agreementId=organizationId, M2), ne per
 * pěstoun, proto jen `organizationId` prop (žádný agreementId navíc).
 */
export function IppdSection({ familyDocId, organizationId, currentUid, fosterPersons, children }: IppdSectionProps) {
  const [ippds, setIppds] = useState<Array<{ docId: string; ippd: IppdDoc }> | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [period, setPeriod] = useState(defaultPeriod)
  const [goalDrafts, setGoalDrafts] = useState<GoalDraft[]>([emptyGoalDraft()])
  const [formError, setFormError] = useState<string | null>(null)
  const { loading: submitting, success, run } = useAsyncSubmit()

  const [evaluatingDocId, setEvaluatingDocId] = useState<string | null>(null)
  const [evaluationSummary, setEvaluationSummary] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const { loading: actionSubmitting, success: actionSuccess, run: runAction } = useAsyncSubmit()

  async function reload() {
    setListError(null)
    try {
      const result = await listIppds(familyDocId, organizationId)
      setIppds(result)
    } catch {
      setListError('IPPD se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyDocId, organizationId])

  function resolveResponsibleLabel(ref: IppdGoal['responsibleRef']): string {
    if (ref.kind === 'fosterPerson') {
      const fp = fosterPersons.find((f) => f.docId === ref.id)?.fosterPerson
      return fp ? `${fp.firstName} ${fp.lastName}` : 'Neznámý pěstoun'
    }
    if (ref.kind === 'child') {
      const match = children.find((c) => c.docId === ref.id)?.child
      return match ? `${match.firstName} ${match.lastName}` : 'Neznámé dítě'
    }
    // Žádný seznam zaměstnanců se do sekce nepředává (mimo rozsah tohoto
    // průchodu) — zobrazí se jen role, ne konkrétní jméno.
    return 'zaměstnanec'
  }

  function updateGoalDraft(index: number, patch: Partial<GoalDraft>) {
    setGoalDrafts((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)))
  }

  function addGoalRow() {
    setGoalDrafts((prev) => [...prev, emptyGoalDraft()])
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const goals: IppdGoal[] = goalDrafts
      .filter((g) => g.description.trim() !== '')
      .map((g) => ({
        id: crypto.randomUUID(),
        description: g.description.trim(),
        responsibleRef: { kind: g.kind, id: g.kind === 'staff' ? currentUid : g.refId },
        steps: [],
        status: 'aktivni',
        carriedFromGoalId: null,
      }))
    if (goals.length === 0) {
      setFormError('Zadejte aspoň jeden cíl s popisem.')
      return
    }
    try {
      await run(async () => {
        await createIppd(
          familyDocId,
          organizationId,
          new Date(period.from).toISOString(),
          new Date(period.to).toISOString(),
          goals,
          currentUid,
        )
        await reload()
      })
      setShowForm(false)
      setPeriod(defaultPeriod())
      setGoalDrafts([emptyGoalDraft()])
    } catch {
      setFormError('Založení IPPD se nezdařilo.')
    }
  }

  function toggleEvaluate(docId: string) {
    setActionError(null)
    setEvaluationSummary('')
    setEvaluatingDocId((prev) => (prev === docId ? null : docId))
  }

  async function handleEvaluateSubmit(e: FormEvent, docId: string) {
    e.preventDefault()
    setActionError(null)
    try {
      await runAction(async () => {
        await evaluateIppd(familyDocId, organizationId, docId, currentUid, evaluationSummary.trim())
        await reload()
      })
      setEvaluatingDocId(null)
      setEvaluationSummary('')
    } catch {
      setActionError('Vyhodnocení se nepodařilo uložit.')
    }
  }

  async function handleClose(docId: string) {
    setActionError(null)
    try {
      await runAction(async () => {
        await closeIppd(familyDocId, organizationId, docId)
        await reload()
      })
    } catch {
      setActionError('Uzavření IPPD se nezdařilo.')
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-normal leading-tight text-text-primary">IPPD — individuální plán ochrany dítěte</h2>
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? (
            'Zrušit'
          ) : (
            <>
              <Plus size={16} /> Založit nový IPPD
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="mt-3 flex max-w-[560px] flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-4"
        >
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Období
            <DateRangePicker from={period.from} to={period.to} onChange={setPeriod} />
          </label>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium leading-relaxed text-text-primary">Cíle</p>
            {goalDrafts.map((draft, idx) => (
              <div key={idx} className="flex flex-col gap-2 rounded-md border border-border-subtle p-3">
                <label className="flex flex-col gap-1 text-sm text-text-secondary">
                  Popis cíle
                  <Input
                    value={draft.description}
                    onChange={(e) => updateGoalDraft(idx, { description: e.target.value })}
                  />
                </label>
                <div className="flex gap-3">
                  <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
                    Odpovědná osoba
                    <Select
                      value={draft.kind}
                      onChange={(e) => updateGoalDraft(idx, { kind: e.target.value as ResponsibleKind, refId: '' })}
                    >
                      <option value="fosterPerson">Pěstoun</option>
                      <option value="staff">Zaměstnanec</option>
                      <option value="child">Dítě</option>
                    </Select>
                  </label>
                  {draft.kind === 'fosterPerson' && (
                    <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
                      Pěstoun
                      <Select
                        value={draft.refId}
                        onChange={(e) => updateGoalDraft(idx, { refId: e.target.value })}
                      >
                        <option value="">Vyberte…</option>
                        {fosterPersons.map((f) => (
                          <option key={f.docId} value={f.docId}>
                            {f.fosterPerson.firstName} {f.fosterPerson.lastName}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
                  {draft.kind === 'child' && (
                    <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
                      Dítě
                      <Select
                        value={draft.refId}
                        onChange={(e) => updateGoalDraft(idx, { refId: e.target.value })}
                      >
                        <option value="">Vyberte…</option>
                        {children.map((c) => (
                          <option key={c.docId} value={c.docId}>
                            {c.child.firstName} {c.child.lastName}
                          </option>
                        ))}
                      </Select>
                    </label>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addGoalRow} className="w-fit">
              <Plus size={16} /> Přidat cíl
            </Button>
          </div>

          {formError && (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" loading={submitting} success={success}>
              Založit IPPD
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
        ) : ippds === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : ippds.length === 0 ? (
          <EmptyState icon={ClipboardList} text="Zatím žádný IPPD." />
        ) : (
          <div className="flex max-w-[928px] flex-col gap-3">
            {ippds.map(({ docId, ippd }) => {
              const overdue = ippd.status === 'aktivni' && !!ippd.evaluation && new Date(ippd.evaluation.dueDate) < new Date()
              return (
                <div key={docId} className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-text-primary">
                      {new Date(ippd.periodFrom).toLocaleDateString('cs-CZ')} –{' '}
                      {new Date(ippd.periodTo).toLocaleDateString('cs-CZ')}
                    </p>
                    <StatusBadge label={STATUS_LABELS[ippd.status]} />
                  </div>

                  {ippd.status === 'aktivni' && ippd.evaluation && (
                    <p
                      className={cn(
                        'inline-flex w-fit items-center rounded-md px-2 py-1 text-xs',
                        overdue ? 'bg-danger-bg text-danger' : 'text-text-secondary',
                      )}
                    >
                      Termín vyhodnocení: {new Date(ippd.evaluation.dueDate).toLocaleDateString('cs-CZ')}
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    {ippd.goals.map((goal) => (
                      <div key={goal.id} className="rounded-md border border-border-subtle bg-surface-soft p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-text-primary">{goal.description}</p>
                          <StatusBadge label={GOAL_STATUS_LABELS[goal.status]} />
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">
                          Odpovědná osoba: {resolveResponsibleLabel(goal.responsibleRef)}
                        </p>
                        {goal.steps.length > 0 && (
                          <ul className="mt-2 flex flex-col gap-1">
                            {goal.steps.map((step) => (
                              <li key={step.id} className="flex items-center gap-2 text-sm text-text-secondary">
                                <input
                                  type="checkbox"
                                  checked={step.done}
                                  readOnly
                                  disabled
                                  className="size-4 rounded border-border-medium"
                                />
                                <span>{step.description}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>

                  {actionError && (
                    <p className="text-sm text-danger" role="alert">
                      {actionError}
                    </p>
                  )}

                  {ippd.status === 'aktivni' &&
                    (evaluatingDocId === docId ? (
                      <form onSubmit={(e) => handleEvaluateSubmit(e, docId)} className="flex flex-col gap-2">
                        <label className="flex flex-col gap-1 text-sm text-text-secondary">
                          Shrnutí vyhodnocení
                          <textarea
                            required
                            value={evaluationSummary}
                            onChange={(e) => setEvaluationSummary(e.target.value)}
                            rows={4}
                            className={TEXTAREA_CLASSNAME}
                          />
                        </label>
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" loading={actionSubmitting} success={actionSuccess}>
                            Uložit vyhodnocení
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleEvaluate(docId)}
                            disabled={actionSubmitting}
                          >
                            Zrušit
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button variant="secondary" size="sm" className="w-fit" onClick={() => toggleEvaluate(docId)}>
                        Vyhodnotit
                      </Button>
                    ))}

                  {ippd.status === 'vyhodnoceno' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-fit"
                      loading={actionSubmitting}
                      success={actionSuccess}
                      onClick={() => handleClose(docId)}
                    >
                      Uzavřít
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
